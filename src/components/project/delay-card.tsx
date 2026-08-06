import { AlertTriangle, Lock, Check, X } from "lucide-react";
import { justifyDelay, approveDelayJustification, rejectDelayJustification } from "@/lib/actions";
import { DeleteDelayButton } from "@/components/project/delete-delay-button";
import { fmtDate } from "@/lib/format";
import type { DelayCategory, DelayJustification, PipelineStage, User } from "@prisma/client";

type Atraso = DelayJustification & {
  category: DelayCategory;
  byUser: User | null;
  stage: PipelineStage;
};

// Selo de estado da justificativa. Pendente aguarda o coordenador; aprovada já
// desconta os dias do SLA; negada não desconta nada.
function StatusBadge({ status, dias }: { status: string; dias: number }) {
  if (status === "APROVADA") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-success/10 text-success px-2 py-0.5 text-[11px] font-medium">
        <Check className="h-3 w-3" /> Aprovada, desconta {dias} dia{dias === 1 ? "" : "s"}
      </span>
    );
  }
  if (status === "NEGADA") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 text-destructive px-2 py-0.5 text-[11px] font-medium">
        <X className="h-3 w-3" /> Negada
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 text-warning px-2 py-0.5 text-[11px] font-medium">
      Aguardando aprovação
    </span>
  );
}

export function DelayCard({
  projectId,
  canDelay,
  canApprove,
  categorias,
  atrasos,
}: {
  projectId: string;
  canDelay: boolean;
  canApprove: boolean;
  categorias: DelayCategory[];
  atrasos: Atraso[];
}) {
  const campo =
    "w-full h-9 rounded-md border border-border bg-muted/50 px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40";
  const rotulo = "block text-xs font-medium text-muted-foreground mb-1";

  return (
    <section className="h-full bg-card border border-border rounded-lg p-5 flex flex-col">
      <h2 className="text-sm font-semibold inline-flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-warning" /> Justificar atraso
      </h2>
      <p className="text-xs text-muted-foreground mt-1 mb-3">
        Obrigatório quando a etapa estoura o prazo ideal. O coordenador aprova, e só então
        os dias descontam do SLA.
      </p>

      {canDelay ? (
        <form action={justifyDelay} className="space-y-2.5">
          <input type="hidden" name="projectId" value={projectId} />
          <div>
            <label className={rotulo}>Categoria</label>
            <select name="categoryId" required defaultValue="" className={campo}>
              <option value="" disabled>
                Selecione
              </option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={rotulo}>Dias de atraso</label>
            <input
              type="number"
              name="dias"
              min={1}
              max={365}
              required
              placeholder="Ex.: 5"
              className={campo}
            />
          </div>
          <div>
            <label className={rotulo}>Detalhes (opcional)</label>
            <textarea
              name="detalhe"
              rows={2}
              className="w-full rounded-md border border-border bg-muted/50 px-2.5 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            />
          </div>
          <button className="w-full h-9 rounded-md border border-border text-sm font-medium hover:bg-muted transition-colors">
            Registrar justificativa
          </button>
        </form>
      ) : (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5" /> Somente quem toca a implantação registra justificativa.
        </p>
      )}

      {/* Justificativas já registradas ficam logo abaixo do box de criar */}
      <div className="mt-4 flex-1 min-h-0">
        {atrasos.length === 0 ? (
          <p className="text-xs text-muted-foreground/70">Nenhuma justificativa registrada.</p>
        ) : (
          <ul className="space-y-2 border-t border-border pt-3">
            {atrasos.map((d) => (
              <li key={d.id} className="rounded-md border border-border bg-muted/30 px-3 py-2">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium min-w-0">{d.category.nome}</span>
                  <span className="flex items-center gap-1 shrink-0">
                    <span className="text-[11px] text-muted-foreground">{fmtDate(d.at)}</span>
                    {canDelay && <DeleteDelayButton justificativaId={d.id} />}
                  </span>
                </div>
                <div className="mt-1">
                  <StatusBadge status={d.status} dias={d.dias} />
                </div>
                {d.detalhe && <p className="text-xs text-muted-foreground mt-1">{d.detalhe}</p>}
                <p className="text-[11px] text-muted-foreground mt-1">
                  {d.stage.nome} · {d.dias} dia{d.dias === 1 ? "" : "s"}
                  {d.byUser ? ` · ${d.byUser.name}` : ""}
                </p>

                {/* Decisão do coordenador: só aparece enquanto está pendente */}
                {canApprove && d.status === "PENDENTE" && (
                  <div className="flex items-center gap-2 mt-2">
                    <form action={approveDelayJustification} className="flex-1">
                      <input type="hidden" name="justificativaId" value={d.id} />
                      <button className="w-full h-8 inline-flex items-center justify-center gap-1 rounded-md border border-success/40 text-success text-xs font-medium hover:bg-success/10 transition-colors">
                        <Check className="h-3.5 w-3.5" /> Aprovar
                      </button>
                    </form>
                    <form action={rejectDelayJustification} className="flex-1">
                      <input type="hidden" name="justificativaId" value={d.id} />
                      <button className="w-full h-8 inline-flex items-center justify-center gap-1 rounded-md border border-destructive/40 text-destructive text-xs font-medium hover:bg-destructive/10 transition-colors">
                        <X className="h-3.5 w-3.5" /> Negar
                      </button>
                    </form>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
