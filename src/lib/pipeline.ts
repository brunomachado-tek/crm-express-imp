import { db } from "./db";
import type { PipelineStage } from "@prisma/client";

// Etapas do funil, agora configuráveis (tabela PipelineStage). A ordem é dada
// pelo campo `ordem`. Usada por funil, dashboard, stepper e movimentação.
export async function loadStages(): Promise<PipelineStage[]> {
  return db.pipelineStage.findMany({ orderBy: { ordem: "asc" } });
}

// Primeira etapa (menor ordem) — onde todo projeto novo entra.
export async function firstStage(): Promise<PipelineStage | null> {
  return db.pipelineStage.findFirst({ orderBy: { ordem: "asc" } });
}

export function stageLabel(stages: PipelineStage[], stageId: string | null | undefined): string {
  if (!stageId) return "-";
  return stages.find((s) => s.id === stageId)?.nome ?? "-";
}
