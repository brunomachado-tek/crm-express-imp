import Link from "next/link";
import { redirect } from "next/navigation";
import { loginAction } from "@/lib/actions";
import { getUser } from "@/lib/auth";
import { AuthShell, authInput } from "@/components/auth-shell";

const ERROS: Record<string, string> = {
  credenciais: "Email ou senha incorretos.",
  "sem-senha": "Esta conta ainda não foi ativada. Use a opção “Primeiro acesso” abaixo.",
  pendente:
    "Sua solicitação de acesso ainda aguarda liberação da diretoria ou da coordenação.",
  recusado: "Sua solicitação de acesso foi recusada. Fale com a diretoria.",
  sessao: "Sua sessão não vale mais. Entre novamente. Se isso repetir logo após entrar, o servidor precisa ser reiniciado.",
};

const AVISOS: Record<string, string> = {
  solicitado:
    "Senha cadastrada e solicitação enviada. O acesso não é liberado na hora: assim que a diretoria ou a coordenação liberar, você entra com esse mesmo email e senha.",
  pendente: "Senha cadastrada. Seu acesso ainda aguarda liberação.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; aviso?: string }>;
}) {
  const user = await getUser();
  if (user) redirect("/");
  const { erro, aviso } = await searchParams;

  return (
    <AuthShell subtitle="Small Business · Implantação e CS">
      <form action={loginAction} className="bg-card border border-border rounded-lg p-6 space-y-4">
        {erro && (
          <p className="text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-md px-3 py-2">
            {ERROS[erro] ?? "Não foi possível entrar."}
          </p>
        )}
        {aviso && !erro && (
          <p className="text-sm text-success bg-success/5 border border-success/20 rounded-md px-3 py-2">
            {AVISOS[aviso] ?? "Solicitação registrada."}
          </p>
        )}
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
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="text-sm font-medium">
              Senha
            </label>
            <Link href="/esqueci-senha" className="text-xs text-accent hover:underline">
              Esqueci minha senha
            </Link>
          </div>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className={authInput}
          />
        </div>
        <button
          type="submit"
          className="w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary-hover transition-colors"
        >
          Entrar
        </button>
      </form>

      <p className="text-center text-sm text-muted-foreground mt-6">
        Primeira vez aqui?{" "}
        <Link href="/primeiro-acesso" className="text-accent font-medium hover:underline">
          Criar ou ativar minha conta
        </Link>
      </p>
    </AuthShell>
  );
}
