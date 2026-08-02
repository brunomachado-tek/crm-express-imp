import Link from "next/link";
import { redirect } from "next/navigation";
import { firstAccessAction } from "@/lib/actions";
import { getUser } from "@/lib/auth";
import { AuthShell, authInput } from "@/components/auth-shell";
import { ArrowLeft } from "lucide-react";

const ERROS: Record<string, string> = {
  "nao-encontrado": "Esta conta está desativada. Fale com a coordenação.",
  "ja-ativada": "Esta conta já foi ativada. Use a tela de login ou “Esqueci minha senha”.",
  "senha-curta": "A senha precisa ter pelo menos 8 caracteres.",
  campos: "Preencha nome, email, papel e senha.",
  dominio: "Use seu email corporativo da Teknisa.",
  "produto-obrigatorio": "Selecione o produto (TecFood ou Retail) para esse papel.",
};

export default async function PrimeiroAcessoPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const user = await getUser();
  if (user) redirect("/");
  const { erro } = await searchParams;

  return (
    <AuthShell subtitle="Primeiro acesso: crie ou ative sua conta">
      <form action={firstAccessAction} className="bg-card border border-border rounded-lg p-6 space-y-4">
        {erro && (
          <p className="text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-md px-3 py-2">
            {ERROS[erro] ?? "Não foi possível concluir o primeiro acesso."}
          </p>
        )}
        <p className="text-sm text-muted-foreground">
          Preencha os dados e defina sua senha. O acesso não é liberado na hora: a diretoria ou a
          coordenação confere a solicitação dentro do sistema e libera. Você recebe um aviso quando
          isso acontecer.
        </p>

        <div className="space-y-1.5">
          <label htmlFor="name" className="text-sm font-medium">
            Nome completo
          </label>
          <input id="name" name="name" autoComplete="name" className={authInput} />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="email" className="text-sm font-medium">
            Email corporativo
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

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="role" className="text-sm font-medium">
              Papel
            </label>
            <select id="role" name="role" defaultValue="" className={authInput}>
              <option value="" disabled>
                Selecione…
              </option>
              <option value="CONSULTOR">Consultor(a)</option>
              <option value="CS">Customer Success</option>
              <option value="COORDENACAO">Coordenação</option>
              <option value="DIRETORIA">Diretoria</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="productLine" className="text-sm font-medium">
              Produto
            </label>
            <select id="productLine" name="productLine" defaultValue="" className={authInput}>
              <option value="">Nenhum (diretoria)</option>
              <option value="TECFOOD">TecFood</option>
              <option value="RETAIL">Retail</option>
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="password" className="text-sm font-medium">
            Defina sua senha
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
          Continuar
        </button>
        <p className="text-xs text-muted-foreground">
          O papel informado é uma solicitação: quem libera confirma as permissões. Se você recebeu um
          link de convite por email, use o link: ele já ativa a conta sem esperar liberação.
        </p>
      </form>

      <p className="text-center text-sm text-muted-foreground mt-6">
        <Link href="/login" className="inline-flex items-center gap-1 text-accent hover:underline">
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar para o login
        </Link>
      </p>
    </AuthShell>
  );
}
