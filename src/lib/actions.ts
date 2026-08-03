"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import path from "path";
import { db } from "./db";
import { createSession, destroySession, requireUser } from "./auth";
import { firstStage } from "./pipeline";
import { joinChoices, splitChoices, TOTAL_ETAPAS } from "./intake";
import { comparaCampo, mesmaPessoa, normalizaEmail } from "./identity";
import { PRODUCT_LABELS, ROLE_LABELS } from "./format";
import {
  canAllocateConsultant,
  canAssignRole,
  canCancelProject,
  canCreateClient,
  canDeleteClient,
  canEditClient,
  canHardDeleteClient,
  canEditPipeline,
  canEditUserRoles,
  canInviteUsers,
  canJustifyDelay,
  canManageActivities,
  canMoveStage,
  canPauseResumeProject,
  canReviewAccessRequests,
  canUploadDocuments,
} from "./permissions";
import type { LeituraContrato } from "./contrato-pdf";
import type { LeituraPlano } from "./plano-pdf";
import type { ActivityStatus, ProductLine, Responsavel, Role } from "@prisma/client";

// ─── Auth ───────────────────────────────────────────────────────────

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const user = await db.user.findUnique({ where: { email } });
  if (!user || !user.active) redirect("/login?erro=credenciais");
  if (!user.passwordHash) redirect("/login?erro=sem-senha");
  if (!bcrypt.compareSync(password, user.passwordHash)) redirect("/login?erro=credenciais");
  // só depois de conferir a senha revelamos o estado da liberação, para não
  // expor a situação de contas alheias a quem só chutou o email
  if (user.status === "PENDENTE") redirect("/login?erro=pendente");
  if (user.status === "RECUSADO") redirect("/login?erro=recusado");
  await createSession(user.id);
  redirect("/");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

// Domínio de email aceito no autocadastro (ferramenta interna).
const DOMINIO_PERMITIDO = process.env.ALLOWED_EMAIL_DOMAIN ?? "teknisa.com";

// Papéis válidos. Formulário é entrada não confiável: um valor fora desta
// lista chega ao Prisma como enum inválido e derruba a requisição.
const PAPEIS: Role[] = ["DIRETORIA", "COORDENACAO", "CONSULTOR", "CS"];
function papelValido(v: FormDataEntryValue | null): v is Role {
  return PAPEIS.includes(String(v ?? "") as Role);
}

// Primeiro acesso. Qualquer pessoa do domínio pode pedir, mas **ninguém entra
// por aqui**: o primeiro acesso só define a senha e abre uma solicitação. O
// acesso de verdade é liberado por diretoria ou coordenação em /equipe, e essa
// decisão fica registrada (quem liberou ou recusou, e quando).
//
// Vale para os dois casos, conta nova e conta já pré-cadastrada sem senha. É o
// que impede alguém de tomar uma conta alheia ainda não ativada só por saber o
// email dela. Quem foi convidado tem o caminho direto pelo link do convite
// (/convite?token=), que já prova que a coordenação autorizou.
export async function firstAccessAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const papel = formData.get("role");
  const productLineRaw = String(formData.get("productLine") ?? "").trim();
  const productLine = (
    productLineRaw === "TECFOOD" || productLineRaw === "RETAIL" ? productLineRaw : null
  ) as ProductLine | null;

  if (password.length < 8) redirect("/primeiro-acesso?erro=senha-curta");

  // O domínio vale para os dois caminhos, não só para o autocadastro.
  if (!email.endsWith(`@${DOMINIO_PERMITIDO}`)) redirect("/primeiro-acesso?erro=dominio");

  const existing = await db.user.findUnique({ where: { email } });

  if (existing) {
    if (!existing.active) redirect("/primeiro-acesso?erro=nao-encontrado");
    if (existing.passwordHash) redirect("/primeiro-acesso?erro=ja-ativada");

    // Define a senha e volta a conta para PENDENTE. Mesmo que ela já estivesse
    // aprovada (pré-cadastro da diretoria), quem definiu a senha ainda precisa
    // ser reconhecido por alguém do time antes de entrar.
    const alvo = await db.user.update({
      where: { id: existing.id },
      data: {
        passwordHash: bcrypt.hashSync(password, 10),
        status: "PENDENTE",
        approvedAt: null,
        approvedById: null,
      },
    });
    await db.session.deleteMany({ where: { userId: alvo.id } });
    await db.notification.create({
      data: {
        tipo: "ACESSO_SOLICITADO",
        titulo: `Solicitação de acesso: ${alvo.name}`,
        corpo: `${alvo.email} definiu a senha em "Primeiro acesso" e aguarda liberação. Confira em Equipe se a pessoa é quem diz ser antes de liberar.`,
      },
    });
    redirect("/login?aviso=solicitado");
  }

  if (!name || !papelValido(papel)) redirect("/primeiro-acesso?erro=campos");
  const role = String(papel) as Role;
  const precisaProduto = role !== "DIRETORIA";
  if (precisaProduto && !productLine) redirect("/primeiro-acesso?erro=produto-obrigatorio");

  const created = await db.user.create({
    data: {
      name,
      email,
      passwordHash: bcrypt.hashSync(password, 10),
      role, // papel *solicitado*, confirmado na aprovação
      productLine: precisaProduto ? productLine : null,
      status: "PENDENTE",
    },
  });

  await db.notification.create({
    data: {
      tipo: "ACESSO_SOLICITADO",
      titulo: `Nova solicitação de acesso: ${created.name}`,
      corpo: `${created.email} pediu acesso como ${ROLE_LABELS[role]}${
        created.productLine ? ` · ${PRODUCT_LABELS[created.productLine]}` : ""
      }. Libere em Equipe.`,
    },
  });

  redirect("/login?aviso=solicitado");
}

export async function forgotPasswordAction(formData: FormData) {
  const { sendPasswordResetEmail } = await import("./mailer");
  const crypto = await import("crypto");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const user = await db.user.findUnique({ where: { email } });

  // resposta idêntica exista ou não a conta, para não vazar emails cadastrados
  if (user && user.active) {
    const token = crypto.randomBytes(32).toString("hex");
    await db.passwordResetToken.create({
      data: { token, userId: user.id, expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
    });
    const base = process.env.APP_URL ?? "http://localhost:3000";
    const result = await sendPasswordResetEmail(
      user.email,
      user.name,
      `${base}/redefinir-senha?token=${token}`
    );
    if (!result.sent && result.devLink) {
      redirect(`/esqueci-senha?ok=1&dev=${encodeURIComponent(result.devLink)}`);
    }
  }
  redirect("/esqueci-senha?ok=1");
}

export async function resetPasswordAction(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) redirect(`/redefinir-senha?token=${token}&erro=senha-curta`);

  const reset = await db.passwordResetToken.findUnique({ where: { token } });
  if (!reset || reset.usedAt || reset.expiresAt < new Date()) {
    redirect("/redefinir-senha?erro=token");
  }

  await db.user.update({
    where: { id: reset.userId },
    data: { passwordHash: bcrypt.hashSync(password, 10) },
  });
  await db.passwordResetToken.update({ where: { id: reset.id }, data: { usedAt: new Date() } });
  await db.session.deleteMany({ where: { userId: reset.userId } }); // derruba sessões antigas
  await createSession(reset.userId);
  redirect("/");
}

// ─── Gestão de usuários e convites ──────────────────────────────────
// Só diretoria e coordenação convidam (canInviteUsers); coordenação só
// convida consultor/CS do próprio produto (canAssignRole).

