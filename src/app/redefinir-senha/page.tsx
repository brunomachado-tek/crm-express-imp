import Link from "next/link";
import { resetPasswordAction } from "@/lib/actions";
import { AuthShell, authInput } from "@/components/auth-shell";
import { ArrowLeft } from "lucide-react";

const ERROS: Record<string, string> = {
  token: "Link inválido ou expirado. Solicite uma nova recuperação de senha.",
  "senha-curta": "A senha precisa ter pelo menos 8 caracteres.",
};

export default async function RedefinirSenhaPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; erro?: string }>;
}) {
  const { token, erro } = await searchParams;

  return (
    <AuthShell subtitle="Defina sua nova senha">
      {!token && !erro ? (
        <div className="bg-card border border-border rounded-lg p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Link incompleto. Use o link enviado por email ou solicite um novo em{" "}
            <Link href="/esqueci-senha" className="text-accent hover:underline">
              esqueci minha senha
            </Link>
            .
          </p>
        </div>
      ) : (
        <form action={resetPasswordAction} className="bg-card border border-border rounded-lg p-6 space-y-4">
          {erro && (
            <p className="text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-md px-3 py-2">
              {ERROS[erro] ?? "Não foi possível redefinir a senha."}
            </p>
          )}
          {token && (
            <>
              <input type="hidden" name="token" value={token} />
              <div className="space-y-1.5">
                <label htmlFor="password" className="text-sm font-medium">
                  Nova senha
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
                Salvar nova senha e entrar
              </button>
            </>
          )}
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
