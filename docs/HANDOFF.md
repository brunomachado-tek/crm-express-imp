# CRM Express — Handoff do projeto

> Documento de contexto completo, atualizado em 2026-08-02. Ler isto substitui
> reler o histórico de conversas anteriores. Descreve o **estado atual** do
> sistema, não o histórico de como se chegou nele.
>
> Local: `docs/HANDOFF.md`. Ao lado existe `docs/ESPECIFICACAO.md`, a
> especificação original de 2026-07-17: serve para entender as decisões de
> negócio iniciais, mas **onde os dois divergirem, este arquivo vale**.

---

## ⚠️ Comece por aqui (abertura da próxima sessão)

**Prompt para colar:** "Estou continuando o CRM Express em
`/Users/brunomachado/Desktop/Claude/CRM TEK - Express/crm-express`. Leia
`docs/HANDOFF.md` (começa pela seção 'Comece por aqui') e o `AGENTS.md`. Antes de
qualquer feature nova, execute as RECOMENDAÇÕES PRIORITÁRIAS abaixo."

**Estado real (auditado por `/status` em 2026-08-02):** tudo abaixo está
**construído e funcionando no preview local (SQLite)**, mas **nada foi entregue**:
não há deploy, não há Postgres, e — o mais grave — **quase nada está no controle
de versão**. O único commit do repo (`crm-express/`) é o scaffold do Create Next
App; todo o resto está como working tree não commitado, sem `git remote`.

### Recomendações prioritárias (fazer antes de feature nova)

1. **Versionar tudo (urgente, é a rede de segurança que falta).** No
   `crm-express/`, `git add -A && git commit`. Hoje, se a pasta se perder, todo o
   trabalho de todas as sessões se perde. Só commitar com o ok do Bruno.
2. **Mover `docs/` para dentro do repo.** O repo git é `crm-express/`, mas
   `docs/` (este HANDOFF, o DEPLOY.md, a ESPECIFICACAO) fica um nível **acima** e
   **não iria** para o GitHub. Recomendação: mover `docs/` para
   `crm-express/docs/` para o runbook viajar junto. Confirmar com o Bruno.
3. **Deploy no Netlify** seguindo `docs/DEPLOY.md`: (a) Bruno cria Neon +
   GitHub + Netlify e cola as env vars; (b) Claude aplica a migração
   SQLite→Postgres + anexos-no-banco (deferida de propósito, para testar no 1º
   deploy, já que não há Postgres no ambiente do Claude). Local continua SQLite.
4. **Pendência de visual (combinada, não feita):** deixar a mini-tendência do
   card "SLA médio" (aba SLA e Gargalos) no mesmo padrão limpo dos gráficos de
   barra da aba Vazão (sem o trilho cinza). É a única ponta de UI em aberto.

### Segurança de produção — o que já está pronto (não refazer)
- Cookie de sessão `secure` em produção.
- Link de convite/redefinição **nunca aparece na tela em produção** (`mailer.ts`
  checa `NODE_ENV`; em prod sem SMTP, não envia e não vaza o link).
- Contas demo (`teknisa123`) e clientes fictícios atrás de `SEED_DEMO` (produção
  não define a flag). Local usa `npm run db:seed`/`db:reset` (já passam a flag).
- Falta configurar no deploy: `SMTP_*` (webmail Teknisa) e
  `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` (multi-instância).

### Lembrete operacional
O servidor de dev cai entre sessões; religar com o preview (`npm run dev` local
ou o preview do harness). Reiniciar de verdade após mexer em schema. `db:reset`
apaga a senha da conta master `bruno.machado@teknisa.com` (reativa por convite,
link impresso no log do seed).

---

## 1. O que é o projeto

CRM interno da Diretoria de Small Business da Teknisa (linha **Express**:
TecFood + Retail), cobrindo a jornada **pós-venda**:

```
contrato assinado → validação comercial → alocação → cronograma →
implantação → go-live → acompanhamento → finalizado → CS ativo
```

Objetivo: substituir email e planilhas por um sistema único, com SLA de
implantação e visão por nível (diretoria / coordenação / consultor / CS).

- Escopo v1: **só Express**. Canais (revenda) é v2, fora de escopo.
- Entrada de dados: manual pelos coordenadores, mais o formulário de repasse.
- Sustentado por **Bruno + Claude, sem time de dev**: manter o código simples,
  sem abstrações prematuras.

### Quem é quem

- **Bruno Machado** — Head da Diretoria de Small Business (dono do projeto).
- **Leandro Assis** — diretor comercial; revisa contrato e repassa para implantação.
- **Leonardo** — coordena Retail (3 consultores a definir + Lorena no CS).
- **Mariana** — coordena TecFood (Marciana, Patrícia Ávila, Caroline Oliveira,
  Lara Cezar + Jussara no CS).
