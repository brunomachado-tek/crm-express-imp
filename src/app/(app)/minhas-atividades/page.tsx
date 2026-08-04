import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ListChecks, ArrowRight, CalendarClock } from "lucide-react";

type Linha = {
  id: string;
  titulo: string;
  projectId: string;
  cliente: string;
  dueDate: Date | null;
  status: string;
};

// Agrupa por urgência (data atual fica aqui, fora do corpo do componente, para
// não cair no lint de pureza). Atrasadas, esta semana, depois, sem prazo.
function classifica(rows: Linha[]) {
  const now = new Date();
  const hoje = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const semana = hoje + 7 * 24 * 60 * 60 * 1000;
  const b = { atrasadas: [] as Linha[], semana: [] as Linha[], depois: [] as Linha[], semPrazo: [] as Linha[] };
  for (const r of rows) {
    if (!r.dueDate) {
      b.semPrazo.push(r);
      continue;
    }
    const d = r.dueDate;
    const du = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    if (du < hoje) b.atrasadas.push(r);
    else if (du <= semana) b.semana.push(r);
    else b.depois.push(r);
  }
  return b;
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
function fmt(d: Date | null) {
  if (!d) return "sem prazo";
  return `${d.getUTCDate()} ${MESES[d.getUTCMonth()]}`;
}

function Bloco({
  titulo,
  cor,
  rows,
}: {
  titulo: string;
  cor: string;
  rows: Linha[];
}) {
  if (rows.length === 0) return null;
  return (
    <section>
      <h2 className={`text-xs font-bold uppercase tracking-wide mb-2 ${cor}`}>
        {titulo} <span className="opacity-60">({rows.length})</span>
      </h2>
      <div className="bg-card border border-border rounded-lg divide-y divide-border overflow-hidden">
        {rows.map((r) => (
          <Link
            key={r.id}
            href={`/projetos/${r.projectId}`}
            className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{r.titulo}</p>
              <p className="text-xs text-muted-foreground truncate">{r.cliente}</p>
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground shrink-0">
              <CalendarClock className="h-3.5 w-3.5" /> {fmt(r.dueDate)}
            </span>
            <ArrowRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
          </Link>
        ))}
      </div>
    </section>
  );
}

export default async function MinhasAtividadesPage() {
  const user = await requireUser();

  // Escopo: consultor vê os próprios projetos; coordenação/CS o produto;
  // diretoria vê tudo.
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

  const rows: Linha[] = atividades.map((a) => ({
    id: a.id,
    titulo: a.titulo,
    projectId: a.projectId,
    cliente: a.project.client.razaoSocial,
    dueDate: a.dueDate,
    status: a.status,
  }));
  const b = classifica(rows);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold inline-flex items-center gap-2">
          <ListChecks className="h-6 w-6 text-primary" /> Minhas atividades
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Seus próximos passos em todos os clientes ativos, por prioridade de tempo. Clique para abrir
          o projeto.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="bg-card border border-border rounded-lg px-4 py-10 text-center">
          <ListChecks className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            Nenhuma atividade pendente nos seus clientes ativos.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          <Bloco titulo="Atrasadas" cor="text-destructive" rows={b.atrasadas} />
          <Bloco titulo="Esta semana" cor="text-warning" rows={b.semana} />
          <Bloco titulo="Depois" cor="text-foreground/70" rows={b.depois} />
          <Bloco titulo="Sem prazo" cor="text-muted-foreground" rows={b.semPrazo} />
        </div>
      )}
    </div>
  );
}
