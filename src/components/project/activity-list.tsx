import { Check, ChevronRight, Clock, GanttChartSquare, Lock, Plus, UserRound, Users, Video } from "lucide-react";
import { addActivity, setActivityDue, setActivityStatus } from "@/lib/actions";
import { DeleteActivityButton } from "@/components/project/delete-activity-button";
import { ImportCronogramaButton } from "@/components/project/import-cronograma-button";
import { StatusSelect } from "@/components/project/status-select";
import { EnvolvidoField } from "@/components/project/envolvido-field";
import { NativeDateInput } from "@/components/ui/native-date-input";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { RESPONSAVEL_LABELS, STATUS_LABELS } from "@/lib/format";
import type { ProjectActivity, Responsavel, User } from "@prisma/client";

type Activity = ProjectActivity & {
  assignee: User | null;
  // Módulo de origem da atividade (o bloco do cronograma). Vem do template.
  template?: { moduleTemplate: { nome: string } | null } | null;
};
type ConsultantOption = { id: string; name: string };

const STATUS_STYLE: Record<string, string> = {
  PENDENTE: "bg-muted text-muted-foreground",
  EM_ANDAMENTO: "bg-accent/10 text-accent",
  CONCLUIDA: "bg-success/10 text-success",
  CANCELADA: "bg-destructive/10 text-destructive line-through",
};

const MESES = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

function DateBlock({ a }: { a: Activity }) {
  if (!a.dueDate) {
    return (
      <div className="w-14 shrink-0 text-center pt-2">
        <span className="block h-2 w-2 rounded-full bg-muted-foreground/30 mx-auto" />
        <span className="block text-[10px] uppercase tracking-wider text-muted-foreground/50 mt-2">
          sem data
        </span>
      </div>
    );
  }

  const d = new Date(a.dueDate);
  const dayNum = d.getUTCDate();
  const month = MESES[d.getUTCMonth()];

  if (a.status === "CONCLUIDA" || a.status === "CANCELADA") {
    return (
      <div className="w-14 shrink-0 text-center pt-1">
        <span className="block font-display text-xl font-semibold leading-none text-muted-foreground">
          {dayNum}
        </span>
        <span className="block text-[10px] uppercase tracking-wider mt-0.5 text-muted-foreground">
          {month}
        </span>
      </div>
    );
  }

  const dueUTC = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const now = new Date();
  const todayUTC = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((dueUTC - todayUTC) / (24 * 60 * 60 * 1000));

  let note: string;
  let colorClass: string;
  if (diffDays < 0) {
    note = `${-diffDays}d atrasada`;
    colorClass = "text-destructive";
  } else if (diffDays === 0) {
    note = "vence hoje";
    colorClass = "text-warning";
  } else if (diffDays <= 2) {
    note = `faltam ${diffDays}d`;
    colorClass = "text-warning";
  } else {
    note = `faltam ${diffDays}d`;
    colorClass = "text-success";
  }

  return (
    <div className="w-14 shrink-0 text-center pt-1">
      <span className={`block font-display text-xl font-semibold leading-none ${colorClass}`}>
        {dayNum}
      </span>
      <span className={`block text-[10px] uppercase tracking-wider mt-0.5 font-semibold ${colorClass}`}>
        {month}
      </span>
      <span className={`block text-[10px] font-semibold mt-0.5 ${colorClass}`}>{note}</span>
    </div>
  );
}

// Tags coloridas por significado: azul para esforço, verde para quem toca,
// âmbar para o que depende do cliente. A cor ajuda a bater o olho e entender
// de quem é a bola.
const TAG_TONES = {
  tempo: "bg-accent/10 text-accent border-accent/25",
  reuniao: "bg-primary/10 text-primary border-primary/25",
  pessoa: "bg-success/10 text-success border-success/25",
  teknisa: "bg-primary/10 text-primary border-primary/25",
  cliente: "bg-warning-bg/20 text-warning border-warning-bg/40",
  ambos: "bg-accent/10 text-accent border-accent/25",
} as const;