export async function inviteUserAction(formData: FormData) {
  const inviter = await requireUser();
  if (!canInviteUsers(inviter)) redirect("/equipe?erro=permissao");

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "") as Role;
  const productLineRaw = String(formData.get("productLine") ?? "").trim();
  const productLine = (
    productLineRaw === "TECFOOD" || productLineRaw === "RETAIL" ? productLineRaw : null
  ) as ProductLine | null;

  if (!name || !email || !papelValido(role)) redirect("/equipe?erro=campos&convite=1");
  if (!canAssignRole(inviter, role, productLine)) redirect("/equipe?erro=permissao-papel&convite=1");

  const needsProductLine = role === "COORDENACAO" || role === "CONSULTOR" || role === "CS";
  if (needsProductLine && !productLine) redirect("/equipe?erro=produto-obrigatorio&convite=1");

  const existing = await db.user.findUnique({ where: { email } });
  // conta ativa com esse email bloqueia; conta arquivada é reativada, para não
  // virar beco sem saída quando alguém volta para o time
  if (existing && !existing.deletedAt) redirect("/equipe?erro=email-existente&convite=1");

  const crypto = await import("crypto");
  const token = crypto.randomBytes(32).toString("hex");

  // usuário + token nascem juntos: se um falhar, não sobra usuário órfão sem convite
  const user = await db.$transaction(async (tx) => {
    const dados = {
      name,
      email,
      role,
      productLine: needsProductLine ? productLine : null,
      passwordHash: null,
    };
    const created = existing
      ? await tx.user.update({
          where: { id: existing.id },
          data: { ...dados, active: true, deletedAt: null, status: "APROVADO" as const },
        })
      : await tx.user.create({ data: dados });
    await tx.inviteToken.create({
      data: {
        token,
        userId: created.id,
        invitedById: inviter.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    return created;
  });

  const { sendInviteEmail } = await import("./mailer");
  const base = process.env.APP_URL ?? "http://localhost:3000";
  await sendInviteEmail(user.email, user.name, inviter.name, `${base}/convite?token=${token}`);

  revalidatePath("/equipe");
  redirect(`/equipe?convidado=${user.id}`);
}

export async function resendInviteAction(formData: FormData) {
  const inviter = await requireUser();
  if (!canInviteUsers(inviter)) redirect("/equipe?erro=permissao");

  const userId = String(formData.get("userId"));
  const target = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (target.passwordHash) redirect("/equipe"); // já ativou a conta, nada a reenviar
  if (!canAssignRole(inviter, target.role, target.productLine)) redirect("/equipe?erro=permissao");

  await db.inviteToken.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date() }, // invalida convites antigos ainda válidos
  });

  const crypto = await import("crypto");
  const token = crypto.randomBytes(32).toString("hex");
  await db.inviteToken.create({
    data: {
      token,
      userId,
      invitedById: inviter.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  const { sendInviteEmail } = await import("./mailer");
  const base = process.env.APP_URL ?? "http://localhost:3000";
  await sendInviteEmail(target.email, target.name, inviter.name, `${base}/convite?token=${token}`);

  revalidatePath("/equipe");
  redirect(`/equipe?convidado=${userId}`);
}

export async function acceptInviteAction(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) redirect(`/convite?token=${token}&erro=senha-curta`);

  const invite = await db.inviteToken.findUnique({ where: { token } });
  if (!invite || invite.usedAt || invite.expiresAt < new Date()) {
    redirect("/convite?erro=token");
  }
  const target = await db.user.findUniqueOrThrow({ where: { id: invite.userId } });
  if (target.passwordHash) redirect("/login?erro=ja-ativada");

  await db.user.update({
    where: { id: target.id },
    data: { passwordHash: bcrypt.hashSync(password, 10) },
  });
  await db.inviteToken.update({ where: { id: invite.id }, data: { usedAt: new Date() } });
  await createSession(target.id);
  redirect("/");
}

// ─── Solicitações de acesso (autocadastro pelo primeiro acesso) ─────

export async function approveAccessRequest(formData: FormData) {
  const actor = await requireUser();
  if (!canReviewAccessRequests(actor)) redirect("/equipe?erro=permissao");

  const userId = String(formData.get("userId"));
  const role = String(formData.get("role")) as Role;
  if (!papelValido(role)) redirect("/equipe?erro=papel");
  const productLineRaw = String(formData.get("productLine") ?? "").trim();
  const productLine = (
    productLineRaw === "TECFOOD" || productLineRaw === "RETAIL" ? productLineRaw : null
  ) as ProductLine | null;

  const target = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (target.status !== "PENDENTE") redirect("/equipe");
  if (!canAssignRole(actor, role, productLine)) redirect("/equipe?erro=permissao-papel");

  const precisaProduto = role !== "DIRETORIA";
  if (precisaProduto && !productLine) redirect("/equipe?erro=produto-obrigatorio");

  await db.user.update({
    where: { id: userId },
    data: {
      role,
      productLine: precisaProduto ? productLine : null,
      status: "APROVADO",
      approvedAt: new Date(),
      approvedById: actor.id,
    },
  });
  await db.notification.create({
    data: {
      userId,
      tipo: "ACESSO_LIBERADO",
      titulo: "Seu acesso ao CRM Express foi liberado",
      corpo: `Liberado por ${actor.name}.`,
    },
  });

  revalidatePath("/equipe");
  revalidatePath("/", "layout");
  redirect("/equipe");
}

export async function rejectAccessRequest(formData: FormData) {
  const actor = await requireUser();
  if (!canReviewAccessRequests(actor)) redirect("/equipe?erro=permissao");

  const userId = String(formData.get("userId"));
  const target = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (target.status !== "PENDENTE") redirect("/equipe");
  if (!canAssignRole(actor, target.role, target.productLine)) redirect("/equipe?erro=permissao");

  await db.user.update({
    where: { id: userId },
    data: {
      status: "RECUSADO",
      active: false,
      // `approvedAt`/`approvedById` guardam a decisão, seja ela qual for: o
      // `status` diz se foi liberação ou recusa. É o que alimenta o log de
      // "Decisões de acesso" em /equipe.
      approvedAt: new Date(),
      approvedById: actor.id,
    },
  });
  await db.session.deleteMany({ where: { userId } }); // derruba qualquer sessão aberta

  revalidatePath("/equipe");
  revalidatePath("/", "layout");
  redirect("/equipe");
}

export async function updateUserRoleAction(formData: FormData) {
  const actor = await requireUser();
  if (!canEditUserRoles(actor)) redirect("/equipe?erro=permissao");

  const userId = String(formData.get("userId"));
  const roleRaw = String(formData.get("role") ?? "");
  if (!PAPEIS.includes(roleRaw as Role)) redirect("/equipe?erro=papel");
  const role = roleRaw as Role;
  const productLineRaw = String(formData.get("productLine") ?? "").trim();
  if (productLineRaw && productLineRaw !== "TECFOOD" && productLineRaw !== "RETAIL") {
    redirect("/equipe?erro=produto-invalido");
  }
  const productLine = (productLineRaw || null) as ProductLine | null;
  const needsProductLine = role !== "DIRETORIA";

  const alvo = await db.user.findUniqueOrThrow({ where: { id: userId } });
  // Tirar a última diretoria trancaria a porta para todo mundo: ninguém
  // sobraria para editar papéis, liberar acessos ou mexer na pipeline.
  if (alvo.role === "DIRETORIA" && role !== "DIRETORIA") {
    const outras = await db.user.count({
      where: { role: "DIRETORIA", active: true, status: "APROVADO", id: { not: userId } },
    });
    if (outras === 0) redirect("/equipe?erro=ultima-diretoria");
  }

  await db.user.update({
    where: { id: userId },
    data: { role, productLine: needsProductLine ? productLine : null },
  });
  revalidatePath("/equipe");
  revalidatePath("/", "layout");
  redirect("/equipe");
}

// Apagar usuário = arquivar. O registro da pessoa continua no banco de
// propósito: comentários, movimentações de etapa, justificativas e itens de
// checklist mantêm o autor, que é o que a gestão precisa consultar depois. O
// que some é o acesso e a presença nas listas de trabalho.
export async function deleteUserAction(formData: FormData) {
  const actor = await requireUser();
  if (!canEditUserRoles(actor)) redirect("/equipe?erro=permissao");

  const userId = String(formData.get("userId"));
  if (userId === actor.id) redirect("/equipe?erro=auto-exclusao");

  const alvo = await db.user.findUniqueOrThrow({ where: { id: userId } });
  // coordenação não chega aqui (canEditUserRoles é só diretoria), mas a checagem
  // de papel evita que uma futura mudança abra brecha
  if (!canAssignRole(actor, alvo.role, alvo.productLine)) redirect("/equipe?erro=permissao");

  // Arquivar a última diretoria deixaria o sistema sem ninguém para liberar
  // acessos, editar papéis ou mexer na pipeline.
  if (alvo.role === "DIRETORIA") {
    const outras = await db.user.count({
      where: { role: "DIRETORIA", active: true, status: "APROVADO", id: { not: userId } },
    });
    if (outras === 0) redirect("/equipe?erro=ultima-diretoria");
  }

  await db.$transaction(async (tx) => {
    // tira o acesso
    await tx.session.deleteMany({ where: { userId } });
    await tx.inviteToken.deleteMany({ where: { userId } });
    await tx.passwordResetToken.deleteMany({ where: { userId } });
    // solta só o trabalho em aberto, para a coordenação realocar; o que já foi
    // concluído continua atribuído a quem fez
    await tx.project.updateMany({ where: { consultantId: userId }, data: { consultantId: null } });
    await tx.projectActivity.updateMany({
      where: { assigneeId: userId, status: { in: ["PENDENTE", "EM_ANDAMENTO"] } },
      data: { assigneeId: null },
    });
    // arquiva mantendo o histórico intacto
    await tx.user.update({
      where: { id: userId },
      data: { active: false, deletedAt: new Date() },
    });
  });

  revalidatePath("/equipe");
  revalidatePath("/", "layout");
  redirect("/equipe?removido=1");
}

// ─── Cliente: edição, contatos e documentos ────────────────────────

// Confere no servidor se a pessoa pode mexer no cadastro deste cliente. O
// cliente não tem produto próprio: a regra vem dos projetos dele
// (ver canEditClient). Devolve o usuário para quem passa, e corta quem não.
async function exigeAcessoAoCliente(clientId: string) {
  const user = await requireUser();
  const projects = await db.project.findMany({
    where: { clientId, deleted: false },
    select: { consultantId: true, productLine: true },
  });
  if (!canEditClient(user, projects)) {
    redirect(`/clientes/${clientId}?erro=permissao`);
  }
  return user;
}

export async function updateClientAction(formData: FormData) {
  const clientId = String(formData.get("clientId"));
  await exigeAcessoAoCliente(clientId);
  await db.client.update({
    where: { id: clientId },
    data: {
      razaoSocial: String(formData.get("razaoSocial") ?? "").trim(),
      nomeFantasia: textoOuNull(formData.get("nomeFantasia")),
      cnpj: textoOuNull(formData.get("cnpj")),
      endereco: textoOuNull(formData.get("endereco")),
      cidade: textoOuNull(formData.get("cidade")),
      uf: (textoOuNull(formData.get("uf")) ?? "").toUpperCase() || null,
      propostaNumero: textoOuNull(formData.get("propostaNumero")),
      notes: textoOuNull(formData.get("notes")),
    },
  });
  revalidatePath(`/clientes/${clientId}`);
  redirect(`/clientes/${clientId}?ok=cliente`);
}

export async function addContactAction(formData: FormData) {
  const clientId = String(formData.get("clientId"));
  await exigeAcessoAoCliente(clientId);
  const nome = String(formData.get("nome") ?? "").trim();
  if (!nome) redirect(`/clientes/${clientId}?erro=contato`);
  await db.contact.create({
    data: {
      clientId,
      nome,
      cargo: textoOuNull(formData.get("cargo")),
      email: textoOuNull(formData.get("email"))?.toLowerCase() ?? null,
      telefone: textoOuNull(formData.get("telefone")),
    },
  });
  revalidatePath(`/clientes/${clientId}`);
  redirect(`/clientes/${clientId}?ok=contato`);
}

export async function updateContactAction(formData: FormData) {
  const contactId = String(formData.get("contactId"));
  const contato = await db.contact.findUniqueOrThrow({ where: { id: contactId } });
  await exigeAcessoAoCliente(contato.clientId);
  await db.contact.update({
    where: { id: contactId },
    data: {
      nome: String(formData.get("nome") ?? "").trim() || contato.nome,
      cargo: textoOuNull(formData.get("cargo")),
      email: textoOuNull(formData.get("email"))?.toLowerCase() ?? null,
      telefone: textoOuNull(formData.get("telefone")),
    },
  });
  revalidatePath(`/clientes/${contato.clientId}`);
  redirect(`/clientes/${contato.clientId}?ok=contato`);
}

// Edição do contrato. É aqui que se ajusta o prazo contratual do treinamento,
// que varia por cliente e alimenta o marco na página do projeto.
export async function updateContractAction(formData: FormData) {
  const contractId = String(formData.get("contractId"));
  const contrato = await db.contract.findUniqueOrThrow({ where: { id: contractId } });
  await exigeAcessoAoCliente(contrato.clientId);

  const dataAssinatura = dataOuNull(formData.get("dataAssinatura"));
  const numero = String(formData.get("numero") ?? "").trim() || contrato.numero;

  // O número do contrato é único no sistema. Sem esta conferência, repetir um
  // número já cadastrado derruba a página com erro de banco.
  if (numero !== contrato.numero) {
    const jaExiste = await db.contract.findUnique({ where: { numero } });
    if (jaExiste) redirect(`/clientes/${contrato.clientId}?erro=contrato-duplicado`);
  }

  await db.contract.update({
    where: { id: contractId },
    data: {
      numero,
      dataAssinatura,
      vigenciaMeses: inteiroOuNull(formData.get("vigenciaMeses")),
      valorLicenca: numOrNull(formData.get("valorLicenca")),
      valorMensal: numOrNull(formData.get("valorMensal")),
      limiteSaasMb: inteiroOuNull(formData.get("limiteSaasMb")),
      horasTreinamento: inteiroOuNull(formData.get("horasTreinamento")),
      prazoTreinamentoDias: inteiroOuNull(formData.get("prazoTreinamentoDias")),
      contatoTeknisa: textoOuNull(formData.get("contatoTeknisa")),
    },
  });

  revalidatePath(`/clientes/${contrato.clientId}`);
  revalidatePath("/", "layout"); // o marco contratual aparece no projeto e no dashboard
  redirect(`/clientes/${contrato.clientId}?ok=contrato`);
}

export async function deleteContactAction(formData: FormData) {
  const contactId = String(formData.get("contactId"));
  const contato = await db.contact.findUniqueOrThrow({ where: { id: contactId } });
  await exigeAcessoAoCliente(contato.clientId);
  await db.contact.delete({ where: { id: contactId } });
  revalidatePath(`/clientes/${contato.clientId}`);
  redirect(`/clientes/${contato.clientId}`);
}

// ─── Apagar cliente: arquivar, apagar em definitivo, restaurar ─────
// Arquivar é o padrão (some das listas, guarda o histórico). Apagar em
// definitivo é da diretoria e leva tudo por cascade. Ver permissions.ts.

async function projetosDoCliente(clientId: string) {
  return db.project.findMany({
    where: { clientId },
    select: { id: true, consultantId: true, productLine: true },
  });
}

// Arquivar: o cliente e seus projetos somem das listas, do funil e do
// dashboard, mas continuam no banco.
export async function archiveClientAction(formData: FormData) {
  const user = await requireUser();
  const clientId = String(formData.get("clientId"));
  const projetos = await projetosDoCliente(clientId);
  if (!canDeleteClient(user, projetos)) redirect(`/clientes/${clientId}?erro=permissao`);

  await db.$transaction([
    db.client.update({ where: { id: clientId }, data: { deletedAt: new Date() } }),
    db.project.updateMany({ where: { clientId }, data: { deleted: true } }),
  ]);

  revalidatePath("/", "layout");
  redirect("/clientes?arquivado=1");
}

// Restaurar um cliente arquivado (volta o cliente e os projetos dele).
export async function restoreClientAction(formData: FormData) {
  const user = await requireUser();
  const clientId = String(formData.get("clientId"));
  const projetos = await projetosDoCliente(clientId);
  if (!canDeleteClient(user, projetos)) redirect(`/clientes/${clientId}?erro=permissao`);

  await db.$transaction([
    db.client.update({ where: { id: clientId }, data: { deletedAt: null } }),
    db.project.updateMany({ where: { clientId }, data: { deleted: false } }),
  ]);

  revalidatePath("/", "layout");
  redirect(`/clientes/${clientId}?ok=restaurado`);
}

// Apagar em definitivo: cascade remove projetos, contratos, atividades,
// anexos e histórico. Só a diretoria, e sem volta.
export async function hardDeleteClientAction(formData: FormData) {
  const user = await requireUser();
  if (!canHardDeleteClient(user)) redirect("/clientes?erro=permissao");
  const clientId = String(formData.get("clientId"));

  // Os anexos são guardados no próprio banco; o cascade os remove junto com o
  // cliente. Não há mais arquivo em disco para limpar.
  await db.client.delete({ where: { id: clientId } });

  revalidatePath("/", "layout");
  redirect("/clientes?removido=1");
}

// ─── Reanexar contrato a um cliente já cadastrado ──────────────────
// O contrato do cliente mudou (aditivo, correção). Ao anexar o novo PDF na
// página do cliente, ou o cadastro é atualizado usando o contrato como base,
// ou o arquivo é só guardado e os dados atuais ficam. A escolha é do usuário,
// confirmada na tela antes de qualquer alteração (ver ContractReuploadPanel).

export async function applyContractToClient(formData: FormData) {
  const clientId = String(formData.get("clientId"));
  const user = await exigeAcessoAoCliente(clientId); // já checa permissão e existência
  const modo = String(formData.get("modo")); // "atualizar" | "anexar"

  const pdf = formData.get("contrato");
  if (!(pdf instanceof File) || pdf.size === 0) {
    redirect(`/clientes/${clientId}?erro=arquivo`);
  }
  if (path.extname(pdf.name).toLowerCase() !== ".pdf") {
    redirect(`/clientes/${clientId}?erro=arquivo-tipo`);
  }
  if (pdf.size > TAMANHO_MAXIMO_MB * 1024 * 1024) {
    redirect(`/clientes/${clientId}?erro=arquivo-grande`);
  }

  const client = await db.client.findUniqueOrThrow({
    where: { id: clientId },
    include: { projects: { where: { deleted: false }, orderBy: { createdAt: "desc" } } },
  });
  // O anexo e o contrato ficam ligados a um projeto. Prefere um do mesmo
  // produto do contrato; senão, o projeto mais recente do cliente.
  if (client.projects.length === 0) redirect(`/clientes/${clientId}?erro=sem-projeto`);

  const { lerContratoAssinado } = await import("./contrato-pdf");
  const lido = await lerContratoAssinado(new Uint8Array(await pdf.arrayBuffer()));
  if (!lido.ok) redirect(`/clientes/${clientId}?erro=contrato-ilegivel`);

  const projeto =
    client.projects.find((p) => p.productLine === lido.productLine) ?? client.projects[0];

  // Anexa o PDF ao projeto sempre, nos dois modos.
  const pdfBytes = Buffer.from(await pdf.arrayBuffer());
  await db.projectDocument.create({
    data: {
      projectId: projeto.id,
      filename: pdf.name,
      uploadedById: user.id,
      data: pdfBytes,
      mimeType: mimeDoArquivo(pdf.name),
      size: pdfBytes.length,
    },
  });

  if (modo !== "atualizar") {
    // Só guardar o arquivo, manter o cadastro como está.
    await db.timelineEntry.create({
      data: {
        projectId: projeto.id,
        tipo: "SISTEMA",
        texto: `Novo contrato anexado (${pdf.name}). Cadastro mantido como estava, por escolha de ${user.name}.`,
      },
    });
    revalidatePath(`/clientes/${clientId}`);
    revalidatePath("/", "layout");
    redirect(`/clientes/${clientId}?ok=contrato-anexado`);
  }

  // modo "atualizar": o contrato novo passa a ser a base do cadastro.
  const mudancas: string[] = [];

  // 1) Dados cadastrais: sobrescreve o que o contrato traz; o que ele não
  // traz fica como está. CNPJ é único, então só muda se ninguém mais o usa.
  const campos: Record<string, string | null> = {};
  const put = (col: string, atual: string | null, novo: string | null, rotulo: string) => {
    if (novo && novo !== atual) {
      campos[col] = novo;
      mudancas.push(rotulo);
    }
  };
  put("razaoSocial", client.razaoSocial, lido.razaoSocial, "razão social");
  put("endereco", client.endereco, lido.endereco, "endereço");
  put("cep", client.cep, lido.cep, "CEP");
  put("cidade", client.cidade, lido.cidade, "cidade");
  put("uf", client.uf, lido.uf, "UF");
  put("propostaNumero", client.propostaNumero, lido.propostaNumero, "proposta");
  if (lido.cnpj && lido.cnpj !== client.cnpj) {
    const dono = await db.client.findUnique({ where: { cnpj: lido.cnpj } });
    if (dono && dono.id !== clientId) {
      mudancas.push(`CNPJ não alterado (${lido.cnpj} já é de outro cliente)`);
    } else {
      campos.cnpj = lido.cnpj;
      mudancas.push("CNPJ");
    }
  }
  if (Object.keys(campos).length > 0) {
    await db.client.update({ where: { id: clientId }, data: campos });
  }

  // 2) Contratos: atualiza os que já existem pelo número, cria os que faltam.
  // Um número que pertence a outro cliente não é tocado.
  for (const c of lido.contratos) {
    const ehLuso = c.kind === "LUSO";
    const existente = await db.contract.findUnique({ where: { numero: c.numero } });
    const dados = {
      kind: c.kind,
      dataAssinatura: lido.dataAssinatura ? new Date(lido.dataAssinatura) : undefined,
      vigenciaMeses: c.vigenciaMeses,
      valorLicenca: ehLuso ? c.valorLicenca : null,
      valorMensal: ehLuso ? c.valorMensal : null,
      limiteSaasMb: c.limiteSaasMb,
      horasTreinamento: ehLuso ? c.horasTreinamento : null,
      prazoTreinamentoDias: ehLuso ? c.prazoTreinamentoDias : null,
      contatoTeknisa: lido.contatoTeknisa,
    };
    const itens = c.itens.map((i) => ({
      kind: i.kind,
      solucao: i.solucao,
      tipoMedida: i.tipoMedida,
      qtde: i.qtde,
      valorUnit: i.valorUnit,
      desconto: i.desconto,
      valorTotal: i.valorTotal,
    }));

    if (existente && existente.clientId !== clientId) {
      mudancas.push(`contrato ${c.numero} pertence a outro cliente, ignorado`);
      continue;
    }
    if (existente) {
      // troca as linhas de serviço pelas do contrato novo
      await db.$transaction([
        db.contractItem.deleteMany({ where: { contractId: existente.id } }),
        db.contract.update({
          where: { id: existente.id },
          data: { ...dados, items: { create: itens } },
        }),
      ]);
      mudancas.push(`contrato ${c.numero} atualizado`);
    } else {
      await db.contract.create({
        data: {
          clientId,
          projectId: projeto.id,
          numero: c.numero,
          ...dados,
          items: { create: itens },
        },
      });
      mudancas.push(`contrato ${c.numero} adicionado`);
    }
  }

  // 3) Data de assinatura do projeto acompanha o contrato.
  if (lido.dataAssinatura) {
    await db.project.update({
      where: { id: projeto.id },
      data: { dataContrato: new Date(lido.dataAssinatura) },
    });
  }

  await db.timelineEntry.create({
    data: {
      projectId: projeto.id,
      tipo: "SISTEMA",
      texto:
        `Cadastro atualizado a partir do contrato ${pdf.name}, por ${user.name}` +
        (mudancas.length > 0 ? `. Alterações: ${mudancas.join("; ")}.` : ", sem mudanças de dados."),
    },
  });

  revalidatePath(`/clientes/${clientId}`);
  revalidatePath("/", "layout");
  redirect(`/clientes/${clientId}?ok=contrato-atualizado`);
}

// ─── Leitura do contrato assinado ──────────────────────────────────
// O cadastro começa pelo contrato: o coordenador anexa o PDF assinado e os
// campos chegam preenchidos a partir dele, em vez de redigitados. Ver
// src/lib/contrato-pdf.ts para o que é lido e como.

export type RespostaLeitura =
  | { ok: false; erro: string }
  | {
      ok: true;
      dados: LeituraContrato;
      // avisos não bloqueiam o cadastro, só aparecem na tela para conferência
      avisos: string[];
    };

export async function analisarContratoAction(formData: FormData): Promise<RespostaLeitura> {
  // Só lê o PDF e devolve o que encontrou para conferência na tela. Quem pode
  // de fato cadastrar ou alterar é conferido nas actions que gravam
  // (createClientProject, applyContractToClient); aqui basta estar logado.
  const user = await requireUser();

  const file = formData.get("contrato");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, erro: "Selecione o PDF do contrato assinado." };
  }
  if (path.extname(file.name).toLowerCase() !== ".pdf") {
    return { ok: false, erro: "O contrato precisa ser um PDF." };
  }
  if (file.size > TAMANHO_MAXIMO_MB * 1024 * 1024) {
    return { ok: false, erro: `O arquivo passa de ${TAMANHO_MAXIMO_MB} MB.` };
  }

  const { lerContratoAssinado } = await import("./contrato-pdf");
  const lido = await lerContratoAssinado(new Uint8Array(await file.arrayBuffer()));
  if (!lido.ok) return { ok: false, erro: lido.erro ?? "Não foi possível ler este contrato." };

  const avisos: string[] = [];

  // Contrato já cadastrado: avisa agora, não depois de preencher tudo.
  const numeros = lido.contratos.map((c) => c.numero);
  const jaExistem = await db.contract.findMany({
    where: { numero: { in: numeros } },
    select: { numero: true, clientId: true },
  });
  for (const c of jaExistem) {
    avisos.push(`O contrato ${c.numero} já está cadastrado no CRM.`);
  }
  if (lido.cnpj) {
    const cliente = await db.client.findUnique({ where: { cnpj: lido.cnpj } });
    if (cliente) {
      avisos.push(`Já existe um cliente com o CNPJ ${lido.cnpj}: ${cliente.razaoSocial}.`);
    }
  }
  if (user.role === "COORDENACAO" && lido.productLine && user.productLine !== lido.productLine) {
    avisos.push(
      `Este contrato é ${PRODUCT_LABELS[lido.productLine]} e você coordena ${PRODUCT_LABELS[user.productLine!]}. O cadastro será recusado.`
    );
  }
  for (const campo of lido.camposNaoLidos) {
    avisos.push(`Não consegui ler ${campo} no contrato. Confira e preencha.`);
  }

  return { ok: true, dados: lido, avisos };
}

