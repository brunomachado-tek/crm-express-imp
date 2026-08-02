import Link from "next/link";
import { db } from "@/lib/db";
import { acceptInviteAction } from "@/lib/actions";
import { AuthShell, authInput } from "@/components/auth-shell";
import { ROLE_LABELS } from "@/lib/format";
import { ArrowLeft } from "lucide-react";

const ERROS: Record<string, string> = {
  token: "Convite inválido, já usado ou expirado. Peça para reenviarem.",
  "senha-curta": "A senha precisa ter pelo menos 8 caracteres.",
};

export default async function ConvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; erro?: string }>;
}) {
  const { token, erro } = await searchParams;

  const invite = token ? await db.inviteToken.findUnique({ where: { token } }) : null;
  const invited = invite ? await db.user.findUnique({ where: { id: invite.userId } }) : null;
  const invalid =
    !token || !invite || invite.usedAt || invite.expiresAt < new Date() || !invited || invited.passwordHash;

  return (
    <AuthShell subtitle="Você foi convidado para o CRM Express">
      {invalid || !invited ? (
        <div className="bg-card border border-border rounded-lg p-6 text-center">
          <p className="text-sm text-destructive">{ERROS[erro ?? "token"] ?? ERROS.token}</p>
        </div>
      ) : (
        <form action={acceptInviteAction} className="bg-card border border-border rounded-lg p-6 space-y-4">
          {erro && (
            <p className="text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-md px-3 py-2">
              {ERROS[erro] ?? "Não foi possível ativar o convite."}
            </p>
          )}
          <div>
            <p className="text-sm text-muted-foreground">Bem-vindo(a),</p>
            <p className="text-lg font-semibold font-display">{invited.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {invited.email} · {ROLE_LABELS[invited.role]}
            </p>
          </div>
          <input type="hidden" name="token" value={token} />
          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium">
              Crie sua senha
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="Mínimo de 8 caracteres"
              className={authInput}
            />
          </div>
          <button
            type="submit"
            className="w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary-hover transition-colors"
          >
            Ativar conta e entrar
          </button>
        </form>
      )}

      <p className="text-center text-sm text-muted-foreground mt-6">
        <Link href="/login" className="inline-flex items-center gap-1 text-accent hover:underline">
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar para o login
        </Link>
      </p>
    </AuthShell>
  );
}
