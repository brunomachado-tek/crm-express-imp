import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { slaFor, contractMilestones } from "@/lib/sla";
import { loadStages } from "@/lib/pipeline";
import {
  agingAtivos,
  atalhosPeriodo,
  contagemPorMes,
  diasDePausa,
  mediaImplantacao,
  tendenciaImplantacao,
  tempoMedioPorEtapa,
  type FaixaAging,
  type PontoContagem,
} from "@/lib/metrics";
import { PRODUCT_LABELS, brl } from "@/lib/format";
import { ProductBadge } from "@/components/badges";
import type { ProductLine } from "@prisma/client";
import {
  AlertTriangle,
  Ban,
  CalendarClock,
  CheckCircle2,
  Clock,
  FolderKanban,
  Gauge,
  PauseCircle,
  Receipt,
  Timer,
  TrendingUp,
  UserRound,
} from "lucide-react";

const ABAS = [
  { id: "geral", label: "Geral" },
  { id: "sla", label: "SLA e Gargalos" },
  { id: "vazao", label: "Vazão e volume" },
  { id: "qualidade", label: "Qualidade e causas" },
  { id: "pessoas", label: "Pessoas" },
] as const;
type AbaId = (typeof ABAS)[number]["id"];

// Semântica de cor por prazo (regra do gestor): verde com folga, amarelo no
// limite (1 dia antes ou no dia), vermelho a partir de 1 dia após o prazo.
// `restante` = dias até o prazo (prazo - usado).
type Tom = "verde" | "amarelo" | "vermelho" | "neutro";
function tomPrazo(restante: number | null): Tom {
  if (restante == null) return "neutro";
  if (restante <= -1) return "vermelho";
  if (restante <= 1) return "amarelo";
  return "verde";
}
const TOM_TEXTO: Record<Tom, string> = {
  verde: "text-success",
  amarelo: "text-warning",
  vermelho: "text-destructive",
  neutro: "text-muted-foreground",
};
const TOM_BARRA: Record<Tom, string> = {
  verde: "bg-success",
  amarelo: "bg-warning-bg",
  vermelho: "bg-destructive",
  neutro: "bg-muted-foreground/40",
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ de?: string; ate?: string; produto?: string; aba?: string }>;
}) {
  const user = await requireUser();
  const { de, ate, produto, aba } = await searchParams;

  // Produto vira página: a coordenação (e demais papéis com produto) vê só o
  // seu; diretoria e quem não tem produto veem os dois.
  const produtosVisiveis: ProductLine[] = user.productLine ? [user.productLine] : ["TECFOOD", "RETAIL"];
  const produtoSel: ProductLine =
    produto === "TECFOOD" || produto === "RETAIL"
      ? produtosVisiveis.includes(produto as ProductLine)
        ? (produto as ProductLine)
        : produtosVisiveis[0]
      : produtosVisiveis[0];

  const abaSel: AbaId = ABAS.some((a) => a.id === aba) ? (aba as AbaId) : "geral";

  // Preserva produto/aba/período nas navegações. `periodo:null` limpa as datas;
  // passar de/ate sobrescreve (usado pelos atalhos).
  const qs = (p: { produto?: string; aba?: string; de?: string; ate?: string; periodo?: null }) => {
    const u = new URLSearchParams();
    u.set("produto", p.produto ?? produtoSel);
    u.set("aba", p.aba ?? abaSel);
    if (p.periodo !== null) {
      const dd = p.de ?? de;
      const aa = p.ate ?? ate;
      if (dd) u.set("de", dd);
      if (aa) u.set("ate", aa);
    }
    return `/?${u.toString()}`;
  };

  const atalhos = atalhosPeriodo();
  const periodoAtivo = (a: { de: string; ate: string }) => de === a.de && ate === a.ate;

  const stages = await loadStages();

  const periodo =
    de || ate
      ? {
          dataContrato: {
            ...(de ? { gte: new Date(`${de}T00:00:00`) } : {}),
            ...(ate ? { lte: new Date(`${ate}T23:59:59`) } : {}),
          },
        }
      : {};

  // projects e consultores são independentes: buscam em paralelo (uma ida ao
  // banco em vez de duas). transitions depende dos ids dos projetos, vem depois.
  const [projects, consultores] = await Promise.all([
    db.project.findMany({
      where: { deleted: false, isHistorico: false, productLine: produtoSel, ...periodo },
      include: {
        client: true,
        consultant: true,
        stage: true,
        pauses: true,
        contracts: { where: { kind: "LUSO" } },
        delays: { include: { category: true } },
      },
    }),
    db.user.findMany({
      where: { role: "CONSULTOR", active: true, status: "APROVADO", productLine: produtoSel },
      orderBy: { name: "asc" },
    }),
  ]);
  const transitions = await db.stageTransition.findMany({
    where: { projectId: { in: projects.map((p) => p.id) } },
    select: { projectId: true, toStageId: true, at: true },
  });

  const active = projects.filter((p) => p.status === "ATIVO" && !p.stage.isFinal);
  const done = projects.filter((p) => p.stage.isFinal);
  const paused = projects.filter((p) => p.status === "PAUSADO");

  type Ativo = (typeof active)[number];
  const marcoVencido = (p: Ativo) => contractMilestones(p).some((m) => m.diasRestantes < 0);
  const projetoAtrasado = (p: Ativo) => slaFor(p).atrasado || marcoVencido(p);
  const atrasadosAtivos = active.filter(projetoAtrasado);

  const sla = mediaImplantacao(done);

  // ── Atenção necessária (atrasados com motivo + marcos a vencer) ──
  const atencao = active
    .map((p) => {
      const s = slaFor(p);
      const marcoV = contractMilestones(p).find((m) => m.diasRestantes < 0);
      const motivo = s.atrasado
        ? `Etapa: ${s.diasTeknisa - (s.idealDays ?? 0)}d além do prazo`
        : marcoV
          ? `Treinamento: ${-marcoV.diasRestantes}d vencido`
          : null;
      return { project: p, s, motivo };
    })
    .filter((x) => x.motivo !== null)
    .sort((a, b) => b.s.diasTeknisa - a.s.diasTeknisa);

  const marcosProximos = active
    .flatMap((p) =>
      contractMilestones(p)
        .filter((m) => m.critico && m.diasRestantes >= 0)
        .map((m) => ({ project: p, m }))
    )
    .sort((a, b) => a.m.diasRestantes - b.m.diasRestantes);

  const kpis = [
    { label: "Em andamento", value: String(active.length), icon: FolderKanban, cls: "text-primary" },
    { label: "Concluídos", value: String(done.length), icon: CheckCircle2, cls: "text-success" },
    {
      label: "Atrasados",
      value: String(atrasadosAtivos.length),
      icon: AlertTriangle,
      cls: atrasadosAtivos.length > 0 ? "text-destructive" : "text-muted-foreground",
    },
    { label: "Pausados", value: String(paused.length), icon: PauseCircle, cls: "text-warning" },
    {
      label: "SLA médio de implantação",
      value: sla.mediaDias != null ? `${sla.mediaDias}d` : "sem dados",
      icon: Timer,
      cls: "text-accent",
      hint: sla.n > 0 ? `assinatura → go-live · ${sla.n} concluído${sla.n === 1 ? "" : "s"}` : "nenhum concluído ainda",
    },
  ];

  const acento = produtoSel === "TECFOOD" ? "border-t-tecfood" : "border-t-retail";

  // ── Vazão e volume ──
  const concluidosMes = contagemPorMes(done, (p) => p.dataFinalizacao);
  const novosMes = contagemPorMes(projects, (p) => p.dataContrato);
  const aging = agingAtivos(active);
  const mrrTotal = projects.reduce((s, p) => s + (p.contracts[0]?.valorMensal ?? 0), 0);
  const ticketMedio = projects.length > 0 ? mrrTotal / projects.length : 0;

  // ── Qualidade e causas ──
  const cancelados = projects.filter((p) => p.status === "CANCELADO");
  const taxaCancel = projects.length > 0 ? Math.round((cancelados.length / projects.length) * 100) : 0;
  // Ranking dos motivos de atraso (justificativas), por categoria.
  const motivosMap = new Map<string, number>();
  for (const p of projects) for (const d of p.delays) motivosMap.set(d.category.nome, (motivosMap.get(d.category.nome) ?? 0) + 1);
  const motivos = [...motivosMap.entries()].map(([nome, n]) => ({ nome, n })).sort((a, b) => b.n - a.n);
  const totalMotivos = motivos.reduce((s, m) => s + m.n, 0);
  // Tempo parado por pendência do cliente (soma/média das pausas).
  const diasPausados = diasDePausa(projects.flatMap((p) => p.pauses));
  const totalDiasPausados = diasPausados.reduce((s, d) => s + d, 0);
  const projetosComPausa = projects.filter((p) => p.pauses.length > 0).length;

  // ── Pessoas ──
  const pessoas = consultores
    .map((c) => {
      const meus = projects.filter((p) => p.consultantId === c.id);
      const meusAtivos = meus.filter((p) => p.status === "ATIVO" && !p.stage.isFinal);
      const meusAtrasados = meusAtivos.filter((p) => projetoAtrasado(p));
      const mediaC = mediaImplantacao(meus.filter((p) => p.stage.isFinal));
      return {
        user: c,
        ativos: meusAtivos.length,
        atrasados: meusAtrasados.length,
        concluidos: meus.filter((p) => p.stage.isFinal).length,
        slaMedio: mediaC.mediaDias,
      };
    })
    .sort((a, b) => b.ativos - a.ativos);
  const maxCarga = Math.max(1, ...pessoas.map((p) => p.ativos));

  return (
    <div className="space-y-5 max-w-6xl">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Indicadores da operação {PRODUCT_LABELS[produtoSel]} Express</p>
      </div>

      {/* Produto vira página: segmented control */}
      {produtosVisiveis.length > 1 && (
        <div className="inline-flex items-center gap-1 rounded-lg border border-border bg-muted p-1">
          {produtosVisiveis.map((p) => {
            const on = produtoSel === p;
            const cor = p === "TECFOOD" ? "bg-tecfood" : "bg-retail";
            return (
              <Link
                key={p}
                href={qs({ produto: p })}
                className={`inline-flex h-9 items-center justify-center rounded-md px-6 text-sm font-semibold transition-colors ${
                  on ? `${cor} text-white shadow-sm` : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {p === "TECFOOD" ? "TecFood" : "Retail"}
              </Link>
            );
          })}
        </div>
      )}

      {/* Período: rótulos acima dos campos, com atalhos rápidos */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-end gap-4 flex-wrap">
          <form action="/" className="flex items-end gap-3 flex-wrap">
            <input type="hidden" name="produto" value={produtoSel} />
            <input type="hidden" name="aba" value={abaSel} />
            <div className="space-y-1.5">
              <label htmlFor="de" className="block text-xs font-medium text-muted-foreground">
                De
              </label>
              <input
                id="de"
                name="de"
                type="date"
                defaultValue={de}
                className="h-10 rounded-md border border-border bg-muted/50 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="ate" className="block text-xs font-medium text-muted-foreground">
                Até
              </label>
              <input
                id="ate"
                name="ate"
                type="date"
                defaultValue={ate}
                className="h-10 rounded-md border border-border bg-muted/50 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              />
            </div>
            <button className="h-10 px-5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary-hover transition-colors">
              Filtrar
            </button>
          </form>

          <div className="flex items-center gap-1.5 flex-wrap ml-auto">
            {atalhos.map((a) => (
              <Link
                key={a.label}
                href={qs({ de: a.de, ate: a.ate })}
                className={`h-8 px-3 inline-flex items-center rounded-full border text-xs font-medium transition-colors ${
                  periodoAtivo(a)
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {a.label}
              </Link>
            ))}
            <Link
              href={qs({ periodo: null })}
              className={`h-8 px-3 inline-flex items-center rounded-full border text-xs font-medium transition-colors ${
                !de && !ate
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              Tudo
            </Link>
          </div>
        </div>
      </div>

      {/* Abas: segmented control */}
      <div className="inline-flex rounded-lg bg-muted p-1 gap-1 max-w-full overflow-x-auto">
        {ABAS.map((a) => (
          <Link
            key={a.id}
            href={qs({ aba: a.id })}
            className={`px-3.5 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
              abaSel === a.id
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {a.label}
          </Link>
        ))}
      </div>

      {abaSel === "geral" && (
        <div className={`space-y-5 border-t-4 ${acento} rounded-t-sm pt-4`}>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {kpis.map(({ label, value, icon: Icon, cls, hint }) => (
              <div key={label} className="bg-card border border-border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <Icon className={`h-4 w-4 ${cls}`} />
                </div>
                <p className="text-2xl font-semibold mt-1">{value}</p>
                {hint && <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>}
              </div>
            ))}
          </div>

          <ProjetosPorEtapa stages={stages} active={active} />
          <AtencaoNecessaria atencao={atencao} marcosProximos={marcosProximos} />
        </div>
      )}

      {abaSel === "sla" && (
        <div className={`space-y-5 border-t-4 ${acento} rounded-t-sm pt-4`}>
          <div className="grid lg:grid-cols-2 gap-4">
            <SlaMedioCard sla={sla} tendencia={tendenciaImplantacao(done)} />
            <PrazoCard active={active} atrasados={atrasadosAtivos.length} />
          </div>
          <TempoPorEtapa dados={tempoMedioPorEtapa(transitions, stages)} />
          <AtencaoNecessaria atencao={atencao} marcosProximos={marcosProximos} />
        </div>
      )}

      {abaSel === "vazao" && (
        <div className={`space-y-5 border-t-4 ${acento} rounded-t-sm pt-4`}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <VendaKpi label="Contratos no período" valor={String(projects.length)} />
            <VendaKpi label="MRR total" valor={brl(mrrTotal)} destaque />
            <VendaKpi label="Ticket médio" valor={brl(ticketMedio)} />
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            <BarrasMes titulo="Novos contratos por mês" dados={novosMes} cor="bg-primary" />
            <BarrasMes titulo="Projetos concluídos por mês" dados={concluidosMes} cor="bg-success" />
          </div>
          <Aging aging={aging} totalAtivos={active.length} />
        </div>
      )}

      {abaSel === "qualidade" && (
        <div className={`space-y-5 border-t-4 ${acento} rounded-t-sm pt-4`}>
          <div className="grid lg:grid-cols-2 gap-4">
            <MotivosAtraso motivos={motivos} total={totalMotivos} />
            <div className="space-y-4">
              <PausaCard
                totalDias={totalDiasPausados}
                projetos={projetosComPausa}
                pausas={diasPausados.length}
              />
              <CancelamentoCard cancelados={cancelados.length} taxa={taxaCancel} total={projects.length} />
            </div>
          </div>
        </div>
      )}

      {abaSel === "pessoas" && (
        <div className={`space-y-5 border-t-4 ${acento} rounded-t-sm pt-4`}>
          <PessoasTabela pessoas={pessoas} maxCarga={maxCarga} />
        </div>
      )}
    </div>
  );
}

// ── Blocos ──────────────────────────────────────────────────────────

type ProjetoLite = {
  id: string;
  stageId: string;
  productLine: ProductLine;
  client: { razaoSocial: string };
  consultant: { name: string } | null;
};

function ProjetosPorEtapa({
  stages,
  active,
}: {
  stages: { id: string; nome: string; isFinal: boolean }[];
  active: { stageId: string }[];
}) {
  const byStage = stages
    .filter((s) => !s.isFinal)
    .map((s) => ({ stage: s, count: active.filter((p) => p.stageId === s.id).length }));
  const maxCount = Math.max(1, ...byStage.map((x) => x.count));
  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <h2 className="text-sm font-semibold mb-4">Projetos ativos por etapa</h2>
      <div className="space-y-2">
        {byStage.map(({ stage, count }) => (
          <div key={stage.id} className="flex items-center gap-3">
            <span className="w-40 text-sm text-muted-foreground shrink-0">{stage.nome}</span>
            <div className="flex-1 h-5 bg-muted rounded overflow-hidden">
              <div className="h-full bg-primary/70 rounded" style={{ width: `${(count / maxCount) * 100}%` }} />
            </div>
            <span className="w-6 text-right text-sm font-medium">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AtencaoNecessaria({
  atencao,
  marcosProximos,
}: {
  atencao: { project: ProjetoLite; motivo: string | null }[];
  marcosProximos: { project: ProjetoLite; m: { tipo: string; curto: string; diasRestantes: number } }[];
}) {
  if (atencao.length === 0 && marcosProximos.length === 0) {
    return (
      <div className="bg-card border border-border rounded-lg p-5">
        <h2 className="text-sm font-semibold mb-2 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-success" /> Atenção necessária
        </h2>
        <p className="text-sm text-muted-foreground">Nada atrasado nem vencendo. Tudo no prazo.</p>
      </div>
    );
  }
  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-destructive" /> Atenção necessária
      </h2>
      <div className="space-y-2">
        {atencao.map(({ project, motivo }) => (
          <Link
            key={project.id}
            href={`/projetos/${project.id}`}
            className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 hover:bg-destructive/10 transition-colors"
          >
            <ProductBadge line={project.productLine} />
            <span className="text-sm font-medium flex-1 truncate">{project.client.razaoSocial}</span>
            <span className="text-xs text-muted-foreground hidden sm:block">
              {project.consultant?.name ?? "sem consultor"}
            </span>
            <span className="text-xs font-semibold text-destructive whitespace-nowrap">{motivo}</span>
          </Link>
        ))}
        {marcosProximos.map(({ project, m }) => (
          <Link
            key={project.id + m.tipo}
            href={`/projetos/${project.id}`}
            className="flex items-center gap-3 rounded-md border border-warning/30 bg-warning/5 px-3 py-2 hover:bg-warning/10 transition-colors"
          >
            <span className="text-sm font-medium flex-1 truncate">{project.client.razaoSocial}</span>
            <span className="text-xs text-warning font-medium whitespace-nowrap">
              {m.curto} · {m.diasRestantes}d restantes
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function SlaMedioCard({
  sla,
  tendencia,
}: {
  sla: { mediaDias: number | null; n: number };
  tendencia: { rotulo: string; media: number | null; n: number }[];
}) {
  const comValor = tendencia.filter((t) => t.media != null);
  const maxMedia = Math.max(1, ...comValor.map((t) => t.media as number));
  const ultimoIdx = tendencia.map((t) => t.media != null).lastIndexOf(true);
  const ALTURA = 112;
  return (
    <div className="bg-card border border-border border-t-4 border-t-accent rounded-lg p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold inline-flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/10 text-accent">
            <Timer className="h-4 w-4" />
          </span>
          SLA médio de implantação
        </h2>
        <span className="text-xs text-muted-foreground">assinatura → go-live</span>
      </div>
      <p className="mt-3 flex items-baseline gap-2">
        {sla.mediaDias != null ? (
          <>
            <span className="text-4xl font-bold text-accent">{sla.mediaDias}</span>
            <span className="text-base font-semibold text-muted-foreground">dias corridos</span>
          </>
        ) : (
          <span className="text-base font-semibold text-muted-foreground">sem projetos concluídos</span>
        )}
      </p>
      <p className="text-xs text-muted-foreground mt-0.5">
        média de {sla.n} projeto{sla.n === 1 ? "" : "s"} concluído{sla.n === 1 ? "" : "s"}
      </p>

      {/* Mini-tendência: média por mês de conclusão. Último mês em destaque.
          Mesmo padrão limpo das barras da aba Vazão: sobre uma linha de base, sem trilho cinza. */}
      <div className="mt-5">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-3">
          Tendência (média por mês de conclusão)
        </p>
        <div className="flex items-end justify-between gap-2 border-b border-border" style={{ height: `${ALTURA}px` }}>
          {tendencia.map((t, i) => {
            const destaque = i === ultimoIdx;
            return (
              <div key={i} className="flex-1 h-full flex flex-col items-center justify-end">
                <span className={`text-xs font-semibold h-4 ${destaque ? "text-accent" : "text-muted-foreground"}`}>
                  {t.media ?? ""}
                </span>
                <div
                  className={`w-full max-w-[36px] rounded-t-md ${
                    t.media != null ? (destaque ? "bg-accent" : "bg-accent/45") : "bg-muted"
                  }`}
                  style={{
                    height:
                      t.media != null
                        ? `${Math.max(10, ((t.media as number) / maxMedia) * (ALTURA - 24))}px`
                        : "3px",
                  }}
                  title={t.media != null ? `${t.media}d · ${t.n} concluído(s)` : "sem conclusões"}
                />
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex justify-between gap-2">
          {tendencia.map((t, i) => (
            <span key={i} className="flex-1 text-center text-[11px] text-muted-foreground capitalize">
              {t.rotulo}
            </span>
          ))}
        </div>
        {comValor.length === 0 && (
          <p className="text-xs text-muted-foreground mt-2">Sem conclusões nos últimos meses.</p>
        )}
      </div>
    </div>
  );
}

function PrazoCard({ active, atrasados }: { active: unknown[]; atrasados: number }) {
  const n = active.length;
  const noPrazo = n - atrasados;
  const pct = n > 0 ? Math.round((noPrazo / n) * 100) : null;
  const cor = pct == null ? "text-muted-foreground" : pct >= 80 ? "text-success" : pct >= 50 ? "text-warning" : "text-destructive";
  const barra = pct == null ? "bg-muted" : pct >= 80 ? "bg-success" : pct >= 50 ? "bg-warning-bg" : "bg-destructive";
  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold inline-flex items-center gap-2">
          <Gauge className="h-4 w-4 text-primary" /> Projetos no prazo
        </h2>
        <span className="text-xs text-muted-foreground">SLA da etapa + prazo contratual</span>
      </div>
      <p className={`text-3xl font-bold mt-3 ${cor}`}>
        {pct != null ? `${pct}%` : "sem ativos"}
      </p>
      <p className="text-xs text-muted-foreground mt-0.5">
        {n > 0 ? `${noPrazo} de ${n} ativos dentro do prazo` : "nenhum projeto ativo"}
      </p>
      {pct != null && (
        <div className="mt-4 h-2.5 rounded-full bg-muted overflow-hidden">
          <div className={`h-full rounded-full ${barra}`} style={{ width: `${pct}%` }} />
        </div>
      )}
      {atrasados > 0 && (
        <p className="mt-3 text-xs text-destructive inline-flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5" /> {atrasados} atrasado{atrasados === 1 ? "" : "s"} agora
        </p>
      )}
    </div>
  );
}

function TempoPorEtapa({
  dados,
}: {
  dados: { stage: { id: string; nome: string; idealDays: number | null }; mediaDias: number | null; n: number }[];
}) {
  const comDados = dados.filter((d) => d.mediaDias != null);
  const max = Math.max(1, ...comDados.map((d) => d.mediaDias as number));
  // Gargalo = etapa de maior média.
  const gargaloId = comDados.length > 0 ? comDados.reduce((a, b) => ((b.mediaDias as number) > (a.mediaDias as number) ? b : a)).stage.id : null;

  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <div className="flex items-center justify-between gap-3 mb-1">
        <h2 className="text-sm font-semibold inline-flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" /> Tempo médio por etapa
        </h2>
        <span className="text-xs text-muted-foreground">a etapa mais longa é o gargalo</span>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Dias corridos que os projetos levaram para deixar cada etapa (histórico de movimentações).
      </p>
      {comDados.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Ainda sem histórico de movimentação suficiente para calcular.
        </p>
      ) : (
        <div className="space-y-2.5">
          {dados.map(({ stage, mediaDias }) => {
            const eGargalo = stage.id === gargaloId;
            // Cor pela regra de prazo: verde com folga, amarelo no limite,
            // vermelho quando a média estourou o prazo ideal da etapa.
            const restante = mediaDias != null && stage.idealDays != null ? stage.idealDays - mediaDias : null;
            const tom = tomPrazo(restante);
            return (
              <div key={stage.id} className="flex items-center gap-3">
                <span className="w-40 text-sm shrink-0 flex items-center gap-1.5 text-muted-foreground">
                  {eGargalo && <CalendarClock className="h-3.5 w-3.5 text-destructive shrink-0" />}
                  <span className={eGargalo ? "font-semibold text-foreground" : ""}>{stage.nome}</span>
                </span>
                <div className="flex-1 h-5 bg-muted rounded overflow-hidden">
                  {mediaDias != null && (
                    <div
                      className={`h-full rounded ${tom === "neutro" ? "bg-primary/70" : TOM_BARRA[tom]}`}
                      style={{ width: `${Math.max(4, ((mediaDias as number) / max) * 100)}%` }}
                    />
                  )}
                </div>
                <span className="w-24 text-right text-xs shrink-0">
                  {mediaDias != null ? (
                    <>
                      <strong className={tom === "neutro" ? "text-foreground" : TOM_TEXTO[tom]}>{mediaDias}d</strong>
                      {stage.idealDays != null && <span className="text-muted-foreground"> /{stage.idealDays}d</span>}
                    </>
                  ) : (
                    <span className="text-muted-foreground">sem dados</span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Blocos: Vazão e volume ──────────────────────────────────────────

function VendaKpi({ label, valor, destaque }: { label: string; valor: string; destaque?: boolean }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        {destaque ? <TrendingUp className="h-4 w-4 text-success" /> : <Receipt className="h-4 w-4 text-muted-foreground" />}
      </div>
      <p className={`text-2xl font-semibold mt-1 ${destaque ? "text-success" : ""}`}>{valor}</p>
    </div>
  );
}

function BarrasMes({ titulo, dados, cor }: { titulo: string; dados: PontoContagem[]; cor: string }) {
  const max = Math.max(1, ...dados.map((d) => d.n));
  const total = dados.reduce((s, d) => s + d.n, 0);
  const ALTURA = 120; // altura útil das barras
  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">{titulo}</h2>
        <span className="text-xs text-muted-foreground">{total} no período</span>
      </div>
      {/* Barras sobre uma linha de base, sem trilho cinza (fica mais leve). */}
      <div className="mt-6 flex items-end justify-between gap-5 border-b border-border" style={{ height: `${ALTURA}px` }}>
        {dados.map((d, i) => (
          <div key={i} className="flex-1 h-full flex flex-col items-center justify-end">
            <span className="text-xs font-semibold text-foreground mb-1.5">{d.n || ""}</span>
            <div
              className={`w-full max-w-[36px] rounded-t-md ${d.n > 0 ? cor : "bg-muted"}`}
              style={{ height: d.n > 0 ? `${Math.max(10, (d.n / max) * (ALTURA - 24))}px` : "3px" }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between gap-5">
        {dados.map((d, i) => (
          <span key={i} className="flex-1 text-center text-[11px] text-muted-foreground capitalize">
            {d.rotulo}
          </span>
        ))}
      </div>
    </div>
  );
}

function Aging({ aging, totalAtivos }: { aging: { faixas: FaixaAging[]; medianaDias: number | null }; totalAtivos: number }) {
  const max = Math.max(1, ...aging.faixas.map((f) => f.n));
  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <div className="flex items-center justify-between gap-3 mb-1">
        <h2 className="text-sm font-semibold inline-flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" /> Aging dos projetos ativos
        </h2>
        <span className="text-xs text-muted-foreground">
          {aging.medianaDias != null ? `mediana ${aging.medianaDias}d em implantação` : "sem ativos"}
        </span>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Há quanto tempo os {totalAtivos} projetos ativos estão em implantação (desde a assinatura).
      </p>
      <div className="space-y-2.5">
        {aging.faixas.map((f) => (
          <div key={f.rotulo} className="flex items-center gap-3">
            <span className="w-32 text-sm text-muted-foreground shrink-0">{f.rotulo}</span>
            <div className="flex-1 h-5 bg-muted rounded overflow-hidden">
              {f.n > 0 && (
                <div
                  className={`h-full rounded ${f.alerta ? "bg-warning-bg" : "bg-primary/70"}`}
                  style={{ width: `${Math.max(4, (f.n / max) * 100)}%` }}
                />
              )}
            </div>
            <span className="w-6 text-right text-sm font-medium">{f.n}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Blocos: Qualidade e causas ──────────────────────────────────────

function MotivosAtraso({ motivos, total }: { motivos: { nome: string; n: number }[]; total: number }) {
  const max = Math.max(1, ...motivos.map((m) => m.n));
  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <div className="flex items-center justify-between gap-3 mb-1">
        <h2 className="text-sm font-semibold inline-flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive" /> Motivos de atraso
        </h2>
        <span className="text-xs text-muted-foreground">{total} justificativa{total === 1 ? "" : "s"}</span>
      </div>
      <p className="text-xs text-muted-foreground mb-4">Por que os projetos atrasam, pelas justificativas registradas.</p>
      {motivos.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma justificativa de atraso registrada no período.</p>
      ) : (
        <div className="space-y-2.5">
          {motivos.map((m) => (
            <div key={m.nome} className="flex items-center gap-3">
              <span className="w-44 text-sm text-muted-foreground shrink-0 truncate" title={m.nome}>{m.nome}</span>
              <div className="flex-1 h-5 bg-muted rounded overflow-hidden">
                <div className="h-full rounded bg-destructive/70" style={{ width: `${Math.max(4, (m.n / max) * 100)}%` }} />
              </div>
              <span className="w-6 text-right text-sm font-medium">{m.n}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PausaCard({ totalDias, projetos, pausas }: { totalDias: number; projetos: number; pausas: number }) {
  const media = pausas > 0 ? Math.round(totalDias / pausas) : null;
  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <h2 className="text-sm font-semibold inline-flex items-center gap-2">
        <PauseCircle className="h-4 w-4 text-warning" /> Tempo parado por pendência do cliente
      </h2>
      <p className="mt-3 flex items-baseline gap-2">
        <span className="text-3xl font-bold text-warning">{media != null ? media : 0}</span>
        <span className="text-base font-semibold text-muted-foreground">dias por pausa (média)</span>
      </p>
      <p className="text-xs text-muted-foreground mt-1">
        {pausas} pausa{pausas === 1 ? "" : "s"} em {projetos} projeto{projetos === 1 ? "" : "s"} · {totalDias} dias parados no total
      </p>
    </div>
  );
}

function CancelamentoCard({ cancelados, taxa, total }: { cancelados: number; taxa: number; total: number }) {
  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <h2 className="text-sm font-semibold inline-flex items-center gap-2">
        <Ban className="h-4 w-4 text-destructive" /> Cancelamentos
      </h2>
      <p className="mt-3 flex items-baseline gap-2">
        <span className={`text-3xl font-bold ${cancelados > 0 ? "text-destructive" : "text-foreground"}`}>{taxa}%</span>
        <span className="text-base font-semibold text-muted-foreground">dos projetos</span>
      </p>
      <p className="text-xs text-muted-foreground mt-1">
        {cancelados} cancelado{cancelados === 1 ? "" : "s"} de {total} no período
      </p>
    </div>
  );
}

// ── Blocos: Pessoas ─────────────────────────────────────────────────

type LinhaPessoa = {
  user: { id: string; name: string };
  ativos: number;
  atrasados: number;
  concluidos: number;
  slaMedio: number | null;
};

function PessoasTabela({ pessoas, maxCarga }: { pessoas: LinhaPessoa[]; maxCarga: number }) {
  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <h2 className="text-sm font-semibold inline-flex items-center gap-2 mb-1">
        <UserRound className="h-4 w-4 text-primary" /> Consultores
      </h2>
      <p className="text-xs text-muted-foreground mb-4">
        Carga atual, atrasos e tempo médio de implantação (assinatura → go-live) de cada consultor.
      </p>
      {pessoas.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum consultor cadastrado neste produto.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 pr-3 text-xs uppercase tracking-wider text-muted-foreground font-medium">Consultor(a)</th>
                <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-muted-foreground font-medium w-[34%]">Carga (ativos)</th>
                <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-muted-foreground font-medium">Atrasados</th>
                <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-muted-foreground font-medium">Concluídos</th>
                <th className="text-right py-2 pl-3 text-xs uppercase tracking-wider text-muted-foreground font-medium">SLA médio</th>
              </tr>
            </thead>
            <tbody>
              {pessoas.map((p) => {
                const cargaCor = p.ativos >= 3 ? "bg-destructive" : p.ativos === 2 ? "bg-warning-bg" : "bg-success";
                return (
                  <tr key={p.user.id} className="border-b border-border last:border-0">
                    <td className="py-2.5 pr-3 font-medium">{p.user.name}</td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden max-w-[160px]">
                          <div className={`h-full rounded-full ${cargaCor}`} style={{ width: `${(p.ativos / maxCarga) * 100}%` }} />
                        </div>
                        <span className="text-xs font-medium w-4">{p.ativos}</span>
                      </div>
                    </td>
                    <td className={`py-2.5 px-3 text-right font-medium ${p.atrasados > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                      {p.atrasados}
                    </td>
                    <td className="py-2.5 px-3 text-right">{p.concluidos}</td>
                    <td className="py-2.5 pl-3 text-right">
                      {p.slaMedio != null ? <strong className="text-foreground">{p.slaMedio}d</strong> : <span className="text-muted-foreground">sem dados</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
