import Link from "next/link";
import { redirect } from "next/navigation";
import { forgotPasswordAction } from "@/lib/actions";
import { getUser } from "@/lib/auth";
import { AuthShell, authInput } from "@/components/auth-shell";
import { ArrowLeft, MailCheck } from "lucide-react";

export default async function EsqueciSenhaPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; dev?: string }>;
}) {
  const user = await getUser();
  if (user) redirect("/");
  const { ok, dev } = await searchParams;

  return (
    <AuthShell subtitle="Recuperação de senha">
      {ok ? (
        <div className="bg-card border border-border rounded-lg p-6 text-center space-y-3">
          <MailCheck className="h-10 w-10 text-success mx-auto" />
          <h2 className="text-lg font-semibold">Verifique seu email</h2>
          <p className="text-sm text-muted-foreground">
            Se o email informado estiver cadastrado, enviamos um link para redefinir a senha.
            O link vale por 1 hora.
          </p>
          {dev && (
            <div className="text-left text-xs bg-warning-bg/10 border border-warning-bg/40 rounded-md p-3 space-y-1">
              <p className="font-semibold text-warning">Ambiente de desenvolvimento</p>
              <p className="text-muted-foreground">
                SMTP ainda não configurado. Use o link direto:
              </p>
              <Link href={dev} className="text-accent break-all hover:underline">
                {dev}
              </Link>
            </div>
          )}
        </div>
      ) : (
        <form action={forgotPasswordAction} className="bg-card border border-border rounded-lg p-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            Informe seu email corporativo. Você receberá um link para criar uma nova senha.
          </p>
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="nome@teknisa.com"
              className={authInput}
            />
          </div>
          <button
            type="submit"
            className="w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary-hover transition-colors"
          >
            Enviar link de recuperação
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