// Lê o Plano de Projeto e já casa os módulos declarados com o catálogo do CRM,
// devolvendo os ids para a tela marcar. Complementa o contrato no cadastro.
export type RespostaPlano =
  | { ok: false; erro: string }
  | { ok: true; dados: LeituraPlano; moduleIds: string[]; avisos: string[] };

export async function analisarPlanoAction(formData: FormData): Promise<RespostaPlano> {
  await requireUser();
  const file = formData.get("plano");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, erro: "Selecione o PDF do plano de projeto." };
  }
  if (path.extname(file.name).toLowerCase() !== ".pdf") {
    return { ok: false, erro: "O plano de projeto precisa ser um PDF." };
  }
  if (file.size > TAMANHO_MAXIMO_MB * 1024 * 1024) {
    return { ok: false, erro: `O arquivo passa de ${TAMANHO_MAXIMO_MB} MB.` };
  }

  const { lerPlanoProjeto, moduloCasa } = await import("./plano-pdf");
  const lido = await lerPlanoProjeto(new Uint8Array(await file.arrayBuffer()));
  if (!lido.ok) return { ok: false, erro: lido.erro ?? "Não foi possível ler o plano." };

  // Casa os módulos declarados com o catálogo TecFood (o plano é do produto).
  const catalogo = await db.moduleTemplate.findMany({
    where: { productLine: "TECFOOD", active: true, grupo: { not: "FIXO" } },
    select: { id: true, nome: true },
  });
  const moduleIds = catalogo
    .filter((c) => lido.modulosDeclarados.some((d) => moduloCasa(d, c.nome)))
    .map((c) => c.id);

  const avisos: string[] = [];
  for (const campo of lido.camposNaoLidos) avisos.push(`Não consegui ler ${campo} no plano.`);
  if (moduleIds.length === 0 && lido.modulosDeclarados.length > 0) {
    avisos.push("Os módulos do plano não casaram com o catálogo. Marque manualmente.");
  }

  return { ok: true, dados: lido, moduleIds, avisos };
}

