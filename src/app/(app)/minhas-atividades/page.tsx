import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ListChecks, ArrowRight, CalendarClock, Building2 } from "lucide-react";

type Ativ = {
  id: string;
  titulo: string;
  projectId: string;
  clientId: string;
  cliente: string;
  dueDate: Date | null;
  status: string;
};
type Grupo = { clientId: string; cliente: string; itens: Ativ[] };
type Bucket = { chave: string; label: string; cor: string; dot: string; grupos: Grupo[] };

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
function fmt(d: Date | null) {
  if (!d) return "sem data";
  return `${d.getUTCDate()} ${MESES[d.getUTCMonth()]}`;
}

// Organiza por prioridade de tempo e, dentro de cada faixa, por cliente. A data
// atual fica aqui (fora do corpo do componente) para não cair no lint de pureza.
function organizar(rows: Ativ[]): Bucket[] {
  const DAY = 24 * 60 * 60 * 1000;
  const now = new Date();
  const hoje = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const dow = new Date(hoje).getUTCDay(); // 0=dom..6=sáb
  const fimSemana = hoje + ((7 - dow) % 7) * DAY; // próximo domingo (inclusive)
  const fimProx = fimSemana + 7 * DAY;
  const fimMes = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0);

  const defs = [
    { chave: "atrasadas", label: "Atrasadas", cor: "text-destructive", dot: "bg-destructive" },
    { chave: "semana", label: "Esta semana", cor: "text-warning", dot: "bg-warning-bg" },
    { chave: "prox", label: "Próxima semana", cor: "text-accent", dot: "bg-accent" },
    { chave: "mes", label: "Este mês", cor: "text-foreground/70", dot: "bg-muted-foreground/60" },
    { chave: "depois", label: "Mais adiante", cor: "text-muted-foreground", dot: "bg-muted-foreground/30" },
    { chave: "sem", label: "Sem data", cor: "text-muted-foreground", dot: "bg-muted-foreground/30" },
  ];

  function faixa(due: Date | null): string {
    if (!due) return "sem";
    const du = Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate());
    if (du < hoje) return "atrasadas";
    if (du <= fimSemana) return "semana";
    if (du <= fimProx) return "prox";
    if (du <= fimMes) return "mes";
    return "depois";
  }

  const mapa = new Map<string, Map<string, Grupo>>();
  for (const d of defs) mapa.set(d.chave, new Map());
  for (const r of rows) {
    const g = mapa.get(faixa(r.dueDate))!;
    let grupo = g.get(r.clientId);
    if (!grupo) {
      grupo = { clientId: r.clientId, cliente: r.cliente, itens: [] };
      g.set(r.clientId, grupo);
    }
    grupo.itens.push(r);
  }

  return defs
    .map((d) => ({ ...d, grupos: [...mapa.get(d.chave)!.values()] }))
    .filter((b) => b.grupos.length > 0);
}

export default async function MinhasAtividadesPage() {
  const user = await requireUser();

  const escopo =
    user.role === "CONSULTOR"
      ? { consultantId: user.id }
      : user.role === "DIRETORIA"
        ? {}
        : { productLine: user.productLine ?? undefined };

  const atividades = await db.projectActivity.findMany({
    where: {
      status: { in: ["PENDENTE", "EM_ANDAMENTO"] },
      project: { deleted: false, status: "ATIVO", ...escopo },
    },
    include: { project: { include: { client: true } } },
    orderBy: [{ dueDate: "asc" }],
  });

  const rows: Ativ[] = atividades.map((a) => ({
    id: a.id,
    titulo: a.titulo,
    projectId: a.projectId,
    clientId: a.project.clientId,
    cliente: a.project.client.razaoSocial,
    dueDate: a.dueDate,
    status: a.status,
  }));
  const buckets = organizar(rows);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold inline-flex items-center gap-2">
          <ListChecks className="h-6 w-6 text-primary" /> Minhas atividades
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Seus próximos passos em todos os clientes ativos, por prioridade de tempo. Clique numa
          atividade para abrir o projeto.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <ListChecks className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-medium mb-1">Tudo em dia</h3>
          <p className="text-sm text-muted-foreground">
            Nenhuma atividade pendente nos seus clientes ativos.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {buckets.map((b) => {
            const total = b.grupos.reduce((s, g) => s + g.itens.length, 0);
            return (
              <section key={b.chave} className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${b.dot}`} />
                  <h2 className={`text-xs font-bold uppercase tracking-wide ${b.cor}`}>{b.label}</h2>
                  <span className="text-xs text-muted-foreground">
                    {total} atividade{total === 1 ? "" : "s"} · {b.grupos.length} cliente
                    {b.grupos.length === 1 ? "" : "s"}
                  </span>
                </div>

                <div className="space-y-3">
                  {b.grupos.map((g) => (
                    <div
                      key={g.clientId}
                      className="bg-card border border-border rounded-lg overflow-hidden"
                    >
                      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/30">
                        <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-sm font-semibold truncate">{g.cliente}</span>
                        <span className="ml-auto text-xs text-muted-foreground shrink-0">
                          {g.itens.length}
                        </span>
                      </div>
                      <div className="divide-y divide-border">
                        {g.itens.map((a) => (
                          <Link
                            key={a.id}
                            href={`/projetos/${a.projectId}`}
                            className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors"
                          >
                            <span className="min-w-0 flex-1 text-sm truncate">{a.titulo}</span>
                            {a.status === "EM_ANDAMENTO" && (
                              <span className="shrink-0 text-[11px] font-medium text-accent">
                                em andamento
                              </span>
                            )}
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground shrink-0 w-16 justify-end">
                              <CalendarClock className="h-3.5 w-3.5" /> {fmt(a.dueDate)}
                            </span>
                            <ArrowRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
