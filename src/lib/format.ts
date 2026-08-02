import type { ProductLine, Role } from "@prisma/client";

export const PRODUCT_LABELS: Record<ProductLine, string> = {
  TECFOOD: "TecFood",
  RETAIL: "Retail",
};

export const ROLE_LABELS: Record<Role, string> = {
  DIRETORIA: "Diretoria",
  COORDENACAO: "Coordenação",
  CONSULTOR: "Consultor(a)",
  CS: "Customer Success",
};

export const STATUS_LABELS: Record<string, string> = {
  ATIVO: "Ativo",
  PAUSADO: "Pausado",
  CANCELADO: "Cancelado",
  PENDENTE: "Pendente",
  EM_ANDAMENTO: "Em andamento",
  CONCLUIDA: "Concluída",
  CANCELADA: "Cancelada",
};

export const RESPONSAVEL_LABELS: Record<string, string> = {
  TEKNISA: "Teknisa",
  CLIENTE: "Cliente",
  AMBOS: "Ambos",
};

export function brl(v: number | null | undefined) {
  if (v == null) return "não informado";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function fmtDate(d: Date | string | null | undefined) {
  if (!d) return "não informado";
  const date = new Date(d);
  // Datas "puras" (ex.: assinatura de contrato) são armazenadas à meia-noite UTC;
  // exibi-las no fuso local recuaria um dia no Brasil.
  const isDateOnly =
    date.getUTCHours() === 0 && date.getUTCMinutes() === 0 && date.getUTCSeconds() === 0;
  return date.toLocaleDateString("pt-BR", isDateOnly ? { timeZone: "UTC" } : undefined);
}

export function daysBetween(a: Date, b: Date) {
  return Math.floor((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000));
}

export function daysAgo(d: Date | string) {
  return daysBetween(new Date(d), new Date());
}
