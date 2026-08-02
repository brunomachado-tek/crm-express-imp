import { Check, Lock, PauseCircle } from "lucide-react";
import { moveStage } from "@/lib/actions";
import type { PipelineStage, ProductLine, ProjectStatus } from "@prisma/client";
import type { SlaInfo } from "@/lib/sla";

// Régua da jornada. É o elemento âncora da página, então ganha altura, cor e
// o prazo previsto de cada etapa logo abaixo do rótulo.
export function StageStepper({
  projectId,
  stages,
  stageId,
  status,
  productLine,
  sla,
  checklistDone,
  canMove,
}: {
  projectId: string;
  stages: PipelineStage[];
  stageId: string;
  status: ProjectStatus;
  productLine: ProductLine;
  sla: SlaInfo;
  checklistDone: boolean;
  canMove: boolean;
}) {
  const idx = stages.findIndex((s) => s.id === stageId);
  const stage = stages[idx];
  const pct = stages.length > 1 ? Math.round((idx / (stages.length - 1)) * 100) : 0;
  const isTecfood = productLine === "TECFOOD";
  const accentTop = isTecfood ? "border-t-tecfood" : "border-t-retail";
  const accentBg = isTecfood ? "bg-tecfood" : "bg-retail";
  const accentRing = isTecfood ? "ring-tecfood/25" : "ring-retail/25";
  const accentText = isTecfood ? "text-tecfood" : "text-retail";
  const nextStage = stages[idx + 1];
  const prevStage = stages[idx - 1];
  const minWidth = Math.max(880, stages.length * 108);

  // Situação do prazo da etapa atual, que dá a cor do destaque.
  const ideal = stage?.idealDays ?? null;
  const estourou = ideal != null && sla.diasTeknisa > ideal;
  const apertado = ideal != null && !estourou && sla.diasTeknisa >= ideal * 0.8;

  return (
    <div className={`bg-card border border-border border-t-4 ${accentTop} rounded-xl p-6 shadow-sm`}>
      {/* Cabeçalho: onde está, quanto andou */}
      <div className="flex items-end justify-between gap-4 mb-6 flex-wrap">
        <div>
          <p className={`text-[11px] font-bold uppercase tracking-widest ${accentText}`}>
            Etapa {idx + 1} de {stages.length}
          </p>
          <h2 className="font-display text-2xl font-bold leading-tight mt-0.5">{stage?.nome}</h2>
          {ideal != null && (
            <p className="text-sm text-muted-foreground mt-1">
              Prazo para avançar desta etapa: <strong className="text-foreground">{ideal} dias</strong>
              {" · "}
              <em className={estourou ? "text-destructive font-semibold" : apertado ? "text-warning font-semibold" : "text-success font-semibold"}>
                {estourou
                  ? `${sla.diasTeknisa - ideal} dias além do previsto`
                  : `${sla.diasTeknisa} dias corridos até aqui`}
              </em>
            </p>
          )}
        </div>
        <div className="min-w-[180px]">
          <div className="flex items-baseline justify-between gap-2 mb-1.5">
            <span className="text-xs font-medium text-muted-foreground">Jornada</span>
            <span className={`text-lg font-bold ${accentText}`}>{pct}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className={`h-full rounded-full ${accentBg} transition-all`} style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      {/* Régua das etapas. O prazo NÃO fica embaixo da etapa: fica no conector
          entre duas etapas, porque é o tempo para SAIR de uma e chegar à
          próxima (ex.: 3 dias para ir de "Contrato assinado" a "Validação").
          `overflow-x-auto` também corta na vertical, daí o padding no topo. */}
      <div className="overflow-x-auto px-1 pt-6 pb-2">
        <ol className="flex" style={{ minWidth }}>
          {stages.map((s, i) => {
            const state = i < idx ? "done" : i === idx ? "current" : "next";
            // Conector à esquerda desta etapa = transição da etapa anterior para
            // esta. O prazo mostrado é o da etapa anterior (tempo para avançar).
            const anterior = i > 0 ? stages[i - 1] : null;
            const prazoTransicao = anterior?.idealDays ?? null;
            const transicaoAtual = i - 1 === idx; // saindo da etapa atual
            const pillCor = transicaoAtual
              ? estourou
                ? "bg-destructive text-white"
                : apertado
                  ? "bg-warning-bg text-foreground"
                  : `${accentBg} text-white`
              : i <= idx
                ? "bg-success/15 text-success"
                : "bg-muted text-muted-foreground";
            return (
              <li key={s.id} className="flex-1 relative flex flex-col items-center">
                {i > 0 && (
                  <span
                    aria-hidden
                    className={`absolute top-[19px] right-1/2 w-full h-[3px] rounded-full ${
                      i <= idx ? "bg-success" : "bg-border"
                    }`}
                  />
                )}
                {/* Prazo da transição, centrado no conector, entre as duas etapas. */}
                {i > 0 && (
                  <span
                    className={`absolute top-[9px] left-0 -translate-x-1/2 z-20 rounded-full px-2 py-0.5 text-[10px] font-semibold shadow-sm ${pillCor}`}
                    title={
                      prazoTransicao != null
                        ? `${prazoTransicao} dias para ir de "${anterior?.nome}" a "${s.nome}"`
                        : "Sem prazo definido para esta transição"
                    }
                  >
                    {prazoTransicao != null ? `${prazoTransicao}d` : "livre"}
                  </span>
                )}
                <span
                  className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold transition-all ${
                    state === "done"
                      ? "bg-success text-white shadow-sm"
                      : state === "current"
                        ? `${accentBg} text-white ring-4 ${accentRing} shadow-md scale-110`
                        : "bg-card border-2 border-border text-muted-foreground"
                  }`}
                >
                  {state === "done" ? <Check className="h-5 w-5" strokeWidth={3} /> : i + 1}
                </span>

                <span
                  className={`mt-2.5 text-[11px] leading-tight text-center px-1 ${
                    state === "current"
                      ? `font-bold ${accentText}`
                      : state === "done"
                        ? "font-medium text-foreground/70"
                        : "text-muted-foreground"
                  }`}
                >
                  {s.nome}
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Rodapé: relógio da etapa e movimentação */}
      <div className="flex items-center justify-between gap-3 mt-5 pt-4 border-t border-border flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
              estourou
                ? "bg-destructive/10 text-destructive"
                : apertado
                  ? "bg-warning-bg/20 text-warning"
                  : "bg-success/10 text-success"
            }`}
          >
            {sla.diasNaEtapa} dias nesta etapa
            {ideal != null && <span className="font-normal opacity-80">de {ideal} previstos</span>}
          </span>
          {sla.diasNaEtapa !== sla.diasTeknisa && (
            <span className="text-xs text-muted-foreground">
              <strong className="text-foreground/70">{sla.diasTeknisa}d</strong> sob controle Teknisa
            </span>
          )}
          {status === "PAUSADO" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-warning-bg/20 px-3 py-1 text-xs font-bold text-warning">
              <PauseCircle className="h-3.5 w-3.5" /> Pausado, relógio parado
            </span>
          )}
        </div>

        {/* A régua fica visível para todos; mover a etapa é de quem toca a
            implantação. A action confere de novo no servidor. */}
        <div className="flex items-center gap-2">
          {!canMove && (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Lock className="h-3.5 w-3.5" />
              Somente o(a) consultor(a) responsável, a coordenação ou a diretoria movem a etapa.
            </span>
          )}
          {canMove && prevStage && (
            <form action={moveStage}>
              <input type="hidden" name="projectId" value={projectId} />
              <input type="hidden" name="toStageId" value={prevStage.id} />
              <button className="h-10 px-3.5 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                ← {prevStage.nome}
              </button>
            </form>
          )}
          {canMove && nextStage && status === "ATIVO" && (
            <form action={moveStage}>
              <input type="hidden" name="projectId" value={projectId} />
              <input type="hidden" name="toStageId" value={nextStage.id} />
              <button
                className={`h-10 px-5 inline-flex items-center gap-1.5 rounded-lg text-xs font-bold transition-all ${
                  checklistDone
                    ? "bg-primary text-primary-foreground hover:bg-primary-hover shadow-sm hover:shadow"
                    : "bg-muted text-muted-foreground"
                }`}
                title={checklistDone ? undefined : "Conclua o checklist da etapa para avançar"}
              >
                {!checklistDone && <Lock className="h-3.5 w-3.5" />}
                Avançar para {nextStage.nome} →
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
