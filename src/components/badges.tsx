import type { ProductLine, ProjectStatus } from "@prisma/client";
import { PRODUCT_LABELS, STATUS_LABELS } from "@/lib/format";
import type { SlaInfo } from "@/lib/sla";
import { AlertTriangle, Clock } from "lucide-react";

export function ProductBadge({ line }: { line: ProductLine }) {
  const color = line === "TECFOOD" ? "bg-tecfood/10 text-tecfood" : "bg-retail/10 text-retail";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {PRODUCT_LABELS[line]}
    </span>
  );
}

export function StageBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent">
      {label}
    </span>
  );
}

export function StatusBadge({ status }: { status: ProjectStatus }) {
  if (status === "ATIVO") return null;
  const cls =
    status === "PAUSADO"
      ? "bg-warning-bg/20 text-warning"
      : "bg-destructive/10 text-destructive";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${cls}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

export function SlaChip({ sla }: { sla: SlaInfo }) {
  if (sla.atrasado) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 text-destructive px-2 py-0.5 text-xs font-bold">
        <AlertTriangle className="h-3 w-3" />
        <strong>{sla.diasTeknisa}d</strong> na etapa
        <span className="font-normal opacity-80">(ideal {sla.idealDays}d)</span>
      </span>
    );
  }
  // dentro do prazo, mas já em cima da hora
  const apertado = sla.idealDays != null && sla.diasTeknisa >= sla.idealDays * 0.8;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
        apertado ? "bg-warning-bg/20 text-warning" : "bg-success/10 text-success"
      }`}
    >
      <Clock className="h-3 w-3" />
      <strong>{sla.diasNaEtapa}d</strong> na etapa
      {sla.idealDays != null && <span className="font-normal opacity-80">de {sla.idealDays}d</span>}
    </span>
  );
}

export function AditivoBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-warning/10 text-warning px-2 py-0.5 text-xs font-semibold uppercase tracking-wider">
      Aditivo
    </span>
  );
}
