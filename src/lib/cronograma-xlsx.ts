// Leitura da planilha de cronograma que as consultoras montam (Excel), para
// criar as atividades do projeto. O formato segue o modelo TecFood: uma aba
// "CRONOGRAMA" com as colunas Módulo/Fase, Atividade, Agenda, Início, Término,
// Status. Cada linha de atividade vira uma atividade do CRM, com a data
// prevista (Término, ou Início/Agenda como reserva) e o status.

import type { ActivityStatus } from "@prisma/client";

export type AtividadePlanilha = {
  titulo: string;
  fase: string | null;
  dueDate: string | null; // aaaa-mm-dd
  status: ActivityStatus;
};

export type LeituraCronograma =
  | { ok: false; erro: string }
  | { ok: true; atividades: AtividadePlanilha[] };

function isoDeCelula(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return null;
}

function mapStatus(v: unknown): ActivityStatus {
  const s = String(v ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (s.includes("conclu")) return "CONCLUIDA";
  if (s.includes("andamento")) return "EM_ANDAMENTO";
  if (s.includes("cancel")) return "CANCELADA";
  return "PENDENTE"; // "a iniciar", "aguardando", vazio
}

export async function lerCronogramaPlanilha(bytes: Uint8Array): Promise<LeituraCronograma> {
  let linhas: unknown[][];
  try {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(bytes, { type: "array", cellDates: true });
    // Prefere a aba "CRONOGRAMA"; senão, a última (o modelo tem relatório + cronograma).
    const nome =
      wb.SheetNames.find((n) => /cronograma/i.test(n)) ?? wb.SheetNames[wb.SheetNames.length - 1];
    const ws = wb.Sheets[nome];
    if (!ws) return { ok: false, erro: "A planilha não tem nenhuma aba legível." };
    linhas = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false }) as unknown[][];
  } catch {
    return { ok: false, erro: "Não foi possível abrir a planilha. Envie um arquivo .xlsx." };
  }

  const atividades: AtividadePlanilha[] = [];
  let faseAtual: string | null = null;

  for (const row of linhas) {
    const colA = String(row[0] ?? "").trim();
    const colB = String(row[1] ?? "").trim();

    // Cabeçalho da planilha ("Módulo - Fase" na coluna A): ignora.
    if (/^m[óo]dulo\s*-\s*fase$/i.test(colA)) continue;
    // Linha de fase: "Fase N - Nome" na coluna A, sem atividade na B.
    if (/^fase\s+\d/i.test(colA) && !colB) {
      faseAtual = colA.replace(/^fase\s+\d+\s*-\s*/i, "").trim() || colA;
      continue;
    }
    // Cabeçalho / linhas sem atividade: ignora.
    if (!colB) continue;
    if (/^(m[óo]dulo\s*-\s*fase|atividade)$/i.test(colB)) continue;

    // colA pode trazer o nome do módulo na primeira linha da fase; usa como fase
    // se ainda não houver uma fase corrente.
    const fase = faseAtual ?? (colA && !/^fase/i.test(colA) ? colA : null);
    const dueDate = isoDeCelula(row[4]) ?? isoDeCelula(row[2]) ?? isoDeCelula(row[3]); // Término, Agenda, Início
    atividades.push({ titulo: colB, fase, dueDate, status: mapStatus(row[5]) });
  }

  if (atividades.length === 0) {
    return {
      ok: false,
      erro: "Não encontrei atividades na planilha. Confira se ela segue o modelo do cronograma.",
    };
  }
  return { ok: true, atividades };
}
