import nodemailer from "nodemailer";

// SMTP configurado via env (.env):
// SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, APP_URL
// Sem SMTP_HOST definido, o envio é simulado (dev): o link é logado no console
// e devolvido para exibição na tela.

export type MailResult = { sent: boolean; devLink?: string };

// Sem SMTP configurado: em desenvolvimento devolve o link para aparecer na tela
// (conveniência local); em PRODUÇÃO nunca devolve o link (senão qualquer pessoa
// que saiba um email tomaria a conta), só registra o alerta no log. Em produção
// o SMTP tem que estar configurado.
function semSmtp(tipo: string, to: string, url: string): MailResult {
  if (process.env.NODE_ENV === "production") {
    console.error(`[mailer] SMTP não configurado em produção. ${tipo} para ${to} NÃO enviado.`);
    return { sent: false };
  }
  console.log(`[mailer:dev] ${tipo} para ${to}: ${url}`);
  return { sent: false, devLink: url };
}

// Nome de pessoa vai para dentro do HTML do email. Sem escapar, um nome com
// "<" quebraria a mensagem, e um nome escolhido de propósito no autocadastro
// poderia inserir marcação na mensagem que a equipe recebe.
function escapaHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendPasswordResetEmail(
  to: string,
  name: string,
  resetUrl: string
): Promise<MailResult> {
  if (!process.env.SMTP_HOST) {
    return semSmtp("Link de redefinição", to, resetUrl);
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? "CRM Express <no-reply@teknisa.com>",
    to,
    subject: "Redefinição de senha · CRM Express",
    text: `Olá, ${name}.\n\nRecebemos um pedido para redefinir sua senha no CRM Express.\nAcesse o link abaixo (válido por 1 hora):\n\n${resetUrl}\n\nSe você não solicitou, ignore este email.`,
    html: `
      <div style="font-family:Roboto,Arial,sans-serif;color:#273138;max-width:480px">
        <h2 style="color:#040486">CRM Express</h2>
        <p>Olá, <strong>${escapaHtml(name)}</strong>.</p>
        <p>Recebemos um pedido para redefinir sua senha. O link é válido por 1 hora:</p>
        <p style="margin:24px 0">
          <a href="${resetUrl}" style="background:#040486;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">
            Redefinir senha
          </a>
        </p>
        <p style="color:#64748b;font-size:13px">Se você não solicitou, ignore este email.</p>
      </div>`,
  });
  return { sent: true };
}

export async function sendInviteEmail(
  to: string,
  name: string,
  invitedByName: string,
  inviteUrl: string
): Promise<MailResult> {
  if (!process.env.SMTP_HOST) {
    return semSmtp("Convite", to, inviteUrl);
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? "CRM Express <no-reply@teknisa.com>",
    to,
    subject: "Você foi convidado para o CRM Express da Teknisa",
    text: `Olá, ${name}.\n\n${invitedByName} te convidou para o CRM Express (Small Business).\nCrie sua senha para ativar a conta (link válido por 7 dias):\n\n${inviteUrl}`,
    html: `
      <div style="font-family:Roboto,Arial,sans-serif;color:#273138;max-width:480px">
        <h2 style="color:#040486">CRM Express</h2>
        <p>Olá, <strong>${escapaHtml(name)}</strong>.</p>
        <p><strong>${escapaHtml(invitedByName)}</strong> te convidou para o CRM Express, o sistema da Diretoria de Small Business.</p>
        <p style="margin:24px 0">
          <a href="${inviteUrl}" style="background:#040486;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">
            Criar minha senha
          </a>
        </p>
        <p style="color:#64748b;font-size:13px">Link válido por 7 dias. Se você não esperava este convite, ignore este email.</p>
      </div>`,
  });
  return { sent: true };
}
