import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canEditUserRoles, canInviteUsers, canReviewAccessRequests } from "@/lib/permissions";
import {
  approveAccessRequest,
  createUserAction,
  rejectAccessRequest,
  resendInviteAction,
} from "@/lib/actions";
import { PRODUCT_LABELS, ROLE_LABELS, fmtDate } from "@/lib/format";
import { ProductBadge, StageBadge } from "@/components/badges";
import { EditRolePanel } from "@/components/team/edit-role-panel";
import { DeleteUserPanel } from "@/components/team/delete-user-panel";
import { InviteUserPanel } from "@/components/team/invite-user-panel";
import { CopyLinkButton } from "@/components/team/copy-link-button";
import { CalendarOff, Check, Clock, History, Link2, MailCheck, Send, UserCheck, X } from "lucide-react";

const ERROS: Record<string, string> = {
  "auto-exclusao": "Você não pode apagar a própria conta.",
  permissao: "Seu perfil não pode executar essa ação.",
  campos: "Preencha nome, email e papel.",
  "permissao-papel": "Seu perfil não pode convidar para esse papel/produto.",
  "produto-obrigatorio": "Selecione o produto (TecFood ou Retail) para esse papel.",
  "email-existente": "Já existe uma conta com esse email.",
  "ultima-diretoria":
    "Esta é a última conta de diretoria ativa. Promova outra pessoa antes, senão ninguém consegue liberar acessos nem editar a pipeline.",
  papel: "Papel inválido.",
  "produto-invalido": "Produto inválido.",
};

const fieldLabel = "text-sm font-medium";
const fieldInput =
  "w-full h-10 rounded-md border border-border bg-muted/50 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40";

