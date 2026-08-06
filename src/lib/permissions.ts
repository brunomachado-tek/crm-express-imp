import type { ProductLine, Project, Role, User } from "@prisma/client";

// Regras de permissão centralizadas — usadas tanto no servidor (dentro das
// Server Actions, que é onde a trava realmente vale) quanto na UI (para
// exibir a informação para todos, mas só liberar o controle de edição para
// quem pode agir). Não confiar apenas na UI: toda action sensível também
// chama a função correspondente e recusa a operação no servidor.

type SessionUser = Pick<User, "id" | "role" | "productLine">;
type ProjectScope = Pick<Project, "consultantId" | "productLine">;

function sameProductOrDiretoria(user: SessionUser, productLine: ProductLine) {
  if (user.role === "DIRETORIA") return true;
  if (user.role === "COORDENACAO") return user.productLine === productLine;
  return false;
}

// Alocar/trocar o consultor responsável por um projeto.
// Regra confirmada: consultor não aloca, só coordenação e diretoria.
export function canAllocateConsultant(user: SessionUser, productLine: ProductLine) {
  return sameProductOrDiretoria(user, productLine);
}

// Criar/editar/excluir atividades do cronograma, mudar status e datas.
// Também usada por justificativa de atraso e pausar/retomar projeto:
// quem executa o trabalho é quem mexe nesses controles.
export function canManageActivities(user: SessionUser, project: ProjectScope) {
  if (user.role === "DIRETORIA") return true;
  if (user.role === "COORDENACAO") return user.productLine === project.productLine;
  if (user.role === "CONSULTOR") return project.consultantId === user.id;
  return false; // CS não edita cronograma de implantação
}

// Pausar/retomar: mesma regra do cronograma — o consultor alocado
// também pode (ex.: cliente sumiu e ele quer registrar sem esperar a coordenação).
export function canPauseResumeProject(user: SessionUser, project: ProjectScope) {
  return canManageActivities(user, project);
}

// Cancelar um projeto é decisão de gestão — consultor não cancela, só
// registra a pausa. Fica restrito a coordenação/diretoria.
export function canCancelProject(user: SessionUser, productLine: ProductLine) {
  return sameProductOrDiretoria(user, productLine);
}

// Justificar atraso de etapa.
export function canJustifyDelay(user: SessionUser, project: ProjectScope) {
  return canManageActivities(user, project);
}

// Aprovar ou negar a justificativa de atraso. É a trava contra o consultor
// burlar o próprio SLA: só coordenação do produto (e diretoria) decide, nunca
// quem registrou. Consultor não aparece aqui de propósito.
export function canApproveDelay(user: SessionUser, project: ProjectScope) {
  return sameProductOrDiretoria(user, project.productLine);
}

// Anexar/substituir documentos do contrato.
export function canUploadDocuments(user: SessionUser, project: ProjectScope) {
  return canManageActivities(user, project);
}

// Mover o projeto de etapa e marcar o checklist da etapa. É a operação central
// da implantação, então segue a mesma regra do cronograma: quem executa o
// trabalho move o card. CS acompanha, mas não movimenta.
export function canMoveStage(user: SessionUser, project: ProjectScope) {
  return canManageActivities(user, project);
}

// Cadastrar cliente e projeto novo. A entrada de dados é da coordenação
// (e da diretoria); consultor e CS não abrem cliente.
export function canCreateClient(user: SessionUser) {
  return user.role === "DIRETORIA" || user.role === "COORDENACAO";
}

// Editar cadastro do cliente, contatos e contratos. O cliente não tem produto
// próprio: quem manda são os projetos dele. Vale para quem pode agir em algum
// dos projetos do cliente; sem projeto nenhum, fica com coordenação/diretoria.
export function canEditClient(user: SessionUser, projects: ProjectScope[]) {
  if (user.role === "DIRETORIA") return true;
  if (projects.length === 0) return user.role === "COORDENACAO";
  return projects.some((p) => canManageActivities(user, p));
}

// Arquivar um cliente (some das listas, mantém o histórico). Diretoria sempre;
// coordenação só se todos os projetos do cliente forem do produto dela. Sem
// projeto, fica com coordenação/diretoria. Consultor e CS não arquivam.
export function canDeleteClient(user: SessionUser, projects: ProjectScope[]) {
  if (user.role === "DIRETORIA") return true;
  if (user.role !== "COORDENACAO") return false;
  return projects.every((p) => p.productLine === user.productLine);
}

// Apagar o cliente em definitivo (cascade: leva projetos, contratos, anexos e
// histórico). Sem volta, então fica só com a diretoria, para faxina de
// cadastro de teste ou erro claro.
export function canHardDeleteClient(user: SessionUser) {
  return user.role === "DIRETORIA";
}

// Convidar novos usuários para o sistema.
export function canInviteUsers(user: SessionUser) {
  return user.role === "DIRETORIA" || user.role === "COORDENACAO";
}

// Quais papéis/produtos um convite pode atribuir.
export function canAssignRole(inviter: SessionUser, role: Role, productLine: ProductLine | null) {
  if (inviter.role === "DIRETORIA") return true;
  if (inviter.role === "COORDENACAO") {
    if (role !== "CONSULTOR" && role !== "CS") return false;
    return productLine === inviter.productLine;
  }
  return false;
}

// Editar o papel/produto de um usuário já existente. Só diretoria.
export function canEditUserRoles(user: SessionUser) {
  return user.role === "DIRETORIA";
}

// Editar a pipeline (criar/renomear/reordenar/apagar etapas, definir prazos).
// É uma configuração global que afeta os dois funis: restrita à diretoria.
export function canEditPipeline(user: SessionUser) {
  return user.role === "DIRETORIA";
}

// Ver e decidir as solicitações de acesso (quem se cadastrou pelo primeiro
// acesso). Quem pode convidar também pode liberar; o papel concedido continua
// limitado por canAssignRole (coordenação só libera consultor/CS do produto).
export function canReviewAccessRequests(user: SessionUser) {
  return canInviteUsers(user);
}