// ─── Criação de cliente + projeto (entrada manual do coordenador) ──

export async function createClientProject(formData: FormData) {
  const user = await requireUser();
  if (!canCreateClient(user)) redirect("/clientes/novo?erro=permissao");

  const productLineRaw = String(formData.get("productLine") ?? "");
  if (productLineRaw !== "TECFOOD" && productLineRaw !== "RETAIL") {
    redirect("/clientes/novo?erro=produto");
  }
  const productLine = productLineRaw as ProductLine;
  // Coordenação só abre cliente do próprio produto.
  if (user.role === "COORDENACAO" && user.productLine !== productLine) {
    redirect("/clientes/novo?erro=permissao-produto");
  }

  const razaoSocial = String(formData.get("razaoSocial") ?? "").trim();
  if (!razaoSocial) redirect("/clientes/novo?erro=razao-social");

  // O PDF do contrato volta junto no envio. É relido aqui, e não copiado de um
  // campo escondido, para que os detalhes que o coordenador não vê na tela
  // (itens contratados, limite SaaS, vigência, o par SAAS+LUSO) venham sempre
  // do documento assinado. Os campos visíveis continuam valendo pelo que
  // estiver no formulário: quem confere é quem cadastra.
  const pdf = formData.get("contrato");
  const temPdf = pdf instanceof File && pdf.size > 0;
  let lido: LeituraContrato | null = null;
  if (temPdf) {
    const { lerContratoAssinado } = await import("./contrato-pdf");
    const r = await lerContratoAssinado(new Uint8Array(await pdf.arrayBuffer()));
    if (r.ok) lido = r;
  }

  // O plano de projeto é opcional. Quando vem, é relido no servidor: dá os
  // contatos (usuário-chave e coordenador do cliente), a previsão de início e
  // término e reforça a proposta. O PDF fica anexado ao projeto.
  const pdfPlano = formData.get("plano");
  const temPlano = pdfPlano instanceof File && pdfPlano.size > 0;
  let plano: LeituraPlano | null = null;
  if (temPlano) {
    const { lerPlanoProjeto } = await import("./plano-pdf");
    const r = await lerPlanoProjeto(new Uint8Array(await pdfPlano.arrayBuffer()));
    if (r.ok) plano = r;
  }

  const cnpj = String(formData.get("cnpj") ?? "").trim() || null;
  // CNPJ é único: sem esta conferência, cadastrar um cliente que já existe
  // devolve uma tela de erro do banco em vez de uma explicação.
  if (cnpj) {
    const jaExiste = await db.client.findUnique({ where: { cnpj } });
    if (jaExiste) redirect(`/clientes/novo?erro=cnpj-duplicado&cliente=${jaExiste.id}`);
  }

  // Com contrato lido, valem os números do documento (o par SAAS + LUSO).
  // Sem contrato, vale o número digitado no cadastro manual.
  const numeroContrato = String(formData.get("numeroContrato") ?? "").trim();
  const numerosParaCriar = lido ? lido.contratos.map((c) => c.numero) : numeroContrato ? [numeroContrato] : [];
  if (numerosParaCriar.length > 0) {
    const jaExiste = await db.contract.findFirst({ where: { numero: { in: numerosParaCriar } } });
    if (jaExiste) redirect("/clientes/novo?erro=contrato-duplicado");
  }

  // Só os módulos do produto escolhido: marcar Retail em um projeto TecFood
  // geraria um cronograma que não existe.
  // Só os módulos contratáveis do produto escolhido. Os FIXO (moldura) entram
  // sempre e não vêm do formulário; marcar Retail num projeto TecFood geraria
  // um cronograma que não existe.
  const marcados = formData.getAll("modules").map(String);
  const moduleIds =
    marcados.length > 0
      ? (
          await db.moduleTemplate.findMany({
            where: { id: { in: marcados }, productLine, active: true, grupo: { not: "FIXO" } },
            select: { id: true },
          })
        ).map((m) => m.id)
      : [];

  const inicial = await firstStage();
  if (!inicial) throw new Error("Nenhuma etapa de pipeline configurada.");

  const client = await db.client.create({
    data: {
      razaoSocial,
      cnpj,
      endereco: String(formData.get("endereco") ?? "").trim() || null,
      cep: String(formData.get("cep") ?? "").trim() || null,
      cidade: String(formData.get("cidade") ?? "").trim() || null,
      uf: String(formData.get("uf") ?? "").trim().toUpperCase() || null,
      // proposta: forma do campo, ou o que veio do plano de projeto
      propostaNumero:
        String(formData.get("propostaNumero") ?? "").trim() || plano?.propostaNumero || null,
    },
  });

  const dataContrato = dataOuNull(formData.get("dataAssinatura"));

  const project = await db.project.create({
    data: {
      clientId: client.id,
      productLine,
      nome: `Implantação ${productLine === "TECFOOD" ? "TecFood" : "Retail"} Express`,
      dataContrato,
      // previsão de início e término vêm do plano de projeto, quando houver
      dataInicio: plano?.previsaoInicio ? new Date(plano.previsaoInicio) : null,
      goLivePrevisto: plano?.previsaoTermino ? new Date(plano.previsaoTermino) : null,
      stageId: inicial.id,
      stageEnteredAt: new Date(),
    },
  });

  // Contatos vindos do plano: o usuário-chave e o coordenador do cliente.
  const contatosDoPlano: { nome: string; cargo: string; email: string | null }[] = [];
  if (plano?.usuarioChaveNome) {
    contatosDoPlano.push({
      nome: plano.usuarioChaveNome,
      cargo: "Usuário-chave",
      email: plano.usuarioChaveEmail,
    });
  }
  if (plano?.coordenadorCliente) {
    contatosDoPlano.push({ nome: plano.coordenadorCliente, cargo: "Coordenador do projeto (cliente)", email: null });
  }
  for (const c of contatosDoPlano) {
    await db.contact.create({
      data: { clientId: client.id, nome: c.nome, cargo: c.cargo, email: c.email?.toLowerCase() ?? null },
    });
  }

  const contatoTeknisa = String(formData.get("contatoTeknisa") ?? "").trim() || null;

  if (lido) {
    // Cria o par inteiro do contrato, com as linhas de licença e manutenção.
    // É isso que faz a aba "Soluções e serviços contratados" do cliente nascer
    // preenchida, sem ninguém redigitar a tabela de preços.
    for (const c of lido.contratos) {
      const ehLuso = c.kind === "LUSO";
      await db.contract.create({
        data: {
          clientId: client.id,
          projectId: project.id,
          kind: c.kind,
          numero: c.numero,
          dataAssinatura: dataContrato,
          vigenciaMeses: c.vigenciaMeses,
          // os valores visíveis na tela vêm do formulário, já conferidos;
          // o resto vem direto do contrato
          valorLicenca: ehLuso ? numOrNull(formData.get("valorLicenca")) : null,
          valorMensal: ehLuso ? numOrNull(formData.get("valorMensal")) : null,
          limiteSaasMb: c.limiteSaasMb,
          horasTreinamento: c.horasTreinamento,
          // explicitamente null no SAAS: a cláusula de treinamento é do LUSO, e
          // deixar o padrão de 60 dias aqui inventaria um prazo que não existe
          prazoTreinamentoDias: c.prazoTreinamentoDias,
          contatoTeknisa,
          items: {
            create: c.itens.map((i) => ({
              kind: i.kind,
              solucao: i.solucao,
              tipoMedida: i.tipoMedida,
              qtde: i.qtde,
              valorUnit: i.valorUnit,
              desconto: i.desconto,
              valorTotal: i.valorTotal,
            })),
          },
        },
      });
    }
  } else if (numeroContrato) {
    await db.contract.create({
      data: {
        clientId: client.id,
        projectId: project.id,
        kind: numeroContrato.startsWith("SAAS") ? "SAAS" : "LUSO",
        numero: numeroContrato,
        dataAssinatura: dataContrato,
        valorLicenca: numOrNull(formData.get("valorLicenca")),
        valorMensal: numOrNull(formData.get("valorMensal")),
        contatoTeknisa,
      },
    });
  }

  // Contrato e plano de projeto ficam anexados ao projeto, onde a implantação
  // procura por eles depois.
  const anexar = async (arquivo: File) => {
    const bytes = Buffer.from(await arquivo.arrayBuffer());
    await db.projectDocument.create({
      data: {
        projectId: project.id,
        filename: arquivo.name,
        uploadedById: user.id,
        data: bytes,
        mimeType: mimeDoArquivo(arquivo.name),
        size: bytes.length,
      },
    });
  };
  if (temPdf) await anexar(pdf);
  if (temPlano) await anexar(pdfPlano);

  // Cronograma: atividades dos módulos contratados + da moldura fixa.
  await gerarCronogramaProjeto(project.id, productLine, moduleIds);

  await instantiateChecklist(project.id, inicial.id);
  await db.stageTransition.create({
    data: { projectId: project.id, toStageId: inicial.id, byUserId: user.id },
  });
  await db.notification.create({
    data: {
      projectId: project.id,
      tipo: "NOVO_PROJETO",
      titulo: `Novo cliente: ${client.razaoSocial}`,
      corpo: `Cadastrado por ${user.name}. Aguardando validação e alocação.`,
    },
  });

  revalidatePath("/", "layout");
  redirect(`/clientes/${client.id}?ok=cadastrado`);
}