export default async function EquipePage({
  searchParams,
}: {
  searchParams: Promise<{
    erro?: string;
    convite?: string;
    convidado?: string;
    removido?: string;
    criado?: string;
  }>;
}) {
  const currentUser = await requireUser();
  const { erro, convite, convidado, removido, criado } = await searchParams;
  // Só o fluxo de convite marca `convite=1` ao voltar com erro. Qualquer outro
  // erro (exclusão, papel, liberação de acesso) aparece no topo da página, e
  // não escondido dentro do painel de convite.
  const erroDeConvite = !!erro && convite === "1";
  const canInvite = canInviteUsers(currentUser);
  const canEditRoles = canEditUserRoles(currentUser);
  const canReview = canReviewAccessRequests(currentUser);
  const isDiretoria = currentUser.role === "DIRETORIA";

  // Solicitações de acesso: quem passou pelo primeiro acesso e aguarda liberação.
  const solicitacoes = canReview
    ? await db.user.findMany({ where: { status: "PENDENTE" }, orderBy: { createdAt: "asc" } })
    : [];

  // Log de decisões: quem liberou ou recusou cada acesso, e quando. Fica à
  // vista para a gestão conferir depois quem autorizou a entrada de quem.
  const decisoes = canReview
    ? await db.user.findMany({
        where: { approvedAt: { not: null }, approvedById: { not: null } },
        orderBy: { approvedAt: "desc" },
        take: 15,
      })
    : [];
  const decisores = new Map(
    (
      await db.user.findMany({
        where: { id: { in: decisoes.map((d) => d.approvedById!) } },
        select: { id: true, name: true },
      })
    ).map((u) => [u.id, u.name])
  );

  const users = await db.user.findMany({
    where: { active: true, status: "APROVADO" },
    include: {
      projectsAsConsult: {
        where: { deleted: false },
        include: { client: true, stage: true },
        orderBy: { stageEnteredAt: "asc" },
      },
      activities: {
        where: { status: { in: ["PENDENTE", "EM_ANDAMENTO"] }, project: { deleted: false, status: "ATIVO" } },
      },
    },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });

  const consultores = users.filter((u) => u.role === "CONSULTOR");
  const outros = users.filter((u) => u.role !== "CONSULTOR");
  const pendentes = users.filter((u) => !u.passwordHash);

  const base = process.env.APP_URL ?? "http://localhost:3000";
  // Link de convite atual (válido) de cada pendente, para copiar e mandar direto.
  const linkByUser = new Map<string, string>();
  if (canInvite && pendentes.length > 0) {
    const tokens = await db.inviteToken.findMany({
      where: { userId: { in: pendentes.map((p) => p.id) }, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });
    for (const t of tokens) {
      if (!linkByUser.has(t.userId)) linkByUser.set(t.userId, `${base}/convite?token=${t.token}`);
    }
  }

  let convidadoInfo: { name: string; email: string; url: string } | null = null;
  if (convidado && canInvite) {
    const [target, token] = await Promise.all([
      db.user.findUnique({ where: { id: convidado } }),
      db.inviteToken.findFirst({
        where: { userId: convidado, usedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: "desc" },
      }),
    ]);
    if (target && token) {
      convidadoInfo = { name: target.name, email: target.email, url: `${base}/convite?token=${token.token}` };
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Equipe</h1>
          <p className="text-sm text-muted-foreground">
            Carga de trabalho dos consultores. Referência: 1 é pouco, 2 é ideal, 3 é o limite
          </p>
        </div>

        {canInvite && (
          <InviteUserPanel defaultOpen={convite === "1"}>
            {erroDeConvite && (
              <p className="text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-md px-3 py-2 mb-4">
                {ERROS[erro] ?? "Não foi possível enviar o convite."}
              </p>
            )}
            <p className="text-sm text-muted-foreground mb-4">
              {isDiretoria
                ? "Crie o acesso e defina o papel. A conta nasce ativa com a senha inicial teknisa123; a pessoa entra e troca a senha em Configurações."
                : `Você adiciona consultores(as) e CS para o time ${PRODUCT_LABELS[currentUser.productLine!]}. A conta nasce ativa com a senha inicial teknisa123; a pessoa troca em Configurações.`}
            </p>
            <form action={createUserAction} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="name" className={fieldLabel}>
                    Nome
                  </label>
                  <input id="name" name="name" required className={fieldInput} />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="email" className={fieldLabel}>
                    Email corporativo
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    placeholder="nome@teknisa.com"
                    className={fieldInput}
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="role" className={fieldLabel}>
                    Papel
                  </label>
                  <select id="role" name="role" required defaultValue="" className={fieldInput}>
                    <option value="" disabled>
                      Selecione…
                    </option>
                    {isDiretoria && <option value="DIRETORIA">Diretoria</option>}
                    {isDiretoria && <option value="COORDENACAO">Coordenação</option>}
                    <option value="CONSULTOR">Consultor(a)</option>
                    <option value="CS">Customer Success</option>
                  </select>
                </div>

                {isDiretoria ? (
                  <div className="space-y-1.5">
                    <label htmlFor="productLine" className={fieldLabel}>
                      Produto <span className="text-muted-foreground font-normal">(não se aplica à diretoria)</span>
                    </label>
                    <select id="productLine" name="productLine" defaultValue="" className={fieldInput}>
                      <option value="">Nenhum</option>
                      <option value="TECFOOD">TecFood</option>
                      <option value="RETAIL">Retail</option>
                    </select>
                  </div>
                ) : (
                  <input type="hidden" name="productLine" value={currentUser.productLine ?? ""} />
                )}
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="h-10 px-5 inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary-hover transition-colors"
                >
                  <UserCheck className="h-4 w-4" /> Criar usuário
                </button>
              </div>
            </form>
          </InviteUserPanel>
        )}
      </div>

      {!erroDeConvite && erro && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {ERROS[erro] ?? "Não foi possível concluir a ação."}
        </div>
      )}
      {criado === "1" && (
        <div className="rounded-md border border-success/30 bg-success/5 px-4 py-3 text-sm text-success">
          Usuário criado com acesso ativo. Senha inicial: <strong>teknisa123</strong>. Peça para a
          pessoa trocar em Configurações no primeiro acesso.
        </div>
      )}
      {removido === "1" && (
        <div className="rounded-md border border-success/30 bg-success/5 px-4 py-3 text-sm text-success">
          Usuário apagado.
        </div>
      )}

      {convidadoInfo && (
        <div className="rounded-lg border border-success/30 bg-success/5 p-4">
          <div className="flex items-start gap-3">
            <MailCheck className="h-5 w-5 text-success shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-success">
                Convite criado para {convidadoInfo.name}.
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Tentamos enviar por email para {convidadoInfo.email}. Se preferir, copie o link e mande direto
                (WhatsApp, Discord, etc.).
              </p>
              <div className="mt-3 flex items-center gap-2 rounded-md bg-card border border-border px-3 py-2">
                <Link2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                  {convidadoInfo.url}
                </span>
                <CopyLinkButton text={convidadoInfo.url} />
              </div>
            </div>
          </div>
        </div>
      )}

      {canReview && solicitacoes.length > 0 && (
        <section className="bg-card border border-primary/30 rounded-lg p-5">
          <h2 className="text-sm font-semibold inline-flex items-center gap-2 mb-1">
            <UserCheck className="h-4 w-4 text-primary" /> Solicitações de acesso
            <span className="rounded-full bg-primary text-primary-foreground px-2 py-0.5 text-xs">
              {solicitacoes.length}
            </span>
          </h2>
          <p className="text-xs text-muted-foreground mb-4">
            Pessoas que definiram a senha em &quot;Primeiro acesso&quot;. Ninguém entra no sistema
            sem passar por aqui. Confirme que a pessoa é quem diz ser, defina o papel e o produto
            para liberar, ou recuse. A decisão fica registrada com o seu nome.
          </p>
          <div className="space-y-3">
            {solicitacoes.map((s) => (
              <div key={s.id} className="rounded-md border border-border bg-card p-3.5">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-sm font-medium">{s.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.email} · solicitado em {fmtDate(s.createdAt)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Pediu acesso como <strong className="text-foreground/80">{ROLE_LABELS[s.role]}</strong>
                      {s.productLine ? ` · ${PRODUCT_LABELS[s.productLine]}` : ""}
                    </p>
                  </div>
                  <form action={rejectAccessRequest}>
                    <input type="hidden" name="userId" value={s.id} />
                    <button className="h-8 px-2.5 inline-flex items-center gap-1.5 rounded-md border border-destructive/30 text-destructive text-xs font-medium hover:bg-destructive/5">
                      <X className="h-3.5 w-3.5" /> Recusar
                    </button>
                  </form>
                </div>

                <form
                  action={approveAccessRequest}
                  className="grid sm:grid-cols-[1fr_1fr_auto] gap-3 items-end mt-3 pt-3 border-t border-border"
                >
                  <input type="hidden" name="userId" value={s.id} />
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Papel</label>
                    <select name="role" defaultValue={s.role} required className={fieldInput}>
                      {isDiretoria && <option value="DIRETORIA">Diretoria</option>}
                      {isDiretoria && <option value="COORDENACAO">Coordenação</option>}
                      <option value="CONSULTOR">Consultor(a)</option>
                      <option value="CS">Customer Success</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Produto</label>
                    <select
                      name="productLine"
                      defaultValue={s.productLine ?? (isDiretoria ? "" : currentUser.productLine ?? "")}
                      className={fieldInput}
                    >
                      <option value="">Nenhum (diretoria)</option>
                      <option value="TECFOOD">TecFood</option>
                      <option value="RETAIL">Retail</option>
                    </select>
                  </div>
                  <button className="h-10 px-4 inline-flex items-center justify-center gap-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary-hover transition-colors">
                    <Check className="h-4 w-4" /> Liberar acesso
                  </button>
                </form>
              </div>
            ))}
          </div>
        </section>
      )}

      {canReview && decisoes.length > 0 && (
        <section className="bg-card border border-border rounded-lg p-5">
          <h2 className="text-sm font-semibold inline-flex items-center gap-2 mb-1">
            <History className="h-4 w-4 text-muted-foreground" /> Decisões de acesso
          </h2>
          <p className="text-xs text-muted-foreground mb-4">
            Quem liberou ou recusou cada acesso ao sistema.
          </p>
          <ul className="divide-y divide-border">
            {decisoes.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 py-2 flex-wrap">
                <div className="min-w-0">
                  <p className="text-sm">
                    <span className="font-medium">{d.name}</span>{" "}
                    <span className="text-muted-foreground">
                      {ROLE_LABELS[d.role]}
                      {d.productLine ? ` · ${PRODUCT_LABELS[d.productLine]}` : ""}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">{d.email}</p>
                </div>
                <div className="text-xs text-right shrink-0">
                  <span
                    className={`font-semibold ${
                      d.status === "APROVADO" ? "text-success" : "text-destructive"
                    }`}
                  >
                    {d.status === "APROVADO" ? "Liberado" : "Recusado"}
                  </span>
                  <span className="text-muted-foreground">
                    {" "}
                    por {decisores.get(d.approvedById!) ?? "usuário removido"} em{" "}
                    {fmtDate(d.approvedAt)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {canInvite && pendentes.length > 0 && (
        <section className="bg-card border border-warning-bg/40 bg-warning-bg/5 rounded-lg p-5">
          <h2 className="text-sm font-semibold inline-flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4 text-warning" /> Convites pendentes
          </h2>
          <div className="space-y-2">
            {pendentes.map((u) => {
              const link = linkByUser.get(u.id) ?? null;
              return (
                <div
                  key={u.id}
                  className="rounded-md border border-border bg-card px-3.5 py-2.5 space-y-2"
                >
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <p className="text-sm font-medium">{u.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {u.email} · {ROLE_LABELS[u.role]}
                        {u.productLine ? ` · ${PRODUCT_LABELS[u.productLine]}` : ""} · convidado em{" "}
                        {fmtDate(u.createdAt)}
                      </p>
                    </div>
                    <form action={resendInviteAction}>
                      <input type="hidden" name="userId" value={u.id} />
                      <button className="h-8 px-2.5 inline-flex items-center gap-1.5 rounded-md border border-border text-xs font-medium hover:bg-muted">
                        <Send className="h-3.5 w-3.5" /> Reenviar convite
                      </button>
                    </form>
                  </div>
                  {link ? (
                    <div className="flex items-center gap-2 rounded-md bg-muted/50 border border-border px-3 py-1.5">
                      <Link2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{link}</span>
                      <CopyLinkButton text={link} />
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Sem link ativo. A pessoa pode definir a senha em &quot;Primeiro acesso&quot;,
                      ou use &quot;Reenviar convite&quot; para gerar um link.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {consultores.map((c) => {
          const ativos = c.projectsAsConsult.filter(
            (p) => p.status === "ATIVO" && !p.stage.isFinal
          );
          const finalizados = c.projectsAsConsult.filter((p) => p.stage.isFinal);
          const n = ativos.length;
          const loadCls =
            n >= 3 ? "bg-destructive/10 text-destructive" : n === 2 ? "bg-warning/10 text-warning" : "bg-success/10 text-success";
          const away = c.awayUntil && new Date(c.awayUntil) > new Date();
          return (
            <div key={c.id} className="bg-card border border-border rounded-lg p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.productLine ? PRODUCT_LABELS[c.productLine] : ""} ·{" "}
                    {c.seniority ? c.seniority.toLowerCase() : "senioridade não informada"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {!c.passwordHash && (
                    <span className="rounded-full bg-warning-bg/15 text-warning px-2 py-0.5 text-xs font-medium">
                      Convite pendente
                    </span>
                  )}
                  {away && (
                    <span className="inline-flex items-center gap-1 text-xs text-warning">
                      <CalendarOff className="h-3.5 w-3.5" /> até {fmtDate(c.awayUntil)}
                    </span>
                  )}
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${loadCls}`}>
                    {n} ativo{n === 1 ? "" : "s"}
                  </span>
                  {/* Só os campos que o painel usa. Passar o registro inteiro
                      mandaria o hash da senha para o navegador junto. */}
                  {canEditRoles && (
                    <EditRolePanel
                      targetUser={{
                        id: c.id,
                        name: c.name,
                        role: c.role,
                        productLine: c.productLine,
                      }}
                    />
                  )}
                  {canEditRoles && c.id !== currentUser.id && (
                    <DeleteUserPanel
                      userId={c.id}
                      nome={c.name}
                      projetosAtivos={n}
                      tarefasAbertas={c.activities.length}
                    />
                  )}
                </div>
              </div>

              <div className="mt-3 space-y-1.5">
                {ativos.map((p) => (
                  <Link
                    key={p.id}
                    href={`/projetos/${p.id}`}
                    className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5 hover:bg-muted/50 transition-colors"
                  >
                    <span className="text-sm flex-1 truncate">{p.client.razaoSocial}</span>
                    <StageBadge label={p.stage.nome} />
                  </Link>
                ))}
                {ativos.length === 0 && (
                  <p className="text-sm text-muted-foreground">Disponível para novos projetos.</p>
                )}
              </div>

              <p className="mt-3 text-xs text-muted-foreground border-t border-border pt-2">
                {c.activities.length} tarefa{c.activities.length === 1 ? "" : "s"} aberta
                {c.activities.length === 1 ? "" : "s"} · {finalizados.length} projeto
                {finalizados.length === 1 ? "" : "s"} finalizado{finalizados.length === 1 ? "" : "s"}
              </p>
            </div>
          );
        })}
        {consultores.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum consultor cadastrado.</p>
        )}
      </div>

      <section>
        <h2 className="text-sm font-semibold text-foreground/80 mb-3">Coordenação, diretoria e CS</h2>
        <div className="bg-card border border-border rounded-lg divide-y divide-border">
          {outros.map((u) => (
            <div key={u.id} className="flex items-center justify-between px-4 py-2.5 flex-wrap gap-2">
              <div>
                <p className="text-sm font-medium">{u.name}</p>
                <p className="text-xs text-muted-foreground">{u.email}</p>
              </div>
              <div className="flex items-center gap-2">
                {!u.passwordHash && (
                  <span className="rounded-full bg-warning-bg/15 text-warning px-2 py-0.5 text-xs font-medium">
                    Convite pendente
                  </span>
                )}
                {u.productLine && <ProductBadge line={u.productLine} />}
                <span className="text-xs text-muted-foreground">{ROLE_LABELS[u.role]}</span>
                {canEditRoles && (
                  <EditRolePanel
                    targetUser={{
                      id: u.id,
                      name: u.name,
                      role: u.role,
                      productLine: u.productLine,
                    }}
                  />
                )}
                {canEditRoles && u.id !== currentUser.id && (
                  <DeleteUserPanel
                    userId={u.id}
                    nome={u.name}
                    projetosAtivos={u.projectsAsConsult.filter((p) => p.status === "ATIVO" && !p.stage.isFinal).length}
                    tarefasAbertas={u.activities.length}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
