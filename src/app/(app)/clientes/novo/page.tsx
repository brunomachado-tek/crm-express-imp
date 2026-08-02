import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import Link from "next/link";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { canCreateClient } from "@/lib/permissions";
import { NovoClienteForm } from "@/components/clientes/novo-cliente-form";

const ERROS: Record<string, string> = {
  permissao: "Cadastro de cliente é da coordenação ou da diretoria.",
  "permissao-produto": "Você só cadastra clientes do seu produto.",
  produto: "Escolha o produto: TecFood ou Retail.",
  "razao-social": "Informe a razão social do cliente.",
  "cnpj-duplicado": "Já existe um cliente cadastrado com esse CNPJ.",
  "contrato-duplicado": "Já existe um contrato cadastrado com esse número.",
};

export default async function NovoClientePage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; cliente?: string }>;
}) {
  const user = await requireUser();
  const { erro, cliente } = await searchParams;
  const modules = await db.moduleTemplate.findMany({
    where: { active: true },
    orderBy: [{ productLine: "asc" }, { ordem: "asc" }],
  });

  // Quem não cadastra cliente não vê o formulário. A trava real está na
  // action; aqui é só para não oferecer um caminho que termina em recusa.
  if (!canCreateClient(user)) {
    return (
      <div className="max-w-xl space-y-4">
        <Link
          href="/clientes"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Clientes
        </Link>
        <div className="rounded-md border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          O cadastro de cliente é feito pela coordenação do produto ou pela diretoria.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link
          href="/clientes"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ArrowLeft className="h-4 w-4" /> Clientes
        </Link>
        <h1 className="text-2xl font-semibold">Novo cliente</h1>
        <p className="text-sm text-muted-foreground">
          O cadastro começa pelo contrato assinado que o comercial enviou. Os dados são lidos dele,
          para não redigitar nada e não errar número. O projeto entra na primeira etapa do funil.
        </p>
      </div>

      {erro && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            {ERROS[erro] ?? "Não foi possível cadastrar o cliente."}
            {cliente && (
              <>
                {" "}
                <Link href={`/clientes/${cliente}`} className="underline font-medium">
                  Abrir o cliente já cadastrado
                </Link>
              </>
            )}
          </span>
        </div>
      )}

      <NovoClienteForm
        modules={modules.map((m) => ({
          id: m.id,
          nome: m.nome,
          descricao: m.descricao,
          productLine: m.productLine as "TECFOOD" | "RETAIL",
          grupo: m.grupo as "FIXO" | "BASICO" | "COMPLETO" | "ADICIONAL",
        }))}
      />
    </div>
  );
}
