import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { slaFor, contractMilestones, somaDescontoAprovado } from "@/lib/sla";
import { loadStages } from "@/lib/pipeline";
import { fmtDate, brl } from "@/lib/format";
import { addComment, pauseProject, resumeProject, cancelProject } from "@/lib/actions";
import { ProductBadge, StatusBadge, AditivoBadge } from "@/components/badges";
import { StageStepper } from "@/components/project/stage-stepper";
import { MilestoneCard, SemMarcoCard } from "@/components/project/milestones";
import { DelayCard } from "@/components/project/delay-card";
import { ConsultantCard } from "@/components/project/consultant-card";
import { DocumentsCard } from "@/components/project/documents-card";
import { IntakeCard } from "@/components/project/intake-card";
import { ChecklistCard } from "@/components/project/checklist-card";
import { ActivityList } from "@/components/project/activity-list";
import {
  canAllocateConsultant,
  canCancelProject,
  canJustifyDelay,
  canApproveDelay,
  canManageActivities,
  canPauseResumeProject,
  canUploadDocuments,
} from "@/lib/permissions";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRightLeft,
  CalendarDays,
  History,
  Package,
  Pause,
  Play,
  Send,
  UserRound,
  Wallet,
  XCircle,
} from "lucide-react";

const ERROS_PROJETO: Record<string, string> = {
  checklist: "Para avançar de etapa, conclua primeiro todos os itens do checklist.",
  permissao: "Seu perfil não tem permissão para executar essa ação.",
  consultor:
    "Consultor(a) inválido(a). Escolha alguém ativo e do mesmo produto do projeto.",
  arquivo: "Selecione um arquivo para anexar.",
  "arquivo-grande": "Arquivo acima de 8 MB. Comprima o PDF ou envie em partes.",
  "arquivo-tipo": "Formato não aceito. Anexe PDF, PNG ou JPG.",
  categoria: "Escolha uma categoria de atraso válida.",
  titulo: "Informe o título da atividade.",
  status: "Status de atividade inválido.",
  planilha: "Selecione a planilha do cronograma.",
  "planilha-tipo": "A planilha precisa ser um arquivo Excel (.xlsx).",
  "planilha-invalida": "Não consegui ler o cronograma. Confira se a planilha segue o modelo.",
};