function numOrNull(v: FormDataEntryValue | null): number | null {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return isNaN(n) ? null : n;
}

// Gera o cronograma de um projeto a partir dos módulos contratados. Sempre
// inclui a moldura fixa (abertura, cadastros iniciais, encerramento), na ordem
// do catálogo (ordem do módulo, depois ordem da atividade), sem repetir uma
// atividade que aparece em mais de um módulo (dedupKey). É o motor único de
// cronograma: o cadastro chama isto, e o seed replica a mesma lógica.
async function gerarCronogramaProjeto(
  projectId: string,
  productLine: ProductLine,
  moduleIdsContratados: string[]
) {
  const fixos = await db.moduleTemplate.findMany({
    where: { productLine, grupo: "FIXO", active: true },
    select: { id: true },
  });
  // vincula ao projeto só os módulos contratados (a moldura fixa não vira card)
  for (const moduleTemplateId of moduleIdsContratados) {
    await db.projectModule.create({ data: { projectId, moduleTemplateId } });
  }
  const ids = [...new Set([...fixos.map((m) => m.id), ...moduleIdsContratados])];
  if (ids.length === 0) return;

  const templates = await db.activityTemplate.findMany({
    where: { moduleTemplateId: { in: ids }, active: true },
    include: { moduleTemplate: { select: { ordem: true } } },
  });
  templates.sort(
    (a, b) => (a.moduleTemplate?.ordem ?? 0) - (b.moduleTemplate?.ordem ?? 0) || a.ordem - b.ordem
  );

  const seen = new Set<string>();
  let ordem = 0;
  for (const t of templates) {
    if (t.dedupKey && seen.has(t.dedupKey)) continue;
    if (t.dedupKey) seen.add(t.dedupKey);
    await db.projectActivity.create({
      data: {
        projectId,
        templateId: t.id,
        titulo: t.titulo,
        descricao: t.descricao,
        horas: t.horas,
        numReunioes: t.numReunioes,
        responsavel: t.responsavel,
        pautas: t.pautas,
        envolvidosCliente: t.envolvidosCliente,
        ordem: ordem++,
      },
    });
  }
}

async function instantiateChecklist(projectId: string, stageId: string) {
  const existing = await db.projectChecklistItem.count({ where: { projectId, stageId } });
  if (existing > 0) return;
  const templates = await db.stageChecklistTemplate.findMany({
    where: { stageId, active: true },
    orderBy: { ordem: "asc" },
  });
  for (const t of templates) {
    await db.projectChecklistItem.create({
      data: { projectId, stageId, titulo: t.titulo, ordem: t.ordem },
    });
  }
}

// ─── Movimentação de etapa ─────────────────────────────────────────

export async function moveStage(formData: FormData) {
  const user = await requireUser();
  const projectId = String(formData.get("projectId"));
  const toStageId = String(formData.get("toStageId"));

  const [project, stages] = await Promise.all([
    db.project.findUniqueOrThrow({
      where: { id: projectId },
      include: { checklist: true, client: true },
    }),
    db.pipelineStage.findMany({ orderBy: { ordem: "asc" } }),
  ]);

  if (!canMoveStage(user, project)) {
    redirect(`/projetos/${projectId}?erro=permissao`);
  }

  const toStage = stages.find((s) => s.id === toStageId);
  if (!toStage) throw new Error("Etapa inválida");

  // para onde voltar depois de mover (o funil manda o próprio endereço, para
  // a pessoa continuar no quadro em vez de cair na página do projeto).
  // Só aceita caminho interno: "//host" é endereço externo disfarçado de
  // caminho e levaria a pessoa para fora do CRM depois de mover o card.
  const destino = String(formData.get("redirectTo") ?? "").trim();
  const interno = destino.startsWith("/") && !destino.startsWith("//");
  const voltarPara = interno ? destino : `/projetos/${projectId}`;

  // regra: só move se o checklist da etapa atual estiver completo (ao avançar)
  const curOrdem = stages.find((s) => s.id === project.stageId)?.ordem ?? -1;
  const goingForward = toStage.ordem > curOrdem;
  if (goingForward) {
    const pending = project.checklist.filter((c) => c.stageId === project.stageId && !c.done);
    if (pending.length > 0) {
      redirect(`/projetos/${projectId}?erro=checklist`);
    }
  }

  await db.project.update({
    where: { id: projectId },
    data: {
      stageId: toStageId,
      stageEnteredAt: new Date(),
      ...(toStage.isFinal ? { dataFinalizacao: new Date() } : {}),
    },
  });
  await db.stageTransition.create({
    data: { projectId, fromStageId: project.stageId, toStageId, byUserId: user.id },
  });
  await instantiateChecklist(projectId, toStageId);

  if (toStage.isFinal) {
    await db.notification.create({
      data: {
        projectId,
        tipo: "HANDOFF_CS",
        titulo: `Implantação finalizada: ${project.client.razaoSocial}`,
        corpo: "Realizar reunião de handoff e ativar o CS.",
      },
    });
  }

  revalidatePath("/", "layout");
  redirect(voltarPara);
}

export async function toggleChecklist(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("itemId"));
  const item = await db.projectChecklistItem.findUniqueOrThrow({
    where: { id },
    include: { project: true },
  });
  if (!canMoveStage(user, item.project)) {
    redirect(`/projetos/${item.projectId}?erro=permissao`);
  }
  await db.projectChecklistItem.update({
    where: { id },
    data: item.done
      ? { done: false, doneById: null, doneAt: null }
      : { done: true, doneById: user.id, doneAt: new Date() },
  });
  revalidatePath(`/projetos/${item.projectId}`);
  revalidatePath("/funil"); // o checklist também é conferido ao arrastar no funil
}

// ─── Atividades ────────────────────────────────────────────────────

export async function setActivityStatus(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("activityId"));
  const activity = await db.projectActivity.findUniqueOrThrow({
    where: { id },
    include: { project: true },
  });
  if (!canManageActivities(user, activity.project)) {
    redirect(`/projetos/${activity.projectId}?erro=permissao`);
  }
  const statusRaw = String(formData.get("status"));
  const STATUS: ActivityStatus[] = ["PENDENTE", "EM_ANDAMENTO", "CONCLUIDA", "CANCELADA"];
  if (!STATUS.includes(statusRaw as ActivityStatus)) {
    redirect(`/projetos/${activity.projectId}?erro=status`);
  }
  const status = statusRaw as ActivityStatus;
  await db.projectActivity.update({
    where: { id },
    data: { status, completedAt: status === "CONCLUIDA" ? new Date() : null },
  });
  revalidatePath(`/projetos/${activity.projectId}`);
}

export async function addActivity(formData: FormData) {
  const user = await requireUser();
  const projectId = String(formData.get("projectId"));
  const project = await db.project.findUniqueOrThrow({ where: { id: projectId } });
  if (!canManageActivities(user, project)) {
    redirect(`/projetos/${projectId}?erro=permissao`);
  }

  const last = await db.projectActivity.findFirst({
    where: { projectId },
    orderBy: { ordem: "desc" },
  });

  // consultor só pode se atribuir a si mesmo; coordenação/diretoria escolhem quem quiser.
  const requestedAssigneeId = String(formData.get("assigneeId") ?? "").trim() || null;
  const assigneeId = user.role === "CONSULTOR" ? user.id : requestedAssigneeId;

  const titulo = String(formData.get("titulo") ?? "").trim();
  if (!titulo) redirect(`/projetos/${projectId}?erro=titulo`);

  const respRaw = String(formData.get("responsavel") ?? "AMBOS");
  const responsavel = (
    respRaw === "TEKNISA" || respRaw === "CLIENTE" ? respRaw : "AMBOS"
  ) as Responsavel;

  // Grupo (fase) escolhido no form: um grupo existente, ou o nome digitado em
  // "criar novo grupo". Vazio = cai em "Outras atividades".
  const grupoSel = String(formData.get("grupo") ?? "").trim();
  const grupoNovo = String(formData.get("novoGrupo") ?? "").trim();
  const fase = (grupoSel === "__novo__" ? grupoNovo : grupoSel) || null;

  await db.projectActivity.create({
    data: {
      projectId,
      titulo,
      fase,
      descricao: String(formData.get("descricao") ?? "").trim() || null,
      horas: numOrNull(formData.get("horas")),
      dueDate: dataOuNull(formData.get("dueDate")),
      responsavel,
      envolvidosCliente: String(formData.get("envolvidosCliente") ?? "").trim() || null,
      assigneeId,
      ordem: (last?.ordem ?? -1) + 1,
    },
  });
  revalidatePath(`/projetos/${projectId}`);
}

