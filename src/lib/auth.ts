import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import crypto from "crypto";
import { db } from "./db";

const COOKIE_NAME = "crm_session";
const SESSION_DAYS = 14;

export async function createSession(userId: string) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.session.create({ data: { token, userId, expiresAt } });
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    // Em produção o cookie só trafega por HTTPS. Sem isso, um acesso em http
    // (link antigo, rede interna) devolveria a sessão em texto claro.
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (token) {
    await db.session.deleteMany({ where: { token } });
    jar.delete(COOKIE_NAME);
  }
}

export async function getUser() {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { token },
    include: { user: true },
  });
  // Conta inativa ou não liberada pela diretoria não tem sessão válida.
  // A checagem recusa os status de bloqueio em vez de exigir exatamente
  // "APROVADO": se o campo vier vazio por algum motivo (por exemplo, um
  // processo antigo rodando com o Prisma client desatualizado), ninguém fica
  // trancado para fora sem explicação. Os bloqueios reais seguem valendo.
  const bloqueado = session?.user.status === "PENDENTE" || session?.user.status === "RECUSADO";
  if (!session || session.expiresAt < new Date() || !session.user.active || bloqueado) {
    return null;
  }
  return session.user;
}

export async function requireUser() {
  const user = await getUser();
  if (!user) {
    // Se havia cookie de sessão e ainda assim não há usuário, algo invalidou o
    // acesso (sessão expirada, conta desativada ou ainda não liberada). Explica
    // em vez de devolver uma tela de login em branco, que parece um "pisca".
    const jar = await cookies();
    const tinhaSessao = !!jar.get(COOKIE_NAME)?.value;
    redirect(tinhaSessao ? "/login?erro=sessao" : "/login");
  }
  return user;
}
