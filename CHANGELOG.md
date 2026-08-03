# CHANGELOG — CRM Express

Uma entrada por sessão relevante, mais recente no topo. Registra o que **mudou** e o
que ficou **verificado vs. pendente** — não repete o que o `git log` já diz.

Formato: `## AAAA-MM-DD — título curto` seguido de bullets. Marcar status com o
vocabulário honesto: ✅ no ar · 🔨 construído, não entregue · 🌿 só em branch · ⏳ pendente.

---

## 2026-08-03 — Acesso: senha da diretoria, criar usuário direto, trocar senha

- **Login da diretoria destravado:** o seed passa a garantir a senha inicial
  `teknisa123` para `bruno.machado@teknisa.com` (a conta antes nascia sem senha e
  dependia de convite, que falhava). Temporário: cada redeploy reaplica; remover ao
  estabilizar / migrar para o servidor Teknisa.
- **Diretor cria usuário direto** (`createUserAction`), sem convite: conta nasce ativa
  e aprovada com senha inicial `teknisa123`. O painel da equipe passou de "convidar"
  para "criar usuário".
- **Configurações** (`/config`): tela para o usuário trocar a própria senha
  (`changeOwnPasswordAction`), no menu lateral.
- Lápis de editar atividade ganhou borda igual à da lixeira.
- Pendente (adiado por limite): remover Pipeline do menu, botão de editar pipeline no
  funil, e o salvar único do pipeline.

## 2026-08-03 — Editar campos de atividade já criada

- Cada atividade ganhou **"Editar campos"** (lápis) que abre um painel inline com os
  mesmos campos da criação (grupo, responsável, horas, entrega, envolvidos, descrição,
  atribuído), pré-preenchidos, com **Salvar** (botão com estado "Salvando..."). Action
  `updateActivity`. Status e entrega seguem editáveis direto no card.
- Agrupamento passou a priorizar a `fase` sobre o módulo, então editar o grupo move a
  atividade mesmo quando ela veio de um módulo.

## 2026-08-03 — Nova atividade: escolher/criar grupo

- O form "Criar nova atividade" ganhou o campo **Grupo**: dropdown com os grupos
  existentes + "＋ Criar novo grupo" (abre campo de texto). Define a `fase` da
  atividade, que é a chave de agrupamento do cronograma.
- Criar grupo = escolher "novo grupo" e digitar o nome; o grupo surge ao salvar.

## 2026-08-03 — Feedback de ação em todo o sistema (toast global)

- **Toast global** (`ActionToast`, montado no layout do app) mostra sucesso/erro de
  qualquer ação em qualquer tela, lendo `?ok=`/`?erro=` e limpando o parâmetro da URL.
  Mensagens centralizadas em `src/lib/feedback.ts`.
- **Pipeline** agora emite sucesso (salvar prazo/etapa, criar, mover, remover) — era
  o caso reportado sem retorno. Banner inline antigo do pipeline removido (toast cobre).
- Telas com retorno próprio mais rico (clientes, projeto, equipe) são ignoradas pelo
  toast e mantêm seus banners contextuais (ex.: link "abrir cliente já cadastrado").

## 2026-08-02 — Cronograma agrupado por fase (accordion)

- A lista plana de atividades virou **blocos recolhíveis por módulo** (o bloco do
  cronograma), com `<details>` nativo. Cabeçalho mostra progresso (concluídas/total),
  bolinha de status e ✓ quando completo. Auto-abre a fase atual.
- Agrupamento: por módulo (via `template.moduleTemplate`); atividades importadas de
  planilha caem pelo `fase`; manuais em "Outras atividades".
- Corrigido 2 bugs da 1ª versão: (a) agrupava tudo em "Outras atividades" (o `fase`
  vinha vazio; o bloco certo é o módulo); (b) o `group` no `<details>` colidia com o
  `group-hover` do tooltip e abria todos os tooltips (agora `group/fase` nomeado).

## 2026-08-02 — Cadastro de cliente: feedback de carregamento e sucesso