- Consultores não cruzam produto. Cada coordenação tem seu próprio CS.
- Comunicação interna: Discord. Email corporativo: webmail interno, **sem SSO**.
- Contratos: cada venda gera o par `SAAS-`/`LUSO-<AAAAMM><proposta>-<seq>`,
  assinados via Certisign. A cláusula SERVIÇO do LUSO define o treinamento
  (ex.: 24h) e o prazo para concluí-lo.

---

## 2. Stack e como rodar

- **Next.js 16** App Router + Server Actions. O arquivo `crm-express/AGENTS.md`
  (referenciado por `CLAUDE.md`) avisa que esta versão tem breaking changes
  frente ao conhecimento de treinamento: **ler `node_modules/next/dist/docs/`
  antes de escrever código novo**. "Middleware" chama-se **"Proxy"** aqui.
- **TypeScript** strict. **Tailwind CSS v4** via bloco `@theme` em
  `src/app/globals.css` (não existe `tailwind.config.js`).
- **Prisma 6 + SQLite** (`prisma/dev.db`). **Não migrar para Prisma 7**:
  incompatibilidade de export nomeado `PrismaClient` em CommonJS.
- **bcryptjs** para senha, sessão própria via cookie (sem NextAuth).
- **nodemailer** com fallback de desenvolvimento: sem `SMTP_HOST`, o link
  aparece na tela e no console.
- **lucide-react** para ícones. Sem biblioteca de componentes: tudo Tailwind.
- **unpdf** para extrair o texto de PDF (contrato e plano de projeto).
- **xlsx** (SheetJS) para ler a planilha de cronograma na importação de atividades.

```bash
cd crm-express
npm install
npm run db:push     # aplica o schema
npm run db:seed     # time + templates + clientes de demonstração (idempotente)
npm run dev         # http://localhost:3000
```

`npm run db:reset` apaga o banco e recria do zero.