// Importa o cronograma de uma planilha (Excel) das consultoras: cada linha vira
// uma atividade, com a data prevista e o status. Não duplica: pula títulos que
// já existem no projeto (permite reimportar a planilha atualizada).
export async function importarCronograma(formData: FormData) {
  const user = await requireUser();
  const projectId = String(formData.get("projectId"));
  const project = await db.project.findUniqueOrThrow({ where: { id: projectId } });
  if (!canManageActivities(user, project)) {
    redirect(`/projetos/${projectId}?erro=permissao`);
  }

  const file = formData.get("planilha");
  if (!(file instanceof File) || file.size === 0) {
    redirect(`/projetos/${projectId}?erro=planilha`);
  }
  if (!/\.(xlsx|xls)$/i.test(file.name)) {
    redirect(`/projetos/${projectId}?erro=planilha-tipo`);
  }
  if (file.size > TAMANHO_MAXIMO_MB * 1024 * 1024) {
    redirect(`/projetos/${projectId}?erro=arquivo-grande`);
  }

  const { lerCronogramaPlanilha } = await import("./cronograma-xlsx");
  const r = await lerCronogramaPlanilha(new Uint8Array(await file.arrayBuffer()));
  if (!r.ok) redirect(`/projetos/${projectId}?erro=planilha-invalida`);

  const existentes = await db.projectActivity.findMany({
    where: { projectId },
    select: { titulo: true },
  });
  const jaTem = new Set(existentes.map((a) => a.titulo.trim().toLowerCase()));
  const ultima = await db.projectActivity.findFirst({
    where: { projectId },
    orderBy: { ordem: "desc" },
    select: { ordem: true },
  });
  let ordem = (ultima?.ordem ?? -1) + 1;

  let criadas = 0;
  for (const a of r.atividades) {
    if (jaTem.has(a.titulo.trim().toLowerCase())) continue;
    jaTem.add(a.titulo.trim().toLowerCase());
    await db.projectActivity.create({
      data: {
        projectId,
        titulo: a.titulo,
        fase: a.fase,
        status: a.status,
        completedAt: a.status === "CONCLUIDA" ? new Date() : null,
        dueDate: a.dueDate ? new Date(a.dueDate) : null,
        ordem: ordem++,
      },
    });
    criadas++;
  }

  revalidatePath(`/projetos/${projectId}`);
  redirect(`/projetos/${projectId}?ok=cronograma&n=${criadas}`);
}

export async function setActivityDue(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("activityId"));
  const activity = await db.projectActivity.findUniqueOrThrow({
    where: { id },
    include: { project: true },
  });
  if (!canManageActivities(user, activity.project)) {
    redirect(`/projetos/${activity.projectId}?erro=permissao`);
  }
  const due = dataOuNull(formData.get("dueDate"));
  const scheduled = dataOuNull(formData.get("scheduledAt"));
  await db.projectActivity.update({
    where: { id },
    data: { dueDate: due, ...(scheduled ? { scheduledAt: scheduled } : {}) },
  });
  revalidatePath(`/projetos/${activity.projectId}`);
}

export async function deleteActivity(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("activityId"));
  const activity = await db.projectActivity.findUniqueOrThrow({
    where: { id },
    include: { project: true },
  });
  if (!canManageActivities(user, activity.project)) {
    redirect(`/projetos/${activity.projectId}?erro=permissao`);
  }
  await db.projectActivity.delete({ where: { id } });
  revalidatePath(`/projetos/${activity.projectId}`);
}

// ─── Alocação, pausa, cancelamento ─────────────────────────────────

export async function allocateConsultant(formData: FormData) {
  const user = await requireUser();
  const projectId = String(formData.get("projectId"));
  const current = await db.project.findUniqueOrThrow({ where: { id: projectId } });
  if (!canAllocateConsultant(user, current.productLine)) {
    redirect(`/projetos/${projectId}?erro=permissao`);
  }
  // Confere quem está sendo alocado: precisa ser consultor(a) ativo, liberado
  // e do mesmo produto. Consultores não cruzam produto, e um id qualquer vindo
  // do formulário não pode virar responsável pela implantação.
  const consultantId = String(formData.get("consultantId") ?? "").trim() || null;
  if (consultantId) {
    const candidato = await db.user.findUnique({ where: { id: consultantId } });
    const valido =
      candidato &&
      candidato.role === "CONSULTOR" &&
      candidato.active &&
      candidato.status === "APROVADO" &&
      candidato.productLine === current.productLine;
    if (!valido) redirect(`/projetos/${projectId}?erro=consultor`);
  }

  await db.project.update({ where: { id: projectId }, data: { consultantId } });
  if (consultantId) {
    // atividades sem responsável passam para o consultor alocado
    await db.projectActivity.updateMany({
      where: { projectId, assigneeId: null },
      data: { assigneeId: consultantId },
    });
    const project = await db.project.findUniqueOrThrow({
      where: { id: projectId },
      include: { client: true },
    });
    await db.notification.create({
      data: {
        userId: consultantId,
        projectId,
        tipo: "ALOCACAO",
        titulo: `Você recebeu um novo projeto: ${project.client.razaoSocial}`,
        corpo: `Alocado por ${user.name}.`,
      },
    });
  }
  revalidatePath("/", "layout");
}

export async function pauseProject(formData: FormData) {
  const user = await requireUser();
  const projectId = String(formData.get("projectId"));
  const project = await db.project.findUniqueOrThrow({ where: { id: projectId } });
  if (!canPauseResumeProject(user, project)) {
    redirect(`/projetos/${projectId}?erro=permissao`);
  }
  const motivo = String(formData.get("motivo") ?? "").trim() || null;
  await db.project.update({ where: { id: projectId }, data: { status: "PAUSADO" } });
  await db.projectPause.create({ data: { projectId, motivo } });
  revalidatePath("/", "layout");
}

export async function resumeProject(formData: FormData) {
  const user = await requireUser();
  const projectId = String(formData.get("projectId"));
  const project = await db.project.findUniqueOrThrow({ where: { id: projectId } });
  if (!canPauseResumeProject(user, project)) {
    redirect(`/projetos/${projectId}?erro=permissao`);
  }
  await db.project.update({ where: { id: projectId }, data: { status: "ATIVO" } });
  const open = await db.projectPause.findFirst({
    where: { projectId, endedAt: null },
    orderBy: { startedAt: "desc" },
  });
  if (open) await db.projectPause.update({ where: { id: open.id }, data: { endedAt: new Date() } });
  revalidatePath("/", "layout");
}

export async function cancelProject(formData: FormData) {
  const user = await requireUser();
  const projectId = String(formData.get("projectId"));
  const project = await db.project.findUniqueOrThrow({ where: { id: projectId } });
  if (!canCancelProject(user, project.productLine)) {
    redirect(`/projetos/${projectId}?erro=permissao`);
  }
  await db.project.update({ where: { id: projectId }, data: { status: "CANCELADO" } });
  revalidatePath("/", "layout");
}

// ─── Justificativa de atraso ───────────────────────────────────────

export async function justifyDelay(formData: FormData) {
  const user = await requireUser();
  const projectId = String(formData.get("projectId"));
  const project = await db.project.findUniqueOrThrow({ where: { id: projectId } });
  if (!canJustifyDelay(user, project)) {
    redirect(`/projetos/${projectId}?erro=permissao`);
  }
  // Categoria precisa existir e estar ativa: um id solto quebraria a gravação
  // por chave estrangeira, com tela de erro em vez de mensagem.
  const categoryId = String(formData.get("categoryId") ?? "");
  const categoria = await db.delayCategory.findFirst({ where: { id: categoryId, active: true } });
  if (!categoria) redirect(`/projetos/${projectId}?erro=categoria`);

  await db.delayJustification.create({
    data: {
      projectId,
      stageId: project.stageId,
      categoryId,
      detalhe: String(formData.get("detalhe") ?? "").trim() || null,
      byUserId: user.id,
    },
  });
  revalidatePath(`/projetos/${projectId}`);
}

export async function deleteDelayJustification(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("justificativaId"));
  const justificativa = await db.delayJustification.findUniqueOrThrow({
    where: { id },
    include: { project: true },
  });
  if (!canJustifyDelay(user, justificativa.project)) {
    redirect(`/projetos/${justificativa.projectId}?erro=permissao`);
  }
  await db.delayJustification.delete({ where: { id } });
  revalidatePath(`/projetos/${justificativa.projectId}`);
}

// ─── Documentos e anexos do projeto ─────────────────────────────────

// Só os tipos que o CRM realmente exibe (contrato, aditivo, comprovante,
// print). A lista fechada impede que o anexo seja, por exemplo, um .html ou
// .svg, que o navegador executaria ao abrir.
const EXTENSOES_ACEITAS = [".pdf", ".png", ".jpg", ".jpeg"];
// Teto conservador: as Server Actions rodam como função serverless no Netlify,
// cujo limite de payload é ~6 MB. 4 MB deixa margem para o overhead do multipart.
const TAMANHO_MAXIMO_MB = 4;

const MIME_POR_EXT: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

function mimeDoArquivo(nome: string): string {
  return MIME_POR_EXT[path.extname(nome).toLowerCase()] ?? "application/octet-stream";
}

export async function uploadDocument(formData: FormData) {
  const user = await requireUser();
  const projectId = String(formData.get("projectId"));
  const project = await db.project.findUniqueOrThrow({ where: { id: projectId } });
  if (!canUploadDocuments(user, project)) {
    redirect(`/projetos/${projectId}?erro=permissao`);
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    redirect(`/projetos/${projectId}?erro=arquivo`);
  }
  if (file.size > TAMANHO_MAXIMO_MB * 1024 * 1024) {
    redirect(`/projetos/${projectId}?erro=arquivo-grande`);
  }
  const ext = path.extname(file.name).toLowerCase();
  if (!EXTENSOES_ACEITAS.includes(ext)) {
    redirect(`/projetos/${projectId}?erro=arquivo-tipo`);
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  await db.projectDocument.create({
    data: {
      projectId,
      filename: file.name,
      uploadedById: user.id,
      data: bytes,
      mimeType: mimeDoArquivo(file.name),
      size: bytes.length,
    },
  });

  revalidatePath(`/projetos/${projectId}`);
  revalidatePath(`/clientes/${project.clientId}`); // anexos também aparecem no cliente
}

export async function deleteDocument(formData: FormData) {
  const user = await requireUser();
  const documentId = String(formData.get("documentId"));
  const doc = await db.projectDocument.findUniqueOrThrow({
    where: { id: documentId },
    include: { project: true },
  });
  if (!canUploadDocuments(user, doc.project)) {
    redirect(`/projetos/${doc.projectId}?erro=permissao`);
  }

  await db.projectDocument.delete({ where: { id: documentId } });

  revalidatePath(`/projetos/${doc.projectId}`);
  revalidatePath(`/clientes/${doc.project.clientId}`);
}

// ─── Notificações ──────────────────────────────────────────────────

export async function markNotificationRead(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("notificationId"));
  // Só marca o que é da própria pessoa ou o que é aviso geral (userId null).
  // `updateMany` com a condição no where evita mexer no alerta de outra pessoa.
  await db.notification.updateMany({
    where: { id, OR: [{ userId: null }, { userId: user.id }] },
    data: { readAt: new Date() },
  });
  revalidatePath("/", "layout");
}

