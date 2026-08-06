import { daysBetween } from "./format";
import type { Contract, PipelineStage, Project, ProjectPause } from "@prisma/client";

export type SlaInfo = {
  diasNaEtapa: number; // dias corridos totais na etapa atual
  diasTeknisa: number; // descontando pausas (pendência do cliente / projeto pausado)
  idealDays: number | null;
  atrasado: boolean;
};

type ProjectWithStage = Pick<Project, "stageEnteredAt"> & {
  pauses: ProjectPause[];
  stage: Pick<PipelineStage, "idealDays" | "isFinal">;
};

// Soma os dias de atraso já aprovados pelo coordenador. Só o que está APROVADA
// desconta do prazo; pendente e negada não contam.
// `stageId` opcional: quando passado, conta só as justificativas daquela etapa.
// É o que evita um atraso aprovado numa etapa anterior seguir descontando a
// etapa atual (o relógio da etapa reinicia a cada avanço). O marco contratual,
// por ser prazo total da implantação, soma tudo (chama sem stageId).
export function somaDescontoAprovado(
  delays: { status: string; dias: number; stageId?: string }[],
  stageId?: string
): number {
  return delays.reduce((s, d) => {
    if (d.status !== "APROVADA") return s;
    if (stageId !== undefined && d.stageId !== stageId) return s;
    return s + (d.dias ?? 0);
  }, 0);
}

// `descontoDias`: dias de atraso aprovados pelo coordenador, que viram folga extra
// no relógio da etapa (mesma ideia de uma pausa autorizada).
export function slaFor(project: ProjectWithStage, now = new Date(), descontoDias = 0): SlaInfo {
  const entered = new Date(project.stageEnteredAt);
  const diasNaEtapa = Math.max(0, daysBetween(entered, now));

  // desconta períodos de pausa que intersectam a etapa atual
  let pausedMs = 0;
  for (const p of project.pauses) {
    const start = new Date(Math.max(new Date(p.startedAt).getTime(), entered.getTime()));
    const end = p.endedAt ? new Date(p.endedAt) : now;
    if (end > start) pausedMs += end.getTime() - start.getTime();
  }
  const diasTeknisa = Math.max(
    0,
    diasNaEtapa - Math.floor(pausedMs / (24 * 60 * 60 * 1000)) - Math.max(0, descontoDias)
  );

  const idealDays = project.stage.idealDays ?? null;

  return {
    diasNaEtapa,
    diasTeknisa,
    idealDays,
    atrasado: idealDays != null && diasTeknisa > idealDays && !project.stage.isFinal,
  };
}

// Marcos contratuais (cláusula SERVIÇO do contrato LUSO)
export type ContractMilestone = {
  tipo: "TREINAMENTO_2M";
  label: string;
  curto: string; // rótulo enxuto para o card
  deadline: Date;
  diasRestantes: number;
  totalDias: number; // tamanho da janela contratual, para medir o quanto já correu
  critico: boolean;
};

// O prazo do treinamento vem da cláusula SERVIÇO do contrato e varia por
// cliente. Prioriza o contrato LUSO (onde a cláusula vive); se não houver
// valor, cai no padrão de 60 dias.
const PRAZO_TREINAMENTO_PADRAO = 60;

export function contractMilestones(
  project: Pick<Project, "dataContrato" | "status"> & {
    stage: Pick<PipelineStage, "isFinal">;
    contracts?: Pick<Contract, "kind" | "prazoTreinamentoDias">[];
  },
  now = new Date(),
  descontoDias = 0
): ContractMilestone[] {
  if (!project.dataContrato || project.status !== "ATIVO") return [];
  if (project.stage.isFinal) return [];
  const assinatura = new Date(project.dataContrato);

  const luso = project.contracts?.find((c) => c.kind === "LUSO");
  const doContrato = luso?.prazoTreinamentoDias ?? project.contracts?.[0]?.prazoTreinamentoDias;
  // Dias de atraso aprovados esticam a janela contratual do treinamento.
  const JANELA_DIAS = (doContrato ?? PRAZO_TREINAMENTO_PADRAO) + Math.max(0, descontoDias);
  const t2m = new Date(assinatura.getTime() + JANELA_DIAS * 24 * 60 * 60 * 1000);
  return [
    {
      tipo: "TREINAMENTO_2M",
      label: `Prazo contratual do treinamento (${JANELA_DIAS} dias da assinatura)`,
      curto: "Treinamento contratual",
      deadline: t2m,
      diasRestantes: daysBetween(now, t2m),
      totalDias: JANELA_DIAS,
      critico: daysBetween(now, t2m) < 15,
    },
  ];
}