Variáveis em `.env`: `DATABASE_URL`, `APP_URL`, `SMTP_HOST`, `SMTP_PORT`,
`SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `ALLOWED_EMAIL_DOMAIN` (padrão
`teknisa.com`).

---

## 3. Acesso e contas

**Conta real da diretoria:** `bruno.machado@teknisa.com` (DIRETORIA, aprovada).
Está no `seed.mjs` e sobrevive a um `db:reset`.

**Contas de demonstração** (`bruno@teknisa.com`, `leandro@`, `mariana@`,
`leonardo@`, `marciana@`, `patricia@`, `caroline@`, `lara@`, `jussara@`,
`lorena@`) usam a senha pública `teknisa123`.

> **Pendência de segurança:** essas contas precisam ser apagadas antes de
> liberar o sistema para a equipe real. Decisão registrada: manter enquanto se
> testa, remover ao dar acesso aos usuários reais.

### Os 5 fluxos de autenticação

1. **Entrar** (`/login`): email e senha.
2. **Primeiro acesso** (`/primeiro-acesso`): qualquer pessoa do domínio
   `ALLOWED_EMAIL_DOMAIN` pode pedir, mas **ninguém entra por aqui**. O
   formulário só define a senha e abre uma solicitação `PENDENTE`; o acesso é
   liberado por diretoria ou coordenação em `/equipe`. Vale para os dois casos,
   email novo e conta **já pré-cadastrada sem senha**: é isso que impede alguém
   de tomar uma conta alheia ainda não ativada só por saber o email dela. O
   papel e o produto informados são apenas um *pedido*, confirmados na
   liberação.
3. **Convite** (inline em `/equipe`): diretoria/coordenação cria o usuário; o
   token de 7 dias vai por email **e** aparece como link copiável na tela,
   sempre, mesmo se o email falhar. A pessoa acessa `/convite?token=`.
4. **Esqueci minha senha** (`/esqueci-senha` → `/redefinir-senha`): token de 1h.
5. **Liberação de acesso**: em `/equipe`, a seção "Solicitações de acesso" lista
   quem passou pelo primeiro acesso. Quem libera confirma papel e produto, ou
   recusa. **Toda decisão vira log**: `approvedAt`/`approvedById` guardam quando
   e por quem, nos dois desfechos (o `status` diz qual foi), e a seção
   "Decisões de acesso" mostra isso na tela.

> **Partida do sistema:** como o primeiro acesso passou a exigir liberação de
> alguém já dentro, a primeira conta da diretoria não teria quem a liberasse.
> Por isso o `seed.mjs` gera um **link de convite** para
> `bruno.machado@teknisa.com` e imprime no console: o convite ativa a conta
> direto, porque o token já prova a autorização. O mesmo vale para qualquer
> pessoa convidada: o link é o caminho rápido, o primeiro acesso é o caminho
> que passa pela fila.

`getUser()` recusa sessão de quem está inativo ou com status de bloqueio. O
login só revela "pendente/recusado" **depois** de conferir a senha, para não
expor a situação de contas alheias.

---

## 4. Identidade visual e regras de UI

Paleta e tipografia do Guia de Marca Teknisa 2025, em `globals.css` (`@theme`):

```css
--color-background: #f2f6fb;  --color-card: #ffffff;
--color-foreground: #273138;  --color-muted: #e8eef7;
--color-muted-foreground: #64748b;  --color-border: #dde5f0;
--color-primary: #040486;     --color-primary-hover: #03004f;
--color-accent: #0051d0;      --color-destructive: #dc2626;
--color-success: #059e1e;     --color-warning: #b98a00;
--color-warning-bg: #f4b800;
--color-tecfood: #0051d0;     --color-retail: #059e1e;
--font-sans: var(--font-roboto);      /* corpo */
--font-display: var(--font-poppins);  /* h1/h2/h3 */
```

Logos em `public/brand/`. Logo colorida só sobre fundo claro.

### Regras fixas (não revisitar sem motivo forte)

- **Nunca usar travessão (—) em texto de usuário.** Usar ponto, vírgula,
  dois-pontos ou hífen. Pedido com ênfase pelo usuário.
- **Sem botão de confirmação para mudança de campo único.** Status de
  atividade, data, anexo: tudo salva sozinho via `form.requestSubmit()` no
  `onChange`. Botão de confirmar só quando a ação **afeta outras pessoas**
  (editar papel, apagar usuário) e, nesse caso, em **modal centralizado via
  `createPortal`**, nunca colado ao campo.
- **Label sempre acima do campo**, nunca ao lado.
- **Datas usam `<input type="date">` nativo.** `native-date-input.tsx` é só um
  wrapper para o caso `autoSubmit`. **Não reintroduzir datepicker customizado**:
  já quebrou duas vezes no Safari real do usuário dentro de listas densas.
- **UI flutuante sem posicionamento calculado em JS.** O tooltip
  (`info-tooltip.tsx`) é CSS puro (hover + foco). Popover e modal usam
  `createPortal` para `document.body`.
- **Cor é semântica**: verde em dia/concluído, azul informação/etapa atual,
  âmbar atenção (a partir de 80% do prazo), vermelho estouro/erro. Hierarquia
  de texto com peso e itálico, não só com cor.
- **Permissão em duas camadas**: a UI mostra a informação para todos mas só
  renderiza o controle para quem pode agir; **toda Server Action repete a
  checagem no servidor**. A UI nunca é a única trava.

---

## 5. Modelo de dados

Schema completo em `prisma/schema.prisma`.

**Usuários e acesso**
`Client` tem `deletedAt` (arquivado; some das listas mas fica no banco) e
`cep`. Arquivar marca também `deleted=true` nos projetos do cliente.

`User` (`role: DIRETORIA|COORDENACAO|CONSULTOR|CS`; `productLine` null = vê
tudo; `seniority`; `active`; `status: AccessStatus (PENDENTE|APROVADO|RECUSADO)`,
default APROVADO; `approvedAt`/`approvedById`; `deletedAt` = arquivado;
`awayUntil`; `passwordHash` null = aguardando primeiro acesso).
`Session`, `InviteToken`, `PasswordResetToken`.

**Cliente e contratos**
`Client`, `Contact`.
`Contract` (`kind: SAAS|LUSO|ADITIVO|OUTRO`; `numero` único; vigência; valores;
`limiteSaasMb`; `horasTreinamento`; **`prazoTreinamentoDias`** default 60,
varia por cliente e alimenta o marco contratual).
`ContractItem` (linhas de licença/manutenção).
`ProjectDocument`: anexos ligados ao **Project**, não a um contrato. Arquivos em
`uploads/contracts/<documentId>.<ext>` (fora do git), servidos com autenticação
por `src/app/api/documentos/[documentId]/route.ts`.

**Pipeline (etapas do funil, editáveis)**
`PipelineStage` (`nome`, `ordem`, `idealDays` = prazo ideal/SLA, `isFinal` =
conta como concluído). **Não existe mais o enum `Stage`**: as etapas são dados,
criadas e apagadas pela diretoria em `/pipeline`. Uma pipeline única, usada
pelos dois funis.

**Projeto**
`Project` (`stageId` → `PipelineStage`; `status: ATIVO|PAUSADO|CANCELADO`;
`deleted` soft delete; `consultantId`; `peso`; datas; `stageEnteredAt` = âncora
do SLA; `isHistorico`).
`ProjectUnit`, `ProjectModule`, `ProjectActivity` (`responsavel:
TEKNISA|CLIENTE|AMBOS`, `status: PENDENTE|EM_ANDAMENTO|CONCLUIDA|CANCELADA`,
`dueDate`, `assigneeId`), `ProjectChecklistItem` (cópia do template ao entrar
na etapa).

**Repasse comercial → implantação**
`ClientIntake` (1 por projeto, `token` único para o link público,
`status: RASCUNHO|ENVIADO`, `etapaAtual`, `preenchidoPor` + os campos das 5
etapas). Múltiplas escolhas são texto separado por `|` (SQLite não tem lista
escalar).

**SLA e histórico**
`StageTransition` (`fromStageId`/`toStageId`), `ProjectPause` (implementa o
**relógio duplo**: dias corridos vs. dias sob controle Teknisa),
`DelayJustification` (categoria + detalhe), `DelayCategory`.

**Templates** `ModuleTemplate`, `ActivityTemplate` (com `dedupKey`),
`StageChecklistTemplate`.
`ModuleTemplate.grupo` (`ModuloGrupo: FIXO|BASICO|COMPLETO|ADICIONAL`):
- **FIXO** = moldura da implantação, entra em todo projeto (Reunião de Abertura,
  Cadastros Iniciais, Encerramento). Não é selecionável no cadastro.
- **BASICO/COMPLETO** = módulos contratáveis (escopo básico / adicionais do
  completo). **ADICIONAL** = produto à parte (APP MyMenu).
O **catálogo TecFood é o escopo real da Mariana** (não é mais placeholder), com
as atividades do cronograma da Porto/Sempre Refeições. **Retail continua
placeholder** (aguarda Leonardo). O split dos grupos fiscais (Entrada/Estoque,
Saída/Faturamento) é uma proposta a validar com a Mariana: onde entram
"Clientes", "Medição de Efetivos" e "Cálculo da Apuração" entre DF Saída
(básico) e Faturamento (completo).

**Outros** `TimelineEntry`, `Notification` (`userId` null = broadcast), `HealthLog`.

---

## 6. Permissões (`src/lib/permissions.ts`)

Base: `sameProductOrDiretoria` — diretoria sempre; coordenação só do próprio
produto; demais papéis não.

| Função | Regra |
|---|---|
| `canAllocateConsultant` | Coordenação do produto + Diretoria |
| `canManageActivities` | Diretoria; Coordenação do produto; **Consultor alocado**; CS nunca |
| `canMoveStage` | = `canManageActivities` (mover etapa e marcar checklist) |
| `canCreateClient` | Coordenação + Diretoria (coordenação só do próprio produto) |
| `canEditClient` | Quem pode agir em algum projeto do cliente; sem projeto, coordenação/diretoria |
| `canPauseResumeProject` | = `canManageActivities` (consultor alocado pode pausar) |
| `canCancelProject` | Coordenação do produto + Diretoria |
| `canJustifyDelay` | = `canManageActivities` |
| `canUploadDocuments` | = `canManageActivities` |
| `canInviteUsers` | Diretoria ou Coordenação |
| `canAssignRole` | Diretoria: qualquer papel. Coordenação: só CONSULTOR/CS do próprio produto |
| `canEditUserRoles` | **Só Diretoria** |
| `canEditPipeline` | **Só Diretoria** (config global, afeta os dois funis) |
| `canReviewAccessRequests` | = `canInviteUsers` |

CS não edita implantação: perfil de leitura e atuação pós-handoff.

---

## 7. Funcionalidades por tela

### `/` Dashboard
**Estrutura em páginas por produto + abas** (parâmetros na URL:
`?produto=TECFOOD&aba=sla&de=&ate=`). Produto vira página (TecFood/Retail):
coordenação e demais papéis com `productLine` veem só o seu; diretoria e quem
não tem produto veem os dois. Filtro de **período** no topo, afeta tudo.
Abas: **Geral · SLA e Gargalos · Vazão e volume · Qualidade e causas · Pessoas**.
- **Geral**: KPIs (em andamento, concluídos, atrasados, pausados, **SLA médio
  de implantação**), projetos ativos por etapa, atenção necessária.
- **SLA e Gargalos**: SLA médio (assinatura → go-live, dias corridos) com
  mini-tendência por mês de conclusão; **% no prazo**; **tempo médio por etapa**
  (barra, destaca o gargalo = etapa de maior média, compara com o SLA ideal);
  atenção necessária.
- **Vazão e volume**: contratos no período, MRR e ticket; novos contratos por
  mês e concluídos por mês (barras); aging dos ativos (faixas + mediana).
- **Qualidade e causas**: ranking de motivos de atraso (justificativas por
  categoria), tempo parado por pendência do cliente (pausas), cancelamentos.
- **Pessoas**: tabela por consultor com carga (ativos), atrasados, concluídos
  e SLA médio individual.
Cálculos em `src/lib/metrics.ts` (funções puras: `mediaImplantacao`,
`tendenciaImplantacao`, `tempoMedioPorEtapa`, `contagemPorMes`, `agingAtivos`,
`diasDePausa`, `atalhosPeriodo`). O "tempo por etapa" sai do histórico de
`StageTransition` (visitas já encerradas). "Atrasado" segue a visão única (SLA
da etapa OU marco contratual vencido, `projetoAtrasado`).

> **Cor por prazo** (helper `tomPrazo` em `page.tsx`): verde com folga (2+ dias),
> amarelo no limite (1 dia antes ou no dia), vermelho a partir de 1 dia após o
> prazo. Usado no "tempo por etapa" (estouro = vermelho). Regra do gestor.
> Datas atuais (`new Date()`/`Date.now()`) **não podem ficar no corpo do
> componente** (lint `react-hooks/purity`): ficam em helpers do `metrics.ts`.

> **Dados de demonstração do dashboard**: `prisma/demo-dashboard.mjs` cria
> projetos TecFood concluídos e ativos com histórico de transições, para as
> métricas aparecerem populadas. Idempotente por razão social. Rodar com
> `node prisma/demo-dashboard.mjs`. É dado de teste, pode apagar.

> **Atraso = visão única.** Um projeto conta como atrasado quando estoura o
> **SLA da etapa** (`slaFor().atrasado`) **ou** quando vence um **prazo
> contratual** (marco de treinamento, `contractMilestones` com
> `diasRestantes < 0`). O KPI "Atrasados", as colunas "Atrasados"/"No prazo"
> por consultor e por coordenação, e a lista "Atenção necessária" usam essa
> mesma regra (`projetoAtrasado` em `page.tsx`), para o dashboard bater com o
> que aparece dentro do projeto. Antes o dashboard só olhava o SLA da etapa e
> mostrava "100% no prazo" com o treinamento contratual já vencido. "Atenção
> necessária" mostra o **motivo** de cada atraso (etapa ou treinamento) e, em
> âmbar, os marcos que ainda vão vencer.

### `/funil` Funil
Quadro kanban por etapa, com troca entre TecFood e Retail.
**Drag and drop**: arrastar um card entre colunas abre um **modal com o
checklist obrigatório da etapa de origem**. Os itens são marcáveis ali mesmo e
o botão de mover fica travado enquanto houver pendência. Voltar etapa não exige
checklist. O id do card viaja no `dataTransfer` (não no estado do React), senão
o solte falha. `moveStage` aceita `redirectTo` para a pessoa continuar no quadro.

### `/clientes/novo` — cadastro a partir do contrato assinado
A primeira coisa pedida é o **PDF do contrato**, não um campo de texto. O
arquivo é lido no servidor (`src/lib/contrato-pdf.ts`) e preenche o cadastro:
razão social, CNPJ, endereço, CEP, cidade, UF, número da proposta, data de
assinatura, comercial responsável, produto, o **par SAAS + LUSO** com vigência,
limite SaaS, horas e prazo de treinamento, e a **tabela de soluções**
(licença e manutenção, com medida e valores). O PDF fica anexado ao projeto.

- A leitura é **determinística, por âncoras do modelo Teknisa**: sem IA, sem
  chave de API, sem custo e sem mandar contrato para fora. Se o jurídico mudar
  o texto do modelo, o que deixar de ser reconhecido volta em `camposNaoLidos`
  e vira aviso na tela, em vez de valor inventado.
- **Sem OCR.** Contrato Express chega assinado pela Certisign, com camada de
  texto. PDF escaneado é recusado com explicação e o cadastro segue manual.
- Os rótulos da capa ("Cliente:", "Contato Teknisa:") usam fonte com
  codificação quebrada e saem como lixo no extrator. Por isso o nome do
  comercial é achado **pela posição** (a linha seguinte à do cliente), não pelo
  rótulo. Não tentar ancorar por ele de novo.
- **Módulos e cronograma.** O contrato vende o produto ("Teknisa TecFood"), não
  os módulos funcionais, então o escopo é marcado pelo coordenador: radio de
  produto, botões **Básico**/**Completo** (Completo é cumulativo) e checkboxes
  individuais por grupo. A moldura fixa aparece como "Sempre incluído" e não é
  selecionável. Ao cadastrar, o motor único `gerarCronogramaProjeto`
  (`actions.ts`, espelhado no `seed.mjs`) instancia as atividades dos módulos
  contratados **mais** as da moldura fixa, na ordem do catálogo (ordem do
  módulo, depois da atividade), sem repetir atividade compartilhada
  (`dedupKey`, ex.: "Medição de Efetivos"). As descrições alimentam o ícone de
  info da atividade. Ver a seção do modelo de dados para o catálogo/grupos.
- Ao enviar, o PDF é **relido no servidor**: os campos visíveis valem pelo que
  está no formulário (o coordenador confere), e os detalhes que não aparecem na
  tela vêm sempre do documento assinado.
- Contrato ou CNPJ já cadastrado vira aviso **no momento do upload**, antes de
  preencher o resto.
- Continua existindo o caminho manual, em "Não tenho o PDF".
- **Plano de projeto (2º documento, opcional)**: `src/lib/plano-pdf.ts` lê o
  Plano de Projeto e traz o que o contrato não tem: os **módulos contratados por
  nome** (casam com o catálogo e **marcam os checkboxes automaticamente**, sem
  palpite), o **usuário-chave** (nome/email/CPF) e o **coordenador do cliente**
  (viram contatos), e a **previsão de início/término** (viram
  `dataInicio`/`goLivePrevisto`). Ação `analisarPlanoAction`; `createClientProject`
  relê o plano, cria os contatos, grava as datas e anexa o PDF. O contrato segue
  obrigatório; o plano é opcional.
- **Importar cronograma** (`ImportCronogramaButton` na lista de atividades →
  `importarCronograma`): lê a planilha Excel das consultoras
  (`src/lib/cronograma-xlsx.ts`, aba CRONOGRAMA: fase, atividade, Término/Início
  = data prevista, status) e cria as atividades. Não duplica: pula títulos que
  já existem (permite reimportar a planilha atualizada).

### Reanexar contrato num cliente já cadastrado
Na página do cliente, "Atualizar pelo contrato" (`ContractReuploadPanel`) lê um
PDF novo e **pergunta antes de mexer em nada**, com duas opções:
- **Atualizar informações com este contrato**: o contrato passa a ser a base.
  Sobrescreve os dados cadastrais que o PDF traz (mantém o que ele não traz),
  atualiza os contratos existentes pelo número e cria os que faltam, troca as
  linhas de serviço, e ajusta a data de assinatura do projeto. Guards:
  **CNPJ e número de contrato que pertençam a outro cliente não são tocados**,
  e a divergência fica registrada. Tudo vira entrada na timeline do projeto.
- **Só anexar, manter dados atuais**: guarda o PDF como anexo, não altera nada.
Nos dois casos o PDF é anexado ao projeto. Action: `applyContractToClient`.

### Apagar cliente (arquivar / apagar em definitivo)
Na página do cliente e na lista, `DeleteClientPanel` abre um modal com:
- **Arquivar** (padrão, `archiveClientAction`): `Client.deletedAt` é setado e os
  projetos do cliente ficam `deleted=true`. Some das listas, do funil e do
  dashboard, mas o registro e o histórico ficam. Permissão: diretoria, ou
  coordenação se todos os projetos forem do produto dela (`canDeleteClient`).
- **Apagar em definitivo** (`hardDeleteClientAction`, **só diretoria**,
  `canHardDeleteClient`): cascade remove projetos, contratos, atividades,
  anexos e histórico, e os arquivos dos anexos são apagados do disco antes.
  Sem volta.
Clientes arquivados aparecem em `/clientes?arquivados=1`, com "Restaurar"
(`restoreClientAction`). A página do cliente arquivado mostra banner e
restaurar em vez dos controles de edição.

### `/clientes` e `/clientes/[id]`
A página do cliente é o lugar de **consultar e ajustar tudo**: visão geral
(contratos, projetos, unidades, licença, recorrência), projetos com SLA,
soluções e serviços contratados (agregados dos itens de contrato), documentos
e anexos de todos os projetos, contratos e contatos.
Tudo editável em painéis que abrem e fecham (`TogglePanel`): dados cadastrais,
**contrato** (incluindo `prazoTreinamentoDias`), contatos (adicionar, editar,
remover) e upload de documentos.

### `/projetos/[id]`
Layout, de cima para baixo:
1. **Stepper das etapas** em largura total: nome da etapa em destaque, barra de
   jornada, círculos coloridos (verde concluída, azul atual, cinza futura) e o
   **prazo ideal de cada etapa como chip abaixo de cada ponto**.
2. **Linha de 3 cards**: consultor responsável · documentos e anexos · marco
   contratual (com barra mostrando quanto da janela já correu).
3. **Linha de 3 cards**: repasse do comercial · checklist da etapa ·
   justificar atraso (com as justificativas listadas abaixo do box, cada uma
   removível).
4. **Cronograma de atividades** em largura total: cada atividade tem ícone de
   info com descrição e pautas em tooltip, tags coloridas (azul esforço, verde
   quem toca, âmbar depende do cliente) e controles de status, entrega e
   exclusão. O formulário "Criar nova atividade" tem autocompletar de título
   com as atividades padrão do produto.
5. **Timeline** em largura total e **Pausas** (quando houver).

### `/pipeline` (só diretoria)
Criar etapa antes ou depois de qualquer outra, renomear, reordenar, marcar como
etapa final e apagar. O **prazo fica entre as etapas** (faixa de transição), não
no card da etapa: representa o tempo para sair de uma e chegar à próxima
(`idealDays` da etapa de origem, editado por `savePipelineTransicao`; nome/final
por `savePipelineStage`). No stepper do projeto o prazo aparece no **conector**
entre as etapas, não embaixo. A última etapa não tem prazo (não há saída). Ao apagar, os projetos
daquela etapa vão para a vizinha. Mostra quantos projetos há em cada etapa.

### `/equipe`
Carga de trabalho dos consultores, solicitações de acesso, convites pendentes
com link copiável, edição de papel e **apagar usuário**.
**Apagar = arquivar**: o registro fica com `active=false` e `deletedAt`, de
propósito, para que comentários, movimentações e conclusões **mantenham o
autor** (exigência da gestão). Some das listas, perde sessões e tokens, e só o
trabalho **em aberto** é desvinculado. Reconvidar o mesmo email reativa a conta.

### `/repasse/[token]` — formulário público (sem login)
Substitui a reunião de repasse comercial → implantação. Gerado na página do
projeto ("Gerar formulário de repasse"), já **pré-preenchido** com o que o CRM
sabe. São **5 etapas** com barra de progresso, salvas uma a uma (dá para fechar
e voltar): Empresa · Contatos · Operação · Contratação · Fiscal e observações.

Ao **gerar** o repasse (`createIntakeLink`), o formulário já nasce preenchido
com o que o CRM sabe, que hoje vem em boa parte do próprio contrato lido:
cadastro (razão social, CNPJ, CEP, endereço, cidade, UF), **módulos** marcados
(dos `ProjectModule` vinculados), **número de licenças** (soma das linhas de
licença do LUSO) e o **contato principal** (do primeiro contato do cliente, se
houver). O comercial confere e completa o resto.

Ao enviar, os dados são **importados** para o CRM: atualiza o cliente, cria
contatos, vincula os módulos, escreve na timeline e notifica a coordenação.
A coordenação lê tudo em `/projetos/[id]/repasse`.

**Conferência de identidade na importação** (`src/lib/identity.ts`): nunca
duplicar registro nem descartar informação em silêncio.
- Contatos batem por **email, telefone (últimos 8 dígitos) ou nome** (nome
  sozinho exige 2 tokens em comum). Mesma pessoa → completa o que falta e fica
  com o nome mais completo.
- Cliente: só preenche campo **vazio**. Se o formulário divergir do cadastro
  (ex.: CNPJ diferente), **mantém o cadastro** e registra a divergência na
  timeline e no alerta. A comparação ignora formatação e acento.

**As perguntas e opções ficam em `src/lib/intake.ts`** — é o arquivo a editar
quando o time revisar o questionário. Campo novo pede também coluna em
`ClientIntake` (schema) e leitura em `dadosDaEtapa()` (`actions.ts`).

---

## 8. Onde se define cada prazo

Existem **dois** prazos diferentes:

1. **Prazo por etapa (SLA)** → `/pipeline`, campo "Prazo ideal (dias)".
   Alimenta o chip abaixo de cada ponto do stepper, o "Xd na etapa" e os
   alertas de atraso.
2. **Prazo contratual do treinamento** → `Contract.prazoTreinamentoDias`,
   editável em **Cliente → Contratos → Editar contrato**. Conta a partir da
   assinatura e varia por cliente. `contractMilestones` lê do contrato **LUSO**
   e só cai no padrão de 60 dias se estiver vazio.

---

## 9. Armadilhas conhecidas (custam tempo se esquecidas)

1. **Prisma client fica velho após mudar o schema.** Sintoma: comportamento
   inexplicável, campo novo vindo `undefined`, login que "pisca" e volta.
   **Sempre reiniciar o `npm run dev` de verdade** (encerrar o processo), não
   só salvar arquivo. Conferir também se não sobrou mais de um `npm run dev`
   empilhado segurando a porta 3000: `lsof -ti tcp:3000`.
2. **`formAction` em botão sobrescreve o `name`.** O React usa o atributo
   `name` do botão para o id da action, então `name="x" value="y"` nunca chega
   ao servidor. Para distinguir intenção, criar **actions separadas**.
3. **`overflow-x-auto` também corta na vertical.** A régua do stepper precisa de
   padding para o anel da etapa atual não ser cortado.
4. **Breakpoints (`sm:`/`lg:`) quebram com zoom alto do navegador**, porque a
   viewport efetiva fica estreita e tudo empilha. Em formulário, preferir
   `flex` com largura fixa nos campos curtos e `flex-1 min-w-[...]` nos longos.
5. **`<datalist>` dentro do bloco do campo desalinha o input** em alguns pixels.
   Deixar fora (é referenciada por id).
6. **Não confiar só no meu preview de browser.** Ele não replica todos os edge
   cases de Safari real. Pedir print de confirmação em mudança visual complexa.
7. **Sempre rodar `npx tsc --noEmit` e `npx next build` limpos** antes de dar
   algo como pronto. Se aparecerem erros em arquivos `.next/types/* 2.ts`, são
   duplicatas de sincronização de arquivos, não do código: apagar e repetir.
8. **Anexo sobe por Server Action, e o limite padrão do Next é 1MB.** Está
   elevado para 10MB em `next.config.ts` (`serverActions.bodySizeLimit`), com
   o teto real de 8MB validado em `uploadDocument`. Mexer nos dois juntos.
9. **Passar um registro do Prisma inteiro para componente `"use client"`
   manda todas as colunas para o navegador**, inclusive `passwordHash`. Tipar
   a prop com `Pick<>` não basta: o que viaja é o objeto de verdade. Montar um
   objeto só com os campos usados no ponto da chamada.
10. **Campo de formulário é entrada não confiável.** Valor fora do enum
    (papel, status, produto) ou data impossível chega ao Prisma e derruba a
    página. Validar antes e devolver `?erro=` com mensagem na tela.

---

## 10. Estado atual dos dados

- 11 usuários: `bruno.machado@teknisa.com` (real) + 10 de demonstração.
- 4 clientes e 4 projetos, incluindo os 2 de demonstração do seed
  (Cooperativa de Alimentos de Embu e VR Distribuidora) e clientes de teste
  criados durante o uso.
- 9 etapas de pipeline, 4 repasses.
- O anexo `EXEMPLO-contrato-anexado.pdf` no projeto da Cooperativa é um PDF
  vazio criado só para demonstrar a visualização: pode apagar.

---

## 11. Pendências

**Dependem de levantamento do Bruno (não são decisão técnica):**
- **TecFood: catálogo real já implementado** (escopo da Mariana + atividades da
  Porto). Falta a Mariana **validar o split dos grupos fiscais** (DF Entrada vs
  Estoque, DF Saída vs Faturamento) e confirmar as descrições. **Retail ainda é
  placeholder**, aguarda o levantamento com o Leonardo.
- Prazos ideais de SLA definitivos por etapa (hoje são benchmark provisório).
- Categorias de justificativa de atraso definitivas.
- Revisão das perguntas do formulário de repasse com o time.
- Se o consultor deve ver o valor do deal.
- Restrições de infraestrutura do TI da Teknisa (hosting).
- Modelo de contrato **Retail Express** (só temos o TecFood).

**Deploy (Netlify) — ver `docs/DEPLOY.md`:**
- Preparação de código já feita: `netlify.toml`, `.env.example`, script
  `netlify:build`, `.gitignore` (ignora `.env`, `dev.db`, `uploads`), seed com
  contas/clientes demo atrás de `SEED_DEMO` (produção não define), e mailer que
  **nunca mostra o link na tela em produção** (`NODE_ENV==="production"`).
- Falta (precisa das contas do Bruno): criar Postgres no Neon, repo no GitHub,
  site no Netlify e colar as variáveis. E aplicar a migração de código
  SQLite→Postgres + anexos-no-banco (feita quando houver `DATABASE_URL`, para
  testar no primeiro deploy). Local segue em SQLite.

**Técnicas:**
- Apagar as contas de demonstração antes de liberar para a equipe real.
- Definir `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` fixo se o deploy tiver mais de
  uma instância, senão as Server Actions quebram entre instâncias.
- Configurar SMTP (hoje o link de convite e de senha aparece na tela).
- Export CSV e notificação via Discord.
- Tela de administração de templates de atividade e de checklist.
- Canais (v2), fora do escopo atual.

---

## Prompt para colar em uma conversa nova

```
Estou continuando o desenvolvimento do CRM Express (Teknisa Small Business),
projeto em "/Users/brunomachado/Desktop/Claude/CRM TEK - Express/crm-express".

Antes de qualquer coisa, leia por completo
"/Users/brunomachado/Desktop/Claude/CRM TEK - Express/docs/HANDOFF.md". Ele tem
todo o contexto de negócio, o modelo de dados, as regras de UI e as armadilhas
conhecidas do projeto.

Depois leia "AGENTS.md" na raiz do projeto: esta versão do Next.js tem breaking
changes frente ao seu conhecimento de treinamento.

Pontos que sempre valem: nunca usar travessão em texto de usuário, nunca
datepicker customizado, label acima do campo, sem botão de confirmação para
edição de campo único, e reiniciar o dev server sempre que mexer no schema.

[Descreva aqui a próxima tarefa.]
```
