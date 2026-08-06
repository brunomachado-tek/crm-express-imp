import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { brl } from "@/lib/format";
import { Coins, UserRound } from "lucide-react";

const PCT = 0.6; // 60% da 1ª mensalidade, pago no mês seguinte à entrega do projeto

export default async function ComissaoPage({
  searchParams,
}: {
  searchParams: Promise<{ consultor?: string }>;
}) {
  const user = await requireUser();

  if (user.role === "CS") {
    return (
      <div className="max-w-3xl">
        <h1 className="text-2xl font-semibold inline-flex items-center gap-2">
          <Coins className="h-6 w-6 text-primary" /> Comissão
        </h1>
        <p className="mt-4 text-sm text-muted-foreground">
          O cálculo de comissão é da implantação (consultores). Seu perfil não tem comissão aqui.
        </p>
      </div>
    );
  }

  const { consultor } = await searchParams;
  const podeFiltrar = user.role !== "CONSULTOR"; // coordenação/diretoria filtram por consultor
  const escopo =
    user.role === "CONSULTOR"
      ? { consultantId: user.id }
      : user.role === "DIRETORIA"
        ? {}
        : { productLine: user.productLine ?? undefined };
  const filtro = podeFiltrar && consultor ? { consultantId: consultor } : {};

  const projects = await db.project.findMany({
    where: { deleted: false, consultantId: { not: null }, ...escopo, ...filtro },
    include: { client: true, consultant: true, stage: true, contracts: { where: { kind: "LUSO" } } },
    orderBy: { createdAt: "desc" },
  });

  type Linha = {
    id: string;
    cliente: string;
    consultorId: string;
    consultorNome: string;
    mensal: number;
    comissao: number;
    entregue: boolean;
  };
  const linhas: Linha[] = projects.map((p) => {
    const mensal = p.contracts.reduce((s, c) => s + (c.valorMensal ?? 0), 0);
    return {
      id: p.id,
      cliente: p.client.razaoSocial,
      consultorId: p.consultantId!,
      consultorNome: p.consultant?.name ?? "—",
      mensal,
      comissao: mensal * PCT,
      entregue: p.stage?.isFinal ?? false,
    };
  });

  const totalProjetada = linhas.filter((l) => !l.entregue).reduce((s, l) => s + l.comissao, 0);
  const totalReceber = linhas.filter((l) => l.entregue).reduce((s, l) => s + l.comissao, 0);

  // agrupa por consultor (coord/diretoria veem vários; consultor vê só ele)
  const grupos = new Map<string, { nome: string; itens: Linha[] }>();
  for (const l of linhas) {
    const g = grupos.get(l.consultorId) ?? { nome: l.consultorNome, itens: [] };
    g.itens.push(l);
    grupos.set(l.consultorId, g);
  }

  const consultores = podeFiltrar
    ? await db.user.findMany({
        where: {
          role: "CONSULTOR",
          active: true,
          status: "APROVADO",
          ...(user.role === "DIRETORIA" ? {} : { productLine: user.productLine ?? undefined }),
        },
        orderBy: { name: "asc" },
      })
    : [];

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold inline-flex items-center gap-2">
          <Coins className="h-6 w-6 text-primary" /> Comissão
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {PCT * 100}% da primeira mensalidade de cada cliente, paga no mês seguinte à entrega do
          projeto.
        </p>
      </div>

      {podeFiltrar && (
        <form className="flex items-end gap-2">
          <div className="space-y-1">
            <label htmlFor="consultor" className="text-xs font-medium text-muted-foreground">
              Filtrar por consultor
            </label>
            <select
              id="consultor"
              name="consultor"
              defaultValue={consultor ?? ""}
              className="h-9 rounded-md border border-border bg-muted/50 px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <option value="">Todos</option>
              {consultores.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <button className="h-9 px-4 rounded-md border border-border text-sm font-medium hover:bg-muted">
            Filtrar
          </button>
        </form>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Projetada (projetos ativos)</p>
          <p className="text-2xl font-bold text-foreground mt-1">{brl(totalProjetada)}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs text-muted-foreground">A receber (projetos entregues)</p>
          <p className="text-2xl font-bold text-success mt-1">{brl(totalReceber)}</p>
        </div>
      </div>

      {linhas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Coins className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <p className="text-sm text-muted-foreground">Nenhum projeto com comissão no escopo.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {[...grupos.values()].map((g) => {
            const sub = g.itens.reduce((s, l) => s + l.comissao, 0);
            return (
              <div key={g.nome} className="bg-card border border-border rounded-lg overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/30">
                  <UserRound className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm font-semibold flex-1 truncate">{g.nome}</span>
                  <span className="text-sm font-bold shrink-0">{brl(sub)}</span>
                </div>
                <div className="divide-y divide-border">
                  {g.itens.map((l) => (
                    <div key={l.id} className="flex items-center gap-3 px-4 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{l.cliente}</p>
                        <p className="text-xs text-muted-foreground">
                          mensalidade {brl(l.mensal)}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 text-[11px] font-medium rounded-full px-2 py-0.5 ${
                          l.entregue ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {l.entregue ? "a receber" : "projetada"}
                      </span>
                      <span className="shrink-0 text-sm font-semibold w-24 text-right">
                        {brl(l.comissao)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
