import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canEditPipeline } from "@/lib/permissions";
import {
  addPipelineStage,
  savePipelineStage,
  savePipelineTransicao,
  movePipelineStage,
  deletePipelineStage,
  addChecklistTemplate,
  removeChecklistTemplate,
} from "@/lib/actions";
import { SubmitButton } from "@/components/ui/submit-button";
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
  trilha,
}: {
  refId: string | null;
  lado: "left" | "right";
  texto: string;
  trilha: string;
}) {
  return (
    <form action={addPipelineStage} className="flex justify-center">
      <input type="hidden" name="lado" value={lado} />
      <input type="hidden" name="trilha" value={trilha} />
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

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<{ trilha?: string }>;
}) {
  const user = await requireUser();
  const canEdit = canEditPipeline(user);
  const trilha = (await searchParams).trilha === "REDUZIDA" ? "REDUZIDA" : "BASE";
  const stages = await db.pipelineStage.findMany({ where: { trilha }, orderBy: { ordem: "asc" } });

  // contagem de projetos por etapa, para avisar antes de apagar
  const counts = await db.project.groupBy({
    by: ["stageId"],
    where: { deleted: false },
    _count: { _all: true },
  });
  const countByStage = new Map(counts.map((c) => [c.stageId, c._count._all]));

  // Itens de checklist por etapa (o padrão obrigatório instanciado ao entrar nela)
  const tpls = await db.stageChecklistTemplate.findMany({
    where: { active: true },
    orderBy: { ordem: "asc" },
  });
  const tplByStage = new Map<string, typeof tpls>();
  for (const t of tpls) {
    const arr = tplByStage.get(t.stageId) ?? [];
    arr.push(t);
    tplByStage.set(t.stageId, arr);
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold inline-flex items-center gap-2">
          <Workflow className="h-6 w-6 text-primary" /> Pipeline
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          As etapas do funil de implantação. Crie, renomeie, reordene ou apague. O prazo fica{" "}
          <strong className="text-foreground">entre as etapas</strong>: é o tempo para sair de uma e
          chegar à próxima.
        </p>
      </div>

      {/* Trilha: Base (cliente novo) x Reduzida (upsell de cliente existente) */}
      <div className="inline-flex rounded-md border border-border bg-card p-0.5 text-sm">
        {(["BASE", "REDUZIDA"] as const).map((t) => {
          const ativo = trilha === t;
          return (
            <Link
              key={t}
              href={`/pipeline?trilha=${t}`}
              className={`px-3 py-1.5 rounded font-medium transition-colors ${
                ativo ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {t === "BASE" ? "Base" : "Reduzida"}
            </Link>
          );
        })}
      </div>
      {trilha === "REDUZIDA" && (
        <p className="text-xs text-muted-foreground">
          Trilha do upsell (cliente Teknisa contratando novo módulo). Implantação mais curta e sem
          checklist por etapa.
        </p>
      )}

      {!canEdit && (
        <div className="rounded-md border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          Somente a diretoria edita a pipeline. Você está vendo a configuração atual.
        </div>
      )}

      <div className="space-y-3">
        {canEdit && (
          <InsertButton refId={stages[0]?.id ?? null} lado="left" texto="Etapa no início" trilha={trilha} />
        )}

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
                        <input type="hidden" name="trilha" value={trilha} />
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
                        <input type="hidden" name="trilha" value={trilha} />
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
                        <input type="hidden" name="trilha" value={trilha} />
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
                    <input type="hidden" name="trilha" value={trilha} />
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

                {canEdit && trilha === "BASE" && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className={`${fieldLabel} mb-2`}>Checklist obrigatório desta etapa</p>
                    <ul className="space-y-1.5 mb-2">
                      {(tplByStage.get(s.id) ?? []).map((t) => (
                        <li key={t.id} className="flex items-center gap-2 text-sm">
                          <span className="flex-1">{t.titulo}</span>
                          <form action={removeChecklistTemplate}>
                            <input type="hidden" name="id" value={t.id} />
                            <button
                              type="submit"
                              title="Remover item"
                              className="h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/5"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </form>
                        </li>
                      ))}
                      {(tplByStage.get(s.id) ?? []).length === 0 && (
                        <li className="text-xs text-muted-foreground">Nenhum item ainda.</li>
                      )}
                    </ul>
                    <form action={addChecklistTemplate} className="flex items-center gap-2">
                      <input type="hidden" name="stageId" value={s.id} />
                      <input
                        name="titulo"
                        placeholder="Novo item do checklist"
                        className={`${fieldInput} flex-1`}
                      />
                      <SubmitButton
                        pendingLabel="Adicionando..."
                        className="h-9 px-3 rounded-md border border-border text-sm font-medium hover:bg-muted"
                      >
                        <Plus className="h-4 w-4" /> Item
                      </SubmitButton>
                    </form>
                  </div>
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
                      <input type="hidden" name="trilha" value={trilha} />
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
                      <InsertButton refId={s.id} lado="right" texto="Etapa aqui" trilha={trilha} />
                    </div>
                  )}
                </div>
              )}
              {/* Depois da última etapa, só o botão de inserir. */}
              {canEdit && i === stages.length - 1 && (
                <div className="py-2">
                  <InsertButton refId={s.id} lado="right" texto="Etapa no fim" trilha={trilha} />
                </div>
              )}
            </div>
          );
        })}

        {stages.length === 0 && canEdit && (
          <InsertButton refId={null} lado="right" texto="Criar primeira etapa" trilha={trilha} />
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