function Tag({
  icon: Icon,
  children,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  tone: keyof typeof TAG_TONES;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold ${TAG_TONES[tone]}`}
    >
      <Icon className="h-3 w-3 shrink-0" />
      {children}
    </span>
  );
}

// Responsável define a cor: o que cai no cliente fica em âmbar.
const TONE_POR_RESPONSAVEL: Record<string, keyof typeof TAG_TONES> = {
  TEKNISA: "teknisa",
  CLIENTE: "cliente",
  AMBOS: "ambos",
};

const fieldLabel = "text-xs font-medium text-muted-foreground";
const fieldInput =
  "w-full h-9 rounded-md border border-border bg-muted/50 px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40";

export function ActivityList({
  projectId,
  activities,
  canManage,
  consultants,
  showAssigneeSelect,
  sugestoesTitulo = [],
}: {
  projectId: string;
  activities: Activity[];
  canManage: boolean;
  consultants: ConsultantOption[];
  showAssigneeSelect: boolean;
  sugestoesTitulo?: string[];
}) {
  const done = activities.filter((a) => a.status === "CONCLUIDA").length;
  const pct = activities.length === 0 ? 0 : Math.round((done / activities.length) * 100);
  const listaId = `titulos-atividade-${projectId}`;

  // Agrupa por fase (bloco do cronograma), na ordem em que aparecem. Atividades
  // sem fase caem num bloco final. A fase "atual" (primeira com algo pendente ou
  // em andamento) abre sozinha; as concluídas e as futuras ficam recolhidas.
  const grupos: { fase: string; items: Activity[] }[] = [];
  const idxFase = new Map<string, number>();
  for (const a of activities) {
    const chave = a.template?.moduleTemplate?.nome || a.fase?.trim() || "Outras atividades";
    if (!idxFase.has(chave)) {
      idxFase.set(chave, grupos.length);
      grupos.push({ fase: chave, items: [] });
    }
    grupos[idxFase.get(chave)!].items.push(a);
  }
  const faseAtualIdx = grupos.findIndex((g) =>
    g.items.some((a) => a.status === "PENDENTE" || a.status === "EM_ANDAMENTO")
  );

  return (
    <section className="bg-card border border-border rounded-lg p-5">
      <div className="flex items-center justify-between gap-3 mb-1.5">
        <h2 className="text-sm font-semibold inline-flex items-center gap-2">
          <GanttChartSquare className="h-4 w-4 text-primary" />
          Cronograma de atividades
        </h2>
        <div className="flex items-center gap-2">
          {canManage && <ImportCronogramaButton projectId={projectId} />}
          <span className="text-xs font-semibold rounded-full px-2 py-0.5 bg-muted text-muted-foreground">
            {done}/{activities.length} concluídas
          </span>
        </div>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden mb-5">
        <div className="h-full rounded-full bg-success transition-all" style={{ width: `${pct}%` }} />
      </div>

      {activities.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma atividade ainda. Os módulos vendidos geram o cronograma padrão, ou adicione manualmente
          abaixo.
        </p>
      ) : (
        <div className="space-y-3">
          {grupos.map((g, gi) => (
            <details
              key={g.fase}
              open={gi === faseAtualIdx}
              className="group/fase rounded-lg border border-border overflow-hidden"
            >
              <summary className="flex items-center gap-3 cursor-pointer select-none list-none px-4 py-3 bg-muted/40 hover:bg-muted/60 [&::-webkit-details-marker]:hidden">
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 transition-transform group-open/fase:rotate-90" />
                <FaseDot items={g.items} />
                <span className="text-sm font-semibold flex-1 min-w-0">{g.fase}</span>
                <FaseBadge items={g.items} />
              </summary>
              <ol className="space-y-3 p-4 pt-4 border-t border-border">
                {g.items.map((a) => (
                  <li key={a.id} className="flex gap-4">
              <DateBlock a={a} />
              <div
                className={`flex-1 min-w-0 rounded-lg border p-4 ${
                  a.status === "CONCLUIDA"
                    ? "border-border/60 bg-muted/30"
                    : a.status === "EM_ANDAMENTO"
                      ? "border-accent/30 bg-accent/[0.03]"
                      : "border-border"
                }`}
              >
                {/* Em telas largas: conteúdo à esquerda, quem/quanto ao centro,
                    controles à direita. Evita a linha única esticada. */}
                <div className="grid gap-x-6 gap-y-3 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] items-start">
                  <div className="min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <p
                        className={`text-sm font-semibold leading-snug flex items-start gap-1.5 ${
                          a.status === "CONCLUIDA"
                            ? "text-muted-foreground line-through"
                            : a.status === "CANCELADA"
                              ? "text-muted-foreground/60 line-through"
                              : ""
                        }`}
                      >
                        <span>{a.titulo}</span>
                        {(a.descricao || a.pautas) && (
                          <InfoTooltip label={`Detalhes de ${a.titulo}`}>
                            {a.descricao && <span className="block">{a.descricao}</span>}
                            {a.pautas && (
                              <span className={`block ${a.descricao ? "mt-2 pt-2 border-t border-border" : ""}`}>
                                <strong className="text-foreground">Pautas:</strong> {a.pautas}
                              </span>
                            )}
                          </InfoTooltip>
                        )}
                      </p>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[a.status]}`}
                      >
                        {STATUS_LABELS[a.status]}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-start gap-1.5 xl:justify-end">
                    {a.horas != null && (
                      <Tag icon={Clock} tone="tempo">
                        {a.horas}h
                      </Tag>
                    )}
                    {a.numReunioes ? (
                      <Tag icon={Video} tone="reuniao">
                        {a.numReunioes} {a.numReunioes > 1 ? "reuniões" : "reunião"}
                      </Tag>
                    ) : null}
                    {a.assignee && (
                      <Tag icon={UserRound} tone="pessoa">
                        {a.assignee.name}
                      </Tag>
                    )}
                    <Tag icon={UserRound} tone={TONE_POR_RESPONSAVEL[a.responsavel] ?? "ambos"}>
                      {RESPONSAVEL_LABELS[a.responsavel]}
                    </Tag>
                    {a.envolvidosCliente && (
                      <Tag icon={Users} tone="cliente">
                        {a.envolvidosCliente}
                      </Tag>
                    )}
                  </div>
                </div>

                {canManage && (
                  <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/70 flex-wrap">
                    <form action={setActivityStatus}>
                      <input type="hidden" name="activityId" value={a.id} />
                      <StatusSelect defaultValue={a.status} />
                    </form>
                    <form action={setActivityDue} className="flex items-center gap-1.5">
                      <input type="hidden" name="activityId" value={a.id} />
                      <label className="text-xs text-muted-foreground">Entrega</label>
                      <NativeDateInput
                        name="dueDate"
                        defaultValue={a.dueDate ? new Date(a.dueDate).toISOString().slice(0, 10) : null}
                        autoSubmit
                        className="h-8 rounded-md border border-border bg-card px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                      />
                    </form>
                    <div className="ml-auto">
                      <DeleteActivityButton activityId={a.id} />
                    </div>
                  </div>
                )}
              </div>
                  </li>
                ))}
              </ol>
            </details>
          ))}
        </div>
      )}

      {canManage ? (
        <form action={addActivity} className="mt-5 border-t border-border pt-5">
          <input type="hidden" name="projectId" value={projectId} />

          <h3 className="text-sm font-semibold inline-flex items-center gap-2 mb-3">
            <Plus className="h-4 w-4 text-primary" /> Criar nova atividade
          </h3>

          {sugestoesTitulo.length > 0 && (
            <datalist id={listaId}>
              {/* dedupe defensivo: a mesma atividade aparece em vários módulos */}
              {[...new Set(sugestoesTitulo)].map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          )}

          {/* Duas linhas com proporções definidas em vez de quebra automática:
              o título domina a primeira linha e os campos curtos têm largura
              fixa, então nada fica espremido nem sobra vão no fim. */}
          <div className="space-y-3">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[240px] space-y-1">
                <label htmlFor="nova-atividade" className={fieldLabel}>
                  Título da atividade
                </label>
                {/* `list` dá autocompletar nativo: sugere enquanto digita, mas
                    aceita qualquer texto. Sem JS e sem posicionamento calculado.
                    A <datalist> fica fora deste bloco (é referenciada por id) para
                    não desalinhar o campo em relação aos vizinhos. */}
                <input
                  id="nova-atividade"
                  name="titulo"
                  required
                  list={sugestoesTitulo.length > 0 ? listaId : undefined}
                  autoComplete="off"
                  placeholder="Ex.: Validar cardápio piloto"
                  className={fieldInput}
                />
              </div>
              <div className="w-24 space-y-1">
                <label htmlFor="nova-horas" className={fieldLabel}>
                  Horas
                </label>
                <input id="nova-horas" name="horas" inputMode="decimal" placeholder="8" className={fieldInput} />
              </div>
              <div className="w-40 space-y-1">
                <label htmlFor="nova-entrega" className={fieldLabel}>
                  Entrega
                </label>
                <input id="nova-entrega" name="dueDate" type="date" className={fieldInput} />
              </div>
              <div className="w-40 space-y-1">
                <label htmlFor="nova-responsavel" className={fieldLabel}>
                  Responsável
                </label>
                <select
                  id="nova-responsavel"
                  name="responsavel"
                  defaultValue={"AMBOS" satisfies Responsavel}
                  className={fieldInput}
                >
                  <option value="AMBOS">Ambos</option>
                  <option value="TEKNISA">Teknisa</option>
                  <option value="CLIENTE">Cliente</option>
                </select>
              </div>
            </div>

            {/* Descrição em largura total: é o texto que aparece no ícone de
                info da atividade, então precisa de espaço para uma explicação,
                não de um campo curto na linha dos demais. */}
            <div className="space-y-1">
              <label htmlFor="nova-descricao" className={fieldLabel}>
                Descrição <span className="text-muted-foreground font-normal">(aparece no ícone de informação da atividade)</span>
              </label>
              <textarea
                id="nova-descricao"
                name="descricao"
                rows={2}
                placeholder="O que precisa ser feito, o que combinar com o cliente, pontos de atenção."
                className={`${fieldInput} h-auto py-2 resize-y`}
              />
            </div>

            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[220px] space-y-1">
                <label htmlFor="nova-envolvidos" className={fieldLabel}>
                  Envolvidos do cliente
                </label>
                <EnvolvidoField id="nova-envolvidos" />
              </div>
              {showAssigneeSelect && (
                <div className="flex-1 min-w-[200px] space-y-1">
                  <label htmlFor="nova-assignee" className={fieldLabel}>
                    Atribuir a
                  </label>
                  <select id="nova-assignee" name="assigneeId" defaultValue="" className={fieldInput}>
                    <option value="">Ninguém</option>
                    {consultants.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <button className="h-9 px-4 inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary-hover transition-colors shrink-0">
                <Plus className="h-4 w-4" /> Adicionar atividade
              </button>
            </div>
          </div>
        </form>
      ) : (
        <p className="mt-5 border-t border-border pt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5" /> Somente o(a) consultor(a) responsável, a coordenação ou a
          diretoria podem editar o cronograma.
        </p>
      )}
    </section>
  );
}

// Bolinha de status do bloco: verde se tudo concluído, azul se algo em
// andamento, cinza se só pendente.
function FaseDot({ items }: { items: Activity[] }) {
  const done = items.filter((a) => a.status === "CONCLUIDA").length;
  const tudo = done === items.length;
  const andamento = items.some((a) => a.status === "EM_ANDAMENTO");
  const cor = tudo ? "bg-success" : andamento ? "bg-accent" : "bg-muted-foreground/30";
  return <span className={`h-2 w-2 rounded-full shrink-0 ${cor}`} />;
}

// Progresso do bloco (concluídas/total) e o check quando tudo está pronto.
function FaseBadge({ items }: { items: Activity[] }) {
  const done = items.filter((a) => a.status === "CONCLUIDA").length;
  const tudo = done === items.length;
  return (
    <span className="inline-flex items-center gap-1 shrink-0">
      {tudo && <Check className="h-3.5 w-3.5 text-success" />}
      <span className="text-xs font-semibold rounded-full px-2 py-0.5 bg-card text-muted-foreground">
        {done}/{items.length}
      </span>
    </span>
  );
}