export default async function ProjetoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string; ok?: string; n?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { erro, ok, n } = await searchParams;

  const project = await db.project.findUnique({
    where: { id },
    include: {
      client: true,
      consultant: true,
      stage: true,
      intake: true,
      pauses: { orderBy: { startedAt: "desc" } },
      contracts: { include: { items: true } },
      documents: { orderBy: { uploadedAt: "desc" } },
      modules: { include: { moduleTemplate: true } },
      activities: {
        orderBy: { ordem: "asc" },
        include: { assignee: true, template: { include: { moduleTemplate: { select: { nome: true } } } } },
      },
      checklist: { orderBy: { ordem: "asc" }, include: { doneBy: true } },
      transitions: { orderBy: { at: "asc" }, include: { byUser: true, fromStage: true, toStage: true } },
      delays: { orderBy: { at: "desc" }, include: { category: true, byUser: true, stage: true } },
      timelineEntries: { orderBy: { at: "desc" }, include: { byUser: true } },
    },
  });
  if (!project || project.deleted) notFound();

  const stages = await loadStages();
  // Dias de atraso aprovados esticam os dois relógios: o da etapa conta só as
  // justificativas da etapa atual; o marco contratual (prazo total) soma tudo.
  const descontoEtapa = somaDescontoAprovado(project.delays, project.stageId);
  const descontoTotal = somaDescontoAprovado(project.delays);
  const sla = slaFor(project, undefined, descontoEtapa);
  const milestones = contractMilestones(project, undefined, descontoTotal);
  const currentChecklist = project.checklist.filter((c) => c.stageId === project.stageId);
  const checklistDone = currentChecklist.every((c) => c.done);
  const consultants = await db.user.findMany({
    where: { role: "CONSULTOR", active: true, status: "APROVADO", productLine: project.productLine },
    orderBy: { name: "asc" },
  });
  // Time inteiro (para o autocomplete de @menção na observação).
  const equipe = await db.user.findMany({
    where: { active: true, status: "APROVADO" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const delayCategories = await db.delayCategory.findMany({ where: { active: true } });
  // Modelos de atividade do produto, para o consultor não digitar do zero.
  const modelosAtividade = await db.activityTemplate.findMany({
    where: { active: true, productLine: project.productLine },
    orderBy: [{ ordem: "asc" }, { titulo: "asc" }],
  });
  // A mesma atividade aparece em mais de um módulo (ex.: "Medição de Efetivos"),
  // então a sugestão de título não pode repetir (senão key duplicada no React).
  const titulosUnicos = [...new Set(modelosAtividade.map((m) => m.titulo))];
  const luso = project.contracts.find((c) => c.kind === "LUSO");

  // Permissões: a leitura fica visível para todos; o controle de execução
  // é liberado só para quem pode agir (ver src/lib/permissions.ts).
  const canAllocate = canAllocateConsultant(user, project.productLine);
  const canPauseResume = canPauseResumeProject(user, project);
  const canCancel = canCancelProject(user, project.productLine);
  const canManage = canManageActivities(user, project);
  const canDelay = canJustifyDelay(user, project);
  const canApproveAtraso = canApproveDelay(user, project);
  const canUpload = canUploadDocuments(user, project);
  const showAssigneeSelect = user.role === "DIRETORIA" || user.role === "COORDENACAO";

  const timeline = [
    ...project.timelineEntries.map((t) => ({
      key: `t-${t.id}`,
      at: t.at,
      who: t.byUser?.name,
      text: t.texto,
      kind: t.tipo,
    })),
    ...project.transitions.map((t) => ({
      key: `s-${t.id}`,
      at: t.at,
      who: t.byUser?.name,
      text: t.fromStage
        ? `Moveu de "${t.fromStage.nome}" para "${t.toStage.nome}"`
        : `Projeto criado em "${t.toStage.nome}"`,
      kind: "SISTEMA",
    })),
    ...project.delays.map((d) => ({
      key: `d-${d.id}`,
      at: d.at,
      who: d.byUser?.name,
      text: `Justificativa de atraso (${d.stage.nome}, ${d.dias} dia${d.dias === 1 ? "" : "s"}): ${d.category.nome}${d.detalhe ? `. ${d.detalhe}` : ""}`,
      kind: "ATRASO",
    })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return (
    <div className="max-w-7xl space-y-5">
      {/* Header */}
      <div>
        <Link
          href={`/clientes/${project.clientId}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ArrowLeft className="h-4 w-4" /> {project.client.razaoSocial}
        </Link>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-semibold">{project.client.razaoSocial}</h1>
              <ProductBadge line={project.productLine} />
              <StatusBadge status={project.status} />
              {project.modules.some((m) => m.isAditivo) && <AditivoBadge />}
            </div>
            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground flex-wrap">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4" />
                Assinado em <strong className="text-foreground">{fmtDate(project.dataContrato)}</strong>
              </span>
              {luso?.valorMensal != null && (
                <span className="inline-flex items-center gap-1.5">
                  <Wallet className="h-4 w-4" />
                  <strong className="text-foreground">{brl(luso.valorMensal)}</strong>/mês
                </span>
              )}
              {project.modules.length > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <Package className="h-4 w-4" />
                  {project.modules.map((m) => m.moduleTemplate.nome).join(" + ")}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <UserRound className="h-4 w-4" />
                {project.consultant?.name ?? "Sem consultor"}
              </span>
            </div>
          </div>
          {(canPauseResume || canCancel) && (
            <div className="flex items-center gap-2 shrink-0">
              {canPauseResume && project.status === "ATIVO" && (
                <form action={pauseProject}>
                  <input type="hidden" name="projectId" value={project.id} />
                  <button className="h-9 px-3 inline-flex items-center gap-1.5 rounded-md border border-border text-sm hover:bg-muted">
                    <Pause className="h-4 w-4" /> Pausar
                  </button>
                </form>
              )}
              {canPauseResume && project.status === "PAUSADO" && (
                <form action={resumeProject}>
                  <input type="hidden" name="projectId" value={project.id} />
                  <button className="h-9 px-3 inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary-hover">
                    <Play className="h-4 w-4" /> Retomar
                  </button>
                </form>
              )}
              {canCancel && project.status !== "CANCELADO" && (
                <form action={cancelProject}>
                  <input type="hidden" name="projectId" value={project.id} />
                  <button className="h-9 px-3 inline-flex items-center gap-1.5 rounded-md border border-destructive/30 text-destructive text-sm hover:bg-destructive/5">
                    <XCircle className="h-4 w-4" /> Cancelar
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>

      {erro && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {ERROS_PROJETO[erro] ?? "Não foi possível concluir a ação."}
        </div>
      )}
      {ok === "cronograma" && (
        <div className="rounded-md border border-success/30 bg-success/5 px-4 py-3 text-sm text-success">
          Cronograma importado: {n ?? 0} atividade{n === "1" ? "" : "s"} criada{n === "1" ? "" : "s"} a
          partir da planilha.
        </div>
      )}
      {ok === "atividade" && (
        <div className="rounded-md border border-success/30 bg-success/5 px-4 py-3 text-sm text-success">
          Atividade atualizada.
        </div>
      )}

      <StageStepper
        projectId={project.id}
        stages={stages}
        stageId={project.stageId}
        status={project.status}
        productLine={project.productLine}
        sla={sla}
        checklistDone={checklistDone}
        canMove={canManage}
      />

      {/* Linha 1: quem toca, o que está anexado, o que vence.
          Três colunas iguais; `items-stretch` + `h-full` nos cards igualam a altura. */}
      <div className="grid lg:grid-cols-3 gap-5 items-stretch">
        <ConsultantCard
          projectId={project.id}
          consultants={consultants}
          currentId={project.consultantId}
          currentName={project.consultant?.name ?? null}
          canEdit={canAllocate}
        />
        <DocumentsCard projectId={project.id} documents={project.documents} canUpload={canUpload} />
        {milestones.length > 0 ? <MilestoneCard milestone={milestones[0]} /> : <SemMarcoCard />}
      </div>

      {/* Linha 2: o que entrou do comercial, o que trava a etapa, o que explica o atraso */}
      <div className="grid lg:grid-cols-3 gap-5 items-stretch">
        <IntakeCard projectId={project.id} intake={project.intake} canManage={canManage} />
        <ChecklistCard
          stageNome={project.stage.nome}
          items={currentChecklist}
          canEdit={canManage}
        />
        <DelayCard
          projectId={project.id}
          canDelay={canDelay}
          canApprove={canApproveAtraso}
          categorias={delayCategories}
          atrasos={project.delays}
        />
      </div>

      {/* Cronograma ocupando a largura inteira: é a tela de trabalho do consultor */}
      <ActivityList
        projectId={project.id}
        activities={project.activities}
        canManage={canManage}
        consultants={consultants}
        showAssigneeSelect={showAssigneeSelect}
        sugestoesTitulo={titulosUnicos}
        documents={project.documents.map((d) => ({ id: d.id, filename: d.filename, fase: d.fase }))}
        equipe={equipe}
      />

      {/* Timeline em largura total: o texto usa a largura e a autoria fica à direita */}
      <section className="bg-card border border-border rounded-lg p-5">
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <h2 className="text-sm font-semibold inline-flex items-center gap-2">
            <History className="h-4 w-4 text-primary" /> Timeline
          </h2>
          <span className="text-xs text-muted-foreground">
            {timeline.length} registro{timeline.length === 1 ? "" : "s"}
          </span>
        </div>

        <form action={addComment} className="flex gap-2 mb-5">
          <input type="hidden" name="projectId" value={project.id} />
          <input
            name="texto"
            required
            placeholder="Registrar comentário, decisão ou informação do comercial…"
            className="flex-1 h-10 rounded-md border border-border bg-muted/50 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          />
          <button className="h-10 px-4 inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary-hover transition-colors shrink-0">
            <Send className="h-3.5 w-3.5" /> Registrar
          </button>
        </form>

        {timeline.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum registro ainda.</p>
        ) : (
          <ol className="relative before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-px before:bg-border">
            {timeline.map((t) => (
              <li
                key={t.key}
                className="relative pl-7 pr-1 py-2 grid sm:grid-cols-[minmax(0,1fr)_auto] gap-x-6 gap-y-0.5 items-baseline rounded-md hover:bg-muted/40 transition-colors"
              >
                <span
                  className={`absolute left-0 top-3 h-[15px] w-[15px] rounded-full border-2 border-card ${
                    t.kind === "COMENTARIO"
                      ? "bg-accent"
                      : t.kind === "ATRASO"
                        ? "bg-destructive"
                        : "bg-border"
                  }`}
                />
                <p className={`text-sm ${t.kind === "SISTEMA" ? "text-muted-foreground" : ""}`}>
                  {t.text}
                </p>
                <p className="text-xs text-muted-foreground sm:text-right whitespace-nowrap">
                  {fmtDate(t.at)}
                  {t.who ? ` · ${t.who}` : ""}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>

      {project.pauses.length > 0 && (
        <section className="bg-card border border-border rounded-lg p-5">
          <h2 className="text-sm font-semibold inline-flex items-center gap-2 mb-3">
            <ArrowRightLeft className="h-4 w-4 text-primary" /> Pausas
          </h2>
          <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 text-sm">
            {project.pauses.map((p) => (
              <li key={p.id} className="rounded-md border border-border bg-muted/30 px-3 py-2 text-muted-foreground">
                {fmtDate(p.startedAt)} → {p.endedAt ? fmtDate(p.endedAt) : "em aberto"}
                {p.motivo ? ` · ${p.motivo}` : ""}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