export async function markAllNotificationsRead() {
  const user = await requireUser();
  await db.notification.updateMany({
    where: { readAt: null, OR: [{ userId: null }, { userId: user.id }] },
    data: { readAt: new Date() },
  });
  revalidatePath("/", "layout");
}

// ─── Timeline ──────────────────────────────────────────────────────

export async function addComment(formData: FormData) {
  const user = await requireUser();
  const projectId = String(formData.get("projectId"));
  const texto = String(formData.get("texto") ?? "").trim();
  if (!texto) return;
  await db.timelineEntry.create({
    data: { projectId, tipo: "COMENTARIO", texto, byUserId: user.id },
  });
  revalidatePath(`/projetos/${projectId}`);
}

// ─── Repasse comercial → implantação ───────────────────────────────
// O formulário é preenchido por link público (o comercial não é usuário do
// CRM), então as actions abaixo se autenticam pelo token, não por sessão.
// Regras: token válido, repasse ainda não enviado.

async function intakePorToken(token: string) {
  const intake = await db.clientIntake.findUnique({ where: { token } });
  if (!intake) redirect("/repasse/invalido");
  if (intake.status === "ENVIADO") redirect(`/repasse/${token}?etapa=enviado`);
  return intake;
}

function textoOuNull(v: FormDataEntryValue | null) {
  const s = String(v ?? "").trim();
  return s || null;
}

function inteiroOuNull(v: FormDataEntryValue | null) {
  const n = parseInt(String(v ?? "").replace(/\D/g, ""), 10);
  return isNaN(n) ? null : n;
}

