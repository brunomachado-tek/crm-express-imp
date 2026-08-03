import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canEditPipeline } from "@/lib/permissions";
import {
  addPipelineStage,
  savePipelineStage,
  savePipelineTransicao,
  movePipelineStage,
  deletePipelineStage,
} from "@/lib/actions";
import {
  ArrowDown,
  ChevronDown,
  ChevronUp,
  Flag,
  Plus,
  Timer,
  Trash2,
  Workflow,
} from "lucide-react";

const fieldLabel = "text-xs font-medium text-muted-foreground";
const fieldInput =
  "w-full h-9 rounded-md border border-border bg-muted/50 px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40";

// Botão de inserir etapa numa posição (à esquerda/direita de uma referência).
function InsertButton({
  refId,
  lado,
  texto,
}: {
  refId: string | null;
  lado: "left" | "right";
  texto: string;
}) {
  return (
    <form action={addPipelineStage} className="flex justify-center">
      <input type="hidden" name="lado" value={lado} />
      {refId && <input type="hidden" name="refId" value={refId} />}
      <button
        type="submit"
        className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1 text-xs font-medium text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
      >
        <Plus className="h-3.5 w-3.5" /> {texto}
      </button>
    </form>
  );
}

export default async function PipelinePage() {
  const user = await requireUser();
  const canEdit = canEditPipeline(user);
  const stages = await db.pipelineStage.findMany({ orderBy: { ordem: "asc" } });

  // contagem de projetos por etapa, para avisar antes de apagar
  const counts = await db.project.groupBy({
    by: ["stageId"],
    where: { deleted: false },
    _count: { _all: true },
  });
  const countByStage = new Map(counts.map((c) => [c.stageId, c._count._all]));

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold inline-flex items-center gap-2">
          <Workflow className="h-6 w-6 text-primary" /> Pipeline
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          As etapas do funil de implantação. Crie, renomeie, reordene ou apague. O prazo fica{" "}
          <strong className="text-foreground">entre as etapas</strong>: é o tempo para sair de uma e
          chegar à próxima. Vale para os dois funis (TecFood e Retail).
        </p>
      </div>

      {!canEdit && (
        <div className="rounded-md border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          Somente a diretoria edita a pipeline. Você está vendo a configuração atual.
        </div>
      )}

      <div className="space-y-3">
        {canEdit && <InsertButton refId={stages[0]?.id ?? null} lado="left" texto="Etapa no início" />}

        {stages.map((s, i) => {
          const nProjetos = countByStage.get(s.id) ?? 0;
          return (
            <div key={s.id}>
              <div className="bg-card border border-border rounded-lg p-4">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-foreground/70">
                      {i + 1}
                    </span>
                    {s.isFinal && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-success/10 text-success px-2 py-0.5">
                        <Flag className="h-3 w-3" /> etapa final
                      </span>
                    )}
                    <span className="text-muted-foreground/70">
                      {nProjetos} projeto{nProjetos === 1 ? "" : "s"}
                    </span>
                  </span>
                  {canEdit && (
                    <div className="flex items-center gap-1">
                      <form action={movePipelineStage}>
                        <input type="hidden" name="stageId" value={s.id} />
                        <input type="hidden" name="dir" value="left" />
                        <button
                          type="submit"
                          disabled={i === 0}
                          title="Mover para antes"
                          className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-border hover:bg-muted disabled:opacity-30 disabled:pointer-events-none"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </button>
                      </form>
                      <form action={movePipelineStage}>
                        <input type="hidden" name="stageId" value={s.id} />
                        <input type="hidden" name="dir" value="right" />
                        <button
                          type="submit"
                          disabled={i === stages.length - 1}
                          title="Mover para depois"
                          className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-border hover:bg-muted disabled:opacity-30 disabled:pointer-events-none"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </button>
                      </form>
                      <form action={deletePipelineStage}>
                        <input type="hidden" name="stageId" value={s.id} />
                        <button
                          type="submit"
                          title={nProjetos > 0 ? "Apagar (projetos vão para a etapa vizinha)" : "Apagar etapa"}
                          className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-destructive/30 text-destructive hover:bg-destructive/5"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </form>
                    </div>
                  )}
                </div>

                {canEdit ? (
                  <form action={savePipelineStage} className="grid sm:grid-cols-[1fr_auto] gap-3 items-end">
                    <input type="hidden" name="stageId" value={s.id} />
                    <div className="space-y-1.5">
                      <label className={fieldLabel}>Nome da etapa</label>
                      <input name="nome" defaultValue={s.nome} required className={fieldInput} />
                    </div>
                    <div className="flex items-center gap-3 h-9">
                      <label className="inline-flex items-center gap-1.5 text-sm text-foreground/80">
                        <input
                          type="checkbox"
                          name="isFinal"
                          defaultChecked={s.isFinal}
                          className="accent-[#040486]"
                        />
                        Final
                      </label>
                      <button
                        type="submit"
                        className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary-hover transition-colors"
                      >
                        Salvar
                      </button>
                    </div>
                  </form>
                ) : (
                  <p className="text-sm font-medium">{s.nome}</p>
                )}
              </div>

              {/* Transição para a próxima etapa: o prazo mora aqui, entre as duas.
                  Só existe quando há uma próxima etapa (a última não tem saída). */}
              {i < stages.length - 1 && (
                <div className="flex items-center gap-3 pl-5 py-2">
                  <ArrowDown className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                  {canEdit ? (
                    <form action={savePipelineTransicao} className="flex items-end gap-2">
                      <input type="hidden" name="stageId" value={s.id} />
                      <div className="space-y-1">
                        <label className={fieldLabel}>
                          Prazo para avançar para <strong className="text-foreground">{stages[i + 1].nome}</strong>
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            name="idealDays"
                            type="number"
                            min={0}
                            defaultValue={s.idealDays ?? ""}
                            placeholder="sem prazo"
                            className={`${fieldInput} w-24`}
                          />
                          <span className="text-sm text-muted-foreground">dias</span>
                          <button
                            type="submit"
                            className="h-9 px-3 rounded-md border border-border text-sm font-medium hover:bg-muted transition-colors"
                          >
                            Salvar
                          </button>
                        </div>
                      </div>
                    </form>
                  ) : (
                    <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
                      <Timer className="h-3.5 w-3.5" />
                      {s.idealDays != null
                        ? `${s.idealDays} dias para avançar para ${stages[i + 1].nome}`
                        : `sem prazo definido para avançar para ${stages[i + 1].nome}`}
                    </p>
                  )}
                  {canEdit && (
                    <div className="ml-auto">
                      <InsertButton refId={s.id} lado="right" texto="Etapa aqui" />
                    </div>
                  )}
                </div>
              )}
              {/* Depois da última etapa, só o botão de inserir. */}
              {canEdit && i === stages.length - 1 && (
                <div className="py-2">
                  <InsertButton refId={s.id} lado="right" texto="Etapa no fim" />
                </div>
              )}
            </div>
          );
        })}

        {stages.length === 0 && canEdit && (
          <InsertButton refId={null} lado="right" texto="Criar primeira etapa" />
        )}
      </div>

      {canEdit && (
        <p className="text-xs text-muted-foreground">
          Uma etapa marcada como <strong>final</strong> conta o projeto como concluído (sai da
          contagem de ativos e para o relógio de SLA). Ao apagar uma etapa, os projetos que estavam
          nela vão para a etapa vizinha.
        </p>
      )}
    </div>
  );
}