- Botão "Cadastrar cliente" com estado "Cadastrando..." (`useFormStatus`), evita o
  duplo clique que acusava CNPJ já cadastrado. Sucesso mostra banner na página do cliente.

## 2026-08-02 — Migração SQLite → Postgres + GitHub

- **Código no GitHub:** repo privado `brunomachado-tek/crm-express-imp`, branch `main`.
  Autenticação resolvida (conta Teknisa `brunomachado-tek`, não a pessoal). 🔨
- **Migração para Postgres** (commit `ccd6594`). Decisão: **Postgres em dev e prod**,
  um schema só (o Netlify+Neon é temporário; destino final é o servidor da Teknisa).
  - `schema.prisma`: provider `postgresql`.
  - Anexos passam a ser guardados **no banco** (`ProjectDocument.data`/`mimeType`/`size`);
    upload/download/delete não tocam mais o disco (serverless não persiste).
  - Busca de cliente `mode: "insensitive"`; teto de upload 8→4 MB, bodySizeLimit 10→5 MB.
  - ✅ `tsc` e `next build` limpos. `db push` + runtime validam no 1º deploy.
- ⏳ **Próximo:** Bruno cria Neon + configura Netlify (env vars, sem SMTP por ora);
  depois eu verifico o primeiro deploy end-to-end. Ver `docs/DEPLOY-CHECKLIST.md`.

## 2026-08-02 — UI: mini-tendência do SLA médio no padrão limpo

- Card "SLA médio de implantação" (aba SLA e Gargalos): a mini-tendência por mês de
  conclusão perdeu o trilho cinza (`bg-muted` de fundo) e passou a usar o mesmo padrão
  das barras da aba Vazão, barras sobre uma linha de base. Mantém o destaque do último
  mês e os stubs de meses sem conclusão. ✅ verificado no preview (build + `tsc` limpos,
  console sem erros). Fecha a última pendência de UI do handoff.

## 2026-08-02 — Rede de segurança: primeiro commit real + docs no repo

- **Versionado todo o app** num commit real (`2d9e710`): 85 arquivos, 21.336 linhas.
  Antes só existia o scaffold do Create Next App e tudo o mais estava solto na working
  tree, sem rede de segurança. 🔨 (commit local, ainda **sem `git remote`**).
- **`docs/` movido para dentro do repo** (`crm-express/docs/`): HANDOFF, DEPLOY e
  ESPECIFICACAO agora viajam junto para o GitHub quando o remote for criado.
- Conferido antes de commitar: `.gitignore` segura `.env`, `dev.db`, `uploads` e
  `node_modules`; nenhum segredo nem arquivo grande entrou. `.claude/launch.json`
  (config do dev server, sem segredo) foi versionado de propósito.
- ⏳ **Próximo:** criar GitHub + Neon + Netlify (contas do Bruno) e aplicar a migração
  SQLite→Postgres, seguindo `docs/DEPLOY.md`. Pendência de UI: mini-tendência do card
  "SLA médio".

## 2026-08-01 — Memória de repositório + kit de trabalho

- Criados `ARCHITECTURE.md` (mapa de rotas, modelo Prisma, fluxos, deploy) e este
  `CHANGELOG.md`. O `CLAUDE.md` do repo já existia (importa `AGENTS.md`).
- Instaladas as skills globais `/status`, `/handoff` e `/deploy` (kit do irmão do Bruno),
  a `/deploy` com a tabela de infra preenchida para Netlify + Postgres Neon.
- **Estado do git a confirmar:** só existe o commit inicial (`Initial commit from Create
  Next App`); todo o app (rotas, 51 Server Actions, schema Prisma) está **não commitado**
  na `main`. Rodar `/status` para auditar o que está no ar vs. só local antes da próxima
  entrega.
- **Risco registrado no ARCHITECTURE:** `schema.prisma` tem `provider = "sqlite"` mas a
  produção usa Postgres — validar o `netlify:build` contra o Neon.
