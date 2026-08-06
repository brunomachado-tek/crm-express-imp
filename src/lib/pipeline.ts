import { db } from "./db";
import type { PipelineStage, TrilhaImplantacao } from "@prisma/client";

// Etapas do funil, agora configuráveis (tabela PipelineStage) e por trilha. A
// ordem é dada pelo campo `ordem`, dentro da trilha. Usada por funil, dashboard,
// stepper e movimentação. Sem argumento, filtra a trilha BASE (todos os projetos
// e etapas atuais são BASE), preservando o comportamento anterior.
export async function loadStages(
  trilha: TrilhaImplantacao = "BASE"
): Promise<PipelineStage[]> {
  return db.pipelineStage.findMany({ where: { trilha }, orderBy: { ordem: "asc" } });
}

// Primeira etapa (menor ordem) da trilha — onde um projeto novo dela entra.
export async function firstStage(
  trilha: TrilhaImplantacao = "BASE"
): Promise<PipelineStage | null> {
  return db.pipelineStage.findFirst({ where: { trilha }, orderBy: { ordem: "asc" } });
}

export function stageLabel(stages: PipelineStage[], stageId: string | null | undefined): string {
  if (!stageId) return "-";
  return stages.find((s) => s.id === stageId)?.nome ?? "-";
}
