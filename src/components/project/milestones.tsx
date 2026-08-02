import { AlarmClock, AlertTriangle, CalendarClock, CheckCircle2 } from "lucide-react";
import { fmtDate } from "@/lib/format";
import type { ContractMilestone } from "@/lib/sla";

// Sem marco pendente o card continua existindo, para a linha de três colunas
// não ficar com um buraco.
export function SemMarcoCard() {
  return (
    <div className="relative h-full overflow-hidden rounded-lg border border-success/30 bg-success/[0.05] p-5 flex flex-col justify-between">
      <span aria-hidden className="absolute left-0 top-0 bottom-0 w-1 bg-success" />
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-success">
          Prazo contratual
        </p>
        <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-semibold text-success">
          <CheckCircle2 className="h-3 w-3" /> Em dia
        </span>
      </div>
      <div className="flex items-center gap-3 py-2">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
          <CheckCircle2 className="h-5 w-5" />
        </span>
        <p className="font-display text-xl font-semibold leading-tight">Sem prazo em risco</p>
      </div>
      <p className="text-xs text-muted-foreground">Nenhum marco contratual pendente neste momento.</p>
    </div>
  );
}

export function MilestoneCard({ milestone: m }: { milestone: ContractMilestone }) {
  const vencido = m.diasRestantes < 0;
  const tone = vencido ? "vencido" : m.critico ? "atencao" : "ok";
  const dias = Math.abs(m.diasRestantes);

  // quanto da janela contratual já correu (limitado a 100%)
  const diasUsados = Math.max(0, m.totalDias - m.diasRestantes);
  const decorrido = Math.min(100, (diasUsados / m.totalDias) * 100);

  const estilo = {
    vencido: {
      card: "border-destructive/40 bg-destructive/[0.06]",
      barraLateral: "bg-destructive",
      rotulo: "text-destructive",
      numero: "text-destructive",
      chip: "bg-destructive text-white",
      icone: "bg-destructive/15 text-destructive",
      progresso: "bg-destructive",
      Icon: AlertTriangle,
      situacao: "Vencido",
    },
    atencao: {
      card: "border-warning-bg/60 bg-warning-bg/10",
      barraLateral: "bg-warning-bg",
      rotulo: "text-warning",
      numero: "text-warning",
      chip: "bg-warning-bg text-foreground",
      icone: "bg-warning-bg/25 text-warning",
      progresso: "bg-warning-bg",
      Icon: AlarmClock,
      situacao: "Atenção",
    },
    ok: {
      card: "border-accent/30 bg-accent/[0.05]",
      barraLateral: "bg-accent",
      rotulo: "text-accent",
      numero: "text-accent",
      chip: "bg-accent/15 text-accent",
      icone: "bg-accent/15 text-accent",
      progresso: "bg-accent",
      Icon: CalendarClock,
      situacao: "No prazo",
    },
  }[tone];

  const { Icon } = estilo;

  return (
    <div
      className={`relative h-full overflow-hidden rounded-lg border p-5 flex flex-col justify-between gap-3 ${estilo.card}`}
    >
      <span aria-hidden className={`absolute left-0 top-0 bottom-0 w-1 ${estilo.barraLateral}`} />

      {/* Cabeçalho: rótulo em cinza, cor reservada para a situação */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Prazo contratual
        </p>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold shrink-0 ${estilo.chip}`}
        >
          <Icon className="h-3 w-3" /> {estilo.situacao}
        </span>
      </div>

      {/* O número é a informação principal; só ele carrega a cor forte */}
      <div className="flex items-center gap-3">
        <span
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${estilo.icone}`}
        >
          <Icon className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <p className={`font-display text-4xl font-bold leading-none ${estilo.numero}`}>{dias}</p>
          <p className="text-sm mt-1 text-foreground/70">
            {vencido ? (
              <>
                <strong className="text-foreground">{dias === 1 ? "dia" : "dias"}</strong>{" "}
                <em className={estilo.rotulo}>em atraso</em>
              </>
            ) : (
              <>
                <strong className="text-foreground">
                  {dias === 1 ? "dia restante" : "dias restantes"}
                </strong>
              </>
            )}
          </p>
        </div>
      </div>

      {/* Barra de prazo: números em preto, percentual com a cor da situação */}
      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-2 text-[11px]">
          <span className="text-muted-foreground">
            <strong className="text-foreground">
              {vencido ? m.totalDias : diasUsados} de {m.totalDias}
            </strong>{" "}
            dias usados
          </span>
          <span className={`font-bold ${estilo.rotulo}`}>{Math.round(decorrido)}%</span>
        </div>

        <div
          className="h-2.5 rounded-full bg-card border border-border/60 overflow-hidden"
          role="progressbar"
          aria-valuenow={Math.round(decorrido)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Prazo contratual decorrido"
        >
          <div
            className={`h-full rounded-full transition-all ${estilo.progresso}`}
            style={{ width: `${decorrido}%` }}
          />
        </div>

        <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
          <span className="truncate italic">{m.curto}</span>
          <span className="shrink-0">
            vence <strong className="text-foreground/80 not-italic">{fmtDate(m.deadline)}</strong>
          </span>
        </div>
      </div>
    </div>
  );
}
