import { daysBetween } from "./format";
import type { PipelineStage, Project, StageTransition } from "@prisma/client";

// Métricas agregadas do dashboard. Funções puras: recebem os dados já buscados
// e devolvem números, para a página ficar só com a leitura e o layout.

type ConcluidoTempo = Pick<Project, "dataContrato" | "dataFinalizacao">;

// Atalhos de período do filtro do dashboard. Fica aqui (fora do componente)
// porque usa a data atual, e o lint de pureza não permite `new Date()` no
// corpo de um componente.
export function atalhosPeriodo(agora = new Date()): { label: string; de: string; ate: string }[] {
  const dia = 24 * 60 * 60 * 1000;
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return [
    { label: "30 dias", de: iso(new Date(agora.getTime() - 30 * dia)), ate: iso(agora) },
    { label: "90 dias", de: iso(new Date(agora.getTime() - 90 * dia)), ate: iso(agora) },
    { label: "Este ano", de: `${agora.getFullYear()}-01-01`, ate: iso(agora) },
  ];
}

function media(xs: number[]): number | null {
  if (xs.length === 0) return null;
  return Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);
}

// Dias de implantação de um projeto concluído: assinatura → finalização,
// dias corridos. Só conta quando as duas datas existem.
function duracaoImplantacao(p: ConcluidoTempo): number | null {
  if (!p.dataContrato || !p.dataFinalizacao) return null;
  const d = daysBetween(new Date(p.dataContrato), new Date(p.dataFinalizacao));
  return d >= 0 ? d : null;
}

// SLA médio de implantação (assinatura → go-live), dias corridos.
export function mediaImplantacao(concluidos: ConcluidoTempo[]): {
  mediaDias: number | null;
  n: number;
} {
  const dur = concluidos.map(duracaoImplantacao).filter((d): d is number => d != null);
  return { mediaDias: media(dur), n: dur.length };
}

// Tendência do SLA médio por mês de finalização (últimos `meses` meses).
export type PontoTendencia = { rotulo: string; media: number | null; n: number };
export function tendenciaImplantacao(
  concluidos: ConcluidoTempo[],
  meses = 6,
  agora = new Date()
): PontoTendencia[] {
  const pontos: PontoTendencia[] = [];
  for (let i = meses - 1; i >= 0; i--) {
    const ref = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
    const dur = concluidos
      .filter((p) => {
        if (!p.dataFinalizacao) return false;
        const f = new Date(p.dataFinalizacao);
        return f.getFullYear() === ref.getFullYear() && f.getMonth() === ref.getMonth();
      })
      .map(duracaoImplantacao)
      .filter((d): d is number => d != null);
    pontos.push({
      rotulo: ref.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
      media: media(dur),
      n: dur.length,
    });
  }
  return pontos;
}

// Contagem por mês (últimos `meses`), a partir de um campo de data. Serve para
// "concluídos por mês" (dataFinalizacao) e "novos contratos por mês"
// (dataContrato).
export type PontoContagem = { rotulo: string; n: number };
export function contagemPorMes<T>(
  itens: T[],
  data: (t: T) => Date | null | undefined,
  meses = 6,
  agora = new Date()
): PontoContagem[] {
  const pontos: PontoContagem[] = [];
  for (let i = meses - 1; i >= 0; i--) {
    const ref = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
    const n = itens.filter((t) => {
      const d = data(t);
      if (!d) return false;
      const dd = new Date(d);
      return dd.getFullYear() === ref.getFullYear() && dd.getMonth() === ref.getMonth();
    }).length;
    pontos.push({ rotulo: ref.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""), n });
  }
  return pontos;
}

// Aging dos projetos ativos: há quanto tempo estão em implantação (da assinatura
// até hoje), agrupado em faixas.
export type FaixaAging = { rotulo: string; n: number; alerta: boolean };
export function agingAtivos(
  ativos: { dataContrato: Date | null }[],
  agora = new Date()
): { faixas: FaixaAging[]; medianaDias: number | null } {
  const dias = ativos
    .map((p) => (p.dataContrato ? daysBetween(new Date(p.dataContrato), agora) : null))
    .filter((d): d is number => d != null && d >= 0);
  const conta = (min: number, max: number) => dias.filter((d) => d >= min && d < max).length;
  const faixas: FaixaAging[] = [
    { rotulo: "até 30 dias", n: conta(0, 30), alerta: false },
    { rotulo: "30 a 60", n: conta(30, 60), alerta: false },
    { rotulo: "60 a 90", n: conta(60, 90), alerta: true },
    { rotulo: "90 dias ou mais", n: conta(90, Infinity), alerta: true },
  ];
  const ordenado = [...dias].sort((a, b) => a - b);
  const mediana = ordenado.length ? ordenado[Math.floor(ordenado.length / 2)] : null;
  return { faixas, medianaDias: mediana };
}

// Dias de cada pausa (pendência do cliente). Encerradas contam do início ao
// fim; abertas, do início até agora. Fica aqui porque usa a data atual.
export function diasDePausa(
  pausas: { startedAt: Date; endedAt: Date | null }[],
  agora = new Date()
): number[] {
  const agoraMs = agora.getTime();
  return pausas.map((pa) => {
    const ini = new Date(pa.startedAt).getTime();
    const fim = pa.endedAt ? new Date(pa.endedAt).getTime() : agoraMs;
    return Math.max(0, Math.floor((fim - ini) / (24 * 60 * 60 * 1000)));
  });
}

// Tempo médio por etapa, a partir do histórico de transições. O tempo numa
// etapa vai do momento em que o projeto entrou (transição que aponta para ela)
// até a transição seguinte. Só conta visitas já encerradas (com transição de
// saída), para medir quanto os projetos levaram para deixar cada etapa: a de
// maior média é o gargalo.
export type TempoEtapa = { stage: PipelineStage; mediaDias: number | null; n: number };
export function tempoMedioPorEtapa(
  transitions: Pick<StageTransition, "projectId" | "toStageId" | "at">[],
  stages: PipelineStage[]
): TempoEtapa[] {
  const porProjeto = new Map<string, { toStageId: string; at: Date }[]>();
  for (const t of transitions) {
    const arr = porProjeto.get(t.projectId) ?? [];
    arr.push({ toStageId: t.toStageId, at: new Date(t.at) });
    porProjeto.set(t.projectId, arr);
  }
  const dur = new Map<string, number[]>();
  for (const arr of porProjeto.values()) {
    arr.sort((a, b) => a.at.getTime() - b.at.getTime());
    for (let i = 0; i + 1 < arr.length; i++) {
      const d = daysBetween(arr[i].at, arr[i + 1].at);
      if (d < 0) continue;
      const l = dur.get(arr[i].toStageId) ?? [];
      l.push(d);
      dur.set(arr[i].toStageId, l);
    }
  }
  return stages
    .filter((s) => !s.isFinal)
    .map((s) => {
      const l = dur.get(s.id) ?? [];
      return { stage: s, mediaDias: media(l), n: l.length };
    });
}