// Data vinda de formulário. Texto vazio ou data impossível viram null em vez de
// `Invalid Date`, que o Prisma recusa e derruba a página inteira.
function dataOuNull(v: FormDataEntryValue | null) {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

// Gera o link do repasse para um projeto (quem tem acesso ao projeto).
export async function createIntakeLink(formData: FormData) {
  const user = await requireUser();
  const projectId = String(formData.get("projectId"));
  const project = await db.project.findUniqueOrThrow({
    where: { id: projectId },
    include: {
      client: { include: { contacts: { orderBy: { nome: "asc" } } } },
      contracts: { include: { items: true } },
      modules: true,
    },
  });
  if (!canManageActivities(user, project)) {
    redirect(`/projetos/${projectId}?erro=permissao`);
  }

  const existente = await db.clientIntake.findUnique({ where: { projectId } });
  if (existente) redirect(`/projetos/${projectId}`);

  const crypto = await import("crypto");
  const token = crypto.randomBytes(32).toString("hex");
  const luso = project.contracts.find((c) => c.kind === "LUSO");
  // Módulos que já vieram do contrato viram a pré-seleção da etapa Contratação.
  const modulos = joinChoices(project.modules.map((m) => m.moduleTemplateId));
  // Se já houver contato cadastrado, adianta o contato principal para o
  // comercial só confirmar em vez de digitar.
  const contato = project.client.contacts[0];

  // O repasse já nasce preenchido com o que o CRM sabe, que hoje vem em boa
  // parte do próprio contrato (cadastro, CEP, licenças, módulos). O comercial
  // confere e completa o que falta, em vez de redigitar tudo.
  await db.clientIntake.create({
    data: {
      projectId,
      token,
      razaoSocial: project.client.razaoSocial,
      nomeFantasia: project.client.nomeFantasia,
      cnpj: project.client.cnpj,
      cep: project.client.cep,
      endereco: project.client.endereco,
      cidade: project.client.cidade,
      uf: project.client.uf,
      modulos,
      numLicencas: luso?.items.filter((i) => i.kind === "LICENCA").reduce((s, i) => s + i.qtde, 0) || null,
      contatoPrincipalNome: contato?.nome ?? null,
      contatoPrincipalCargo: contato?.cargo ?? null,
      contatoPrincipalEmail: contato?.email ?? null,
      contatoPrincipalTelefone: contato?.telefone ?? null,
    },
  });

  revalidatePath(`/projetos/${projectId}`);
  redirect(`/projetos/${projectId}`);
}

// Lê os campos de uma etapa. Usado ao avançar e também no envio final,
// para que a última etapa seja salva junto com o envio.
function dadosDaEtapa(etapa: number, formData: FormData) {
  const dados: Record<string, unknown> = {};

  if (etapa === 1) {
    dados.razaoSocial = textoOuNull(formData.get("razaoSocial"));
    dados.nomeFantasia = textoOuNull(formData.get("nomeFantasia"));
    dados.cnpj = textoOuNull(formData.get("cnpj"));
    dados.cep = textoOuNull(formData.get("cep"));
    dados.endereco = textoOuNull(formData.get("endereco"));
    dados.cidade = textoOuNull(formData.get("cidade"));
    dados.uf = textoOuNull(formData.get("uf"));
    dados.segmento = textoOuNull(formData.get("segmento"));
    dados.numUnidades = inteiroOuNull(formData.get("numUnidades"));
  } else if (etapa === 2) {
    dados.contatoPrincipalNome = textoOuNull(formData.get("contatoPrincipalNome"));
    dados.contatoPrincipalCargo = textoOuNull(formData.get("contatoPrincipalCargo"));
    dados.contatoPrincipalEmail = textoOuNull(formData.get("contatoPrincipalEmail"));
    dados.contatoPrincipalTelefone = textoOuNull(formData.get("contatoPrincipalTelefone"));
    dados.contatoOperacaoNome = textoOuNull(formData.get("contatoOperacaoNome"));
    dados.contatoOperacaoTelefone = textoOuNull(formData.get("contatoOperacaoTelefone"));
    dados.contatoTiNome = textoOuNull(formData.get("contatoTiNome"));
    dados.contatoTiTelefone = textoOuNull(formData.get("contatoTiTelefone"));
  } else if (etapa === 3) {
    dados.refeicoesDia = textoOuNull(formData.get("refeicoesDia"));
    dados.periodos = joinChoices(formData.getAll("periodos").map(String));
    dados.tiposServico = joinChoices(formData.getAll("tiposServico").map(String));
    dados.fichaTecnica = textoOuNull(formData.get("fichaTecnica"));
    dados.nutricionista = textoOuNull(formData.get("nutricionista"));
    dados.sistemaAtual = textoOuNull(formData.get("sistemaAtual"));
    dados.migrarDados = textoOuNull(formData.get("migrarDados"));
    dados.producaoPropria = textoOuNull(formData.get("producaoPropria"));
    dados.contextoOperacao = textoOuNull(formData.get("contextoOperacao"));
  } else if (etapa === 4) {
    dados.modulos = joinChoices(formData.getAll("modulos").map(String));
    dados.numLicencas = inteiroOuNull(formData.get("numLicencas"));
    const goLive = textoOuNull(formData.get("goLiveDesejado"));
    dados.goLiveDesejado = goLive ? new Date(goLive) : null;
    dados.urgencia = textoOuNull(formData.get("urgencia"));
    dados.formatoTreinamento = textoOuNull(formData.get("formatoTreinamento"));
    dados.pessoasTreinamento = inteiroOuNull(formData.get("pessoasTreinamento"));
    dados.observacoesContratacao = textoOuNull(formData.get("observacoesContratacao"));
  } else if (etapa === 5) {
    dados.regimeTributario = textoOuNull(formData.get("regimeTributario"));
    dados.documentosFiscais = joinChoices(formData.getAll("documentosFiscais").map(String));
    dados.certificadoDigital = textoOuNull(formData.get("certificadoDigital"));
    dados.particularidadesFiscais = textoOuNull(formData.get("particularidadesFiscais"));
    dados.observacoesGerais = textoOuNull(formData.get("observacoesGerais"));
    dados.pontosAtencao = textoOuNull(formData.get("pontosAtencao"));
    dados.preenchidoPor = textoOuNull(formData.get("preenchidoPor"));
  }

  return dados;
}

// Salva a etapa atual e navega. O sentido vem de actions separadas em vez de
// um campo escondido: quando um botão usa `formAction`, o React ocupa o
// atributo `name` dele com o id da action, então o par name/value do botão
// não chega ao servidor.
async function salvaEtapaIntake(formData: FormData, sentido: "avancar" | "voltar") {
  const token = String(formData.get("token"));
  const etapa = parseInt(String(formData.get("etapa") ?? "1"), 10) || 1;
  const intake = await intakePorToken(token);

  const dados = dadosDaEtapa(etapa, formData);

  // guarda a etapa mais avançada já alcançada, para retomar o preenchimento
  const proxima = Math.min(etapa + 1, TOTAL_ETAPAS);
  dados.etapaAtual = Math.max(intake.etapaAtual, proxima);

  await db.clientIntake.update({ where: { id: intake.id }, data: dados });

  const alvo = sentido === "voltar" ? Math.max(1, etapa - 1) : proxima;
  redirect(`/repasse/${token}?etapa=${alvo}`);
}

// Salva a etapa e avança.
export async function saveIntakeStep(formData: FormData) {
  await salvaEtapaIntake(formData, "avancar");
}

// Salva a etapa e volta uma, sem perder o que já foi preenchido.
export async function backIntakeStep(formData: FormData) {
  await salvaEtapaIntake(formData, "voltar");
}

// Envia o repasse e importa as informações para o CRM.
export async function submitIntake(formData: FormData) {
  const token = String(formData.get("token"));
  const intake = await intakePorToken(token);

  const project = await db.project.findUniqueOrThrow({
    where: { id: intake.projectId },
    include: { client: true },
  });

  // salva a última etapa junto com o envio, para nada se perder
  const atualizado = await db.clientIntake.update({
    where: { id: intake.id },
    data: {
      ...dadosDaEtapa(TOTAL_ETAPAS, formData),
      status: "ENVIADO",
      submittedAt: new Date(),
      etapaAtual: TOTAL_ETAPAS,
    },
  });

  // 1) Cadastro do cliente: só preenche o que está vazio. Se o formulário
  // trouxer algo diferente do que já existe, mantém o cadastro e registra a
  // divergência, para ninguém perder informação nem sobrescrever sem conferir.
  const divergencias: string[] = [];
  const campos: { rotulo: string; coluna: string; atual: string | null; novo: string | null; modo?: "documento" }[] = [
    { rotulo: "Razão social", coluna: "razaoSocial", atual: project.client.razaoSocial, novo: atualizado.razaoSocial },
    { rotulo: "Nome fantasia", coluna: "nomeFantasia", atual: project.client.nomeFantasia, novo: atualizado.nomeFantasia },
    { rotulo: "CNPJ", coluna: "cnpj", atual: project.client.cnpj, novo: atualizado.cnpj, modo: "documento" },
    { rotulo: "Endereço", coluna: "endereco", atual: project.client.endereco, novo: atualizado.endereco },
    { rotulo: "Cidade", coluna: "cidade", atual: project.client.cidade, novo: atualizado.cidade },
    { rotulo: "UF", coluna: "uf", atual: project.client.uf, novo: atualizado.uf },
  ];

  const preencher: Record<string, string> = {};
  for (const c of campos) {
    const r = comparaCampo(c.atual, c.novo, c.modo ?? "texto");
    if (r === "vazio") preencher[c.coluna] = c.novo!.trim();
    else if (r === "conflito") {
      divergencias.push(`${c.rotulo}: o formulário informou "${c.novo}" e o cadastro tem "${c.atual}".`);
    }
  }
  if (Object.keys(preencher).length > 0) {
    await db.client.update({ where: { id: project.clientId }, data: preencher });
  }

  // 2) cria os contatos informados (sem duplicar quem já existe pelo nome)
  const existentes = await db.contact.findMany({ where: { clientId: project.clientId } });
  const novos = [
    {
      nome: atualizado.contatoPrincipalNome,
      cargo: atualizado.contatoPrincipalCargo ?? "Contato principal",
      email: atualizado.contatoPrincipalEmail,
      telefone: atualizado.contatoPrincipalTelefone,
    },
    {
      nome: atualizado.contatoOperacaoNome,
      cargo: "Responsável pela operação",
      email: null,
      telefone: atualizado.contatoOperacaoTelefone,
    },
    {
      nome: atualizado.contatoTiNome,
      cargo: "Responsável de TI",
      email: null,
      telefone: atualizado.contatoTiTelefone,
    },
  ];
  for (const c of novos) {
    if (!c.nome) continue;
    // Confere por email, telefone e nome (não só nome): a mesma pessoa escrita
    // de formas diferentes vira atualização, não um contato repetido.
    const existente = existentes.find((e) => mesmaPessoa(e, c));
    if (existente) {
      // completa o que faltava sem apagar nada que já estava preenchido
      const completar: Record<string, string> = {};
      if (!existente.email && c.email) completar.email = c.email;
      if (!existente.telefone && c.telefone) completar.telefone = c.telefone;
      if (!existente.cargo && c.cargo) completar.cargo = c.cargo;
      // fica com o nome mais completo entre os dois
      if (c.nome.length > existente.nome.length) completar.nome = c.nome;
      if (Object.keys(completar).length > 0) {
        await db.contact.update({ where: { id: existente.id }, data: completar });
      }
      if (existente.email && c.email && normalizaEmail(existente.email) !== normalizaEmail(c.email)) {
        divergencias.push(
          `Contato ${existente.nome}: o formulário informou o email "${c.email}" e o cadastro tem "${existente.email}".`
        );
      }
      continue;
    }
    const criado = await db.contact.create({
      data: {
        clientId: project.clientId,
        nome: c.nome,
        cargo: c.cargo,
        email: c.email,
        telefone: c.telefone,
      },
    });
    existentes.push(criado); // evita duplicar entre os próprios contatos do formulário
  }

  // 3) vincula os módulos marcados ao projeto (gera o cronograma padrão depois)
  const moduloIds = splitChoices(atualizado.modulos);
  for (const moduleTemplateId of moduloIds) {
    const existe = await db.projectModule.findUnique({
      where: { projectId_moduleTemplateId: { projectId: project.id, moduleTemplateId } },
    });
    if (!existe) {
      await db.projectModule.create({ data: { projectId: project.id, moduleTemplateId } });
    }
  }

  // 4) registra na timeline e avisa a coordenação
  await db.timelineEntry.create({
    data: {
      projectId: project.id,
      tipo: "SISTEMA",
      texto: `Repasse do comercial recebido${atualizado.preenchidoPor ? ` (preenchido por ${atualizado.preenchidoPor})` : ""}.`,
    },
  });

  // Divergências não somem: viram registro na timeline e alerta para a
  // coordenação decidir qual valor vale (o do formulário fica salvo no repasse).
  if (divergencias.length > 0) {
    await db.timelineEntry.create({
      data: {
        projectId: project.id,
        tipo: "SISTEMA",
        texto: `Repasse com divergências em relação ao cadastro (o cadastro foi mantido): ${divergencias.join(" ")}`,
      },
    });
  }

  await db.notification.create({
    data: {
      projectId: project.id,
      tipo: "REPASSE_RECEBIDO",
      titulo: `Repasse recebido: ${project.client.razaoSocial}`,
      corpo:
        divergencias.length > 0
          ? `O comercial enviou o formulário, com ${divergencias.length} divergência${divergencias.length === 1 ? "" : "s"} em relação ao cadastro. Confira antes de seguir.`
          : "O comercial enviou o formulário. Confira os dados e siga com a alocação.",
    },
  });

  revalidatePath("/", "layout");
  redirect(`/repasse/${token}?etapa=enviado`);
}

// ─── Pipeline (etapas do funil, editáveis) ─────────────────────────
// Só a diretoria edita a pipeline: é uma configuração global que afeta os
// dois funis. Toda action confere canEditPipeline no servidor.

// Cria uma etapa ao lado de outra (à esquerda ou à direita) ou no fim.
export async function addPipelineStage(formData: FormData) {
  const user = await requireUser();
  if (!canEditPipeline(user)) redirect("/pipeline?erro=permissao");

  const nome = String(formData.get("nome") ?? "").trim() || "Nova etapa";
  const refId = String(formData.get("refId") ?? "").trim() || null;
  const lado = String(formData.get("lado") ?? "right"); // "left" | "right"

  const stages = await db.pipelineStage.findMany({ orderBy: { ordem: "asc" } });
  const ref = refId ? stages.find((s) => s.id === refId) : null;
  // posição de inserção no array ordenado
  let pos = stages.length;
  if (ref) pos = stages.indexOf(ref) + (lado === "left" ? 0 : 1);

  await db.$transaction(async (tx) => {
    // abre espaço: empurra todas as etapas a partir de `pos` uma posição adiante
    for (let i = stages.length - 1; i >= pos; i--) {
      await tx.pipelineStage.update({ where: { id: stages[i].id }, data: { ordem: i + 1 } });
    }
    await tx.pipelineStage.create({ data: { nome, ordem: pos } });
  });

  revalidatePath("/pipeline");
  revalidatePath("/", "layout");
  redirect("/pipeline?ok=etapa-criada");
}

// Salva nome, prazo ideal (SLA) e flag de etapa final de uma vez.
export async function savePipelineStage(formData: FormData) {
  const user = await requireUser();
  if (!canEditPipeline(user)) redirect("/pipeline?erro=permissao");
  const id = String(formData.get("stageId"));
  const nome = String(formData.get("nome") ?? "").trim();
  const isFinal = formData.get("isFinal") != null;
  // O prazo (idealDays) não é salvo aqui: ele é da transição entre etapas e tem
  // action própria (savePipelineTransicao), para editar o nome/final sem mexer
  // no prazo e vice-versa.
  await db.pipelineStage.update({
    where: { id },
    data: { ...(nome ? { nome } : {}), isFinal },
  });
  revalidatePath("/pipeline");
  revalidatePath("/", "layout");
  redirect("/pipeline?ok=etapa");
}

// Prazo da transição de uma etapa para a próxima: fica no `idealDays` da etapa
// de origem (tempo para sair dela). Editado na faixa entre as etapas.
export async function savePipelineTransicao(formData: FormData) {
  const user = await requireUser();
  if (!canEditPipeline(user)) redirect("/pipeline?erro=permissao");
  const id = String(formData.get("stageId"));
  const raw = String(formData.get("idealDays") ?? "").trim();
  const parsed = parseInt(raw, 10);
  const idealDays = raw === "" || isNaN(parsed) ? null : Math.max(0, parsed);
  await db.pipelineStage.update({ where: { id }, data: { idealDays } });
  revalidatePath("/pipeline");
  revalidatePath("/", "layout");
  redirect("/pipeline?ok=prazo");
}

// Reordena uma etapa para a esquerda ou direita, trocando com a vizinha.
export async function movePipelineStage(formData: FormData) {
  const user = await requireUser();
  if (!canEditPipeline(user)) redirect("/pipeline?erro=permissao");
  const id = String(formData.get("stageId"));
  const dir = String(formData.get("dir")); // "left" | "right"

  const stages = await db.pipelineStage.findMany({ orderBy: { ordem: "asc" } });
  const i = stages.findIndex((s) => s.id === id);
  const j = dir === "left" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= stages.length) redirect("/pipeline");

  await db.$transaction([
    db.pipelineStage.update({ where: { id: stages[i].id }, data: { ordem: stages[j].ordem } }),
    db.pipelineStage.update({ where: { id: stages[j].id }, data: { ordem: stages[i].ordem } }),
  ]);
  revalidatePath("/pipeline");
  revalidatePath("/", "layout");
  redirect("/pipeline?ok=etapa-movida");
}

// Apaga uma etapa. Projetos que estiverem nela são movidos para a etapa
// vizinha (anterior, ou a próxima se for a primeira). Não permite apagar a
// última etapa restante.
export async function deletePipelineStage(formData: FormData) {
  const user = await requireUser();
  if (!canEditPipeline(user)) redirect("/pipeline?erro=permissao");
  const id = String(formData.get("stageId"));

  const stages = await db.pipelineStage.findMany({ orderBy: { ordem: "asc" } });
  if (stages.length <= 1) redirect("/pipeline?erro=ultima");
  const i = stages.findIndex((s) => s.id === id);
  if (i < 0) redirect("/pipeline");
  const vizinha = stages[i - 1] ?? stages[i + 1];

  await db.$transaction(async (tx) => {
    // realoca projetos que estão na etapa a ser apagada
    await tx.project.updateMany({ where: { stageId: id }, data: { stageId: vizinha.id } });
    // remove o registro (checklist/atrasos/transições dessa etapa caem por cascade/setnull)
    await tx.pipelineStage.delete({ where: { id } });
    // renumera para manter a ordem contígua
    const restantes = await tx.pipelineStage.findMany({ orderBy: { ordem: "asc" } });
    for (let k = 0; k < restantes.length; k++) {
      if (restantes[k].ordem !== k) {
        await tx.pipelineStage.update({ where: { id: restantes[k].id }, data: { ordem: k } });
      }
    }
  });

  revalidatePath("/pipeline");
  revalidatePath("/", "layout");
  redirect("/pipeline?ok=etapa-removida");
}
