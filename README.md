# CRM Express · Teknisa Small Business

CRM interno pós-venda: contrato assinado → validação comercial → alocação → cronograma → implantação → go-live → acompanhamento → CS.

Especificação completa e decisões de produto: [`../docs/ESPECIFICACAO.md`](../docs/ESPECIFICACAO.md)

## Rodar localmente

```bash
npm install
npm run db:push      # cria/atualiza o banco (SQLite em prisma/dev.db)
npm run db:seed      # time da Express + templates + 2 clientes de demonstração
npm run dev          # http://localhost:3000
```

`npm run db:reset` apaga o banco e recria do zero.

## Usuários seed

Senha de todos: `teknisa123` (trocar antes de ir para produção).

| Email | Papel |
|---|---|
| bruno@teknisa.com | Diretoria |
| leandro@teknisa.com | Diretoria |
| mariana@teknisa.com | Coordenação TecFood |
| leonardo@teknisa.com | Coordenação Retail |
| marciana@ / patricia@ / caroline@ / lara@teknisa.com | Consultoras TecFood |
| jussara@teknisa.com (TecFood) / lorena@teknisa.com (Retail) | CS |

## Acesso

Quatro fluxos:

- **Entrar**: email + senha
- **Primeiro acesso** (`/primeiro-acesso`): fallback manual, o usuário informa o email de uma conta já pré-cadastrada e define a própria senha
- **Convite** (`/equipe/novo` → `/convite?token=`): fluxo principal, diretoria/coordenação cria o usuário e um token de 7 dias é enviado por email (ou exibido na tela em dev); a pessoa convidada só define a senha
- **Esqueci minha senha** (`/esqueci-senha`): token de 1h por email

O envio de email usa SMTP via variáveis no `.env`: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `APP_URL`. Sem `SMTP_HOST` configurado (dev), o link aparece na própria tela e no console do servidor.

## Permissões

Regras centralizadas em `src/lib/permissions.ts` e aplicadas em duas camadas: a UI mostra a informação para todos, mas só renderiza o controle de ação para quem pode executar; cada Server Action em `src/lib/actions.ts` repete a mesma checagem no servidor (a UI nunca é a única trava).

| Ação | Quem pode |
|---|---|
| Alocar/trocar consultor do projeto | Coordenação do produto + Diretoria |
| Pausar/retomar projeto | Consultor alocado + Coordenação do produto + Diretoria |
| Cancelar projeto | Coordenação do produto + Diretoria |
| Cronograma (criar/editar/excluir/status/data/atribuir) | Consultor alocado + Coordenação do produto + Diretoria |
| Justificar atraso | mesma regra do cronograma |
| Anexar documento do contrato | mesma regra do cronograma |
| Convidar usuário | Diretoria (qualquer papel/produto) + Coordenação (só Consultor/CS do próprio produto) |
| Editar papel/produto de um usuário existente | Só Diretoria (`/equipe`, ícone de lápis) |

CS não edita implantação (cronograma, documentos, atraso, ciclo de vida): perfil de leitura e atuação pós-handoff.

## Identidade visual

Paleta e tipografia do Guia de Aplicação de Marca Teknisa 2025 (`src/app/globals.css`): principal `#040486`, fundo `#F2F6FB`, texto `#273138`, complementares `#059E1E`/`#F4B800`; fontes Roboto (corpo) e Poppins (títulos). Logos em `public/brand/`.

## Padrões de UI

- **Sem travessão** em nenhum texto voltado ao usuário. Use ponto, vírgula ou dois-pontos.
- **Nenhum botão de confirmação para uma única mudança de campo.** Trocar o status de uma atividade, salvar uma data ou anexar um documento salva sozinho ao mudar o valor (ver `StatusSelect`, `DatePicker` com `autoSubmit`, `FileUploadField`: todos chamam `form.requestSubmit()` no `onChange`). Um botão de confirmação só aparece quando a ação tem efeito sobre outras pessoas (ex.: `EditRolePanel`, convite de usuário), e nesse caso é um modal centralizado, nunca colado ao lado do campo.
- **Datas usam `<input type="date">` nativo** (`src/components/ui/native-date-input.tsx` quando precisa de `autoSubmit`). Um calendário customizado com portal foi tentado e descartado: quebrava de forma inconsistente em listas longas em alguns navegadores. Não reintroduzir um datepicker customizado sem testar exaustivamente em navegador real (não só no preview) dentro de uma lista densa.
- Popover/modal que precisar de posicionamento livre (ex.: `EditRolePanel`) usa `createPortal` para `document.body`, nunca `position: absolute` aninhado dentro de listas ou grids.
- **Labels sempre acima do campo**, nunca ao lado.

## Stack

- Next.js 16 (App Router, Server Actions) + TypeScript + Tailwind 4
- Prisma 6 + SQLite (dev). Para Postgres: trocar `provider`/`DATABASE_URL` em `prisma/schema.prisma` e `.env`
- Auth própria por sessão em cookie (`src/lib/auth.ts`); emails via nodemailer (`src/lib/mailer.ts`)

## Onde mexer

- Modelo de dados: `prisma/schema.prisma`
- Regras de negócio (mover etapa, checklist, SLA): `src/lib/actions.ts` e `src/lib/sla.ts`
- Templates de módulos/atividades/checklists/SLA: hoje via seed (`prisma/seed.mjs`); tela de administração é evolução prevista
- Etapas do funil: enum `Stage` no schema + `STAGES`/`STAGE_LABELS` em `src/lib/format.ts`
- Documentos e anexos: modelo `ProjectDocument`, ligado ao projeto (não a um contrato específico, para não ter "info fantasma" de um contrato sem arquivo nenhum). Um projeto pode ter vários, cada um pode ser excluído. Arquivos em `uploads/contracts/<documentId>.<ext>` (fora do git), servidos por `src/app/api/documentos/[documentId]/route.ts`
- Dashboard: filtros por período (`dataContrato`) e produto via query string (`src/app/(app)/page.tsx` + `src/components/dashboard/filter-bar.tsx`); todas as seções (KPIs, vendas gerais, por etapa, por consultor, por coordenação) derivam do mesmo array de projetos já filtrado

## Pendências conhecidas (v1)

- Lista real de módulos e atividades padrão (levantamento com coordenações): os templates atuais são placeholders
- Prazos ideais de SLA são benchmark provisório (tabela `SlaConfig`)
- Tela de administração de templates/SLA (a de usuários já existe: convite e edição de papel)
- Export CSV, notificação via Discord
- Canais (v2)
