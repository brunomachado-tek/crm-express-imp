# ARCHITECTURE — CRM Express (Teknisa Small Business)

Mapa de rotas, modelo de dados, fluxos e integrações. Quando algo aqui divergir do
código, o código vence — corrija este arquivo. Especificação de produto (o "porquê"):
[`../docs/ESPECIFICACAO.md`](../docs/ESPECIFICACAO.md). Deploy: [`../docs/DEPLOY.md`](../docs/DEPLOY.md).

CRM interno de pós-venda: contrato assinado → validação comercial → alocação →
cronograma → implantação → go-live → acompanhamento → CS.

---

## Stack

- **Framework:** Next.js (App Router, Server Actions) — versão com breaking changes,
  ver [`AGENTS.md`](AGENTS.md) antes de codar
- **Linguagem:** TypeScript · **UI:** React + Tailwind CSS v4 · **Ícones:** lucide-react
- **ORM:** Prisma (`prisma db push`, **sem pasta de migrations** — schema sincronizado
  direto)
- **Banco:** SQLite em dev (`prisma/dev.db`); **Postgres (Neon) em produção** via `DATABASE_URL`
- **Email:** nodemailer (SMTP) · **Arquivos:** `unpdf` (leitura de PDF de contrato),
  `xlsx` (import/export de cronograma)
- **Hospedagem:** Netlify com `@netlify/plugin-nextjs` (Server Actions e rotas viram
  funções serverless)

> ⚠️ **Ponto de atenção:** `prisma/schema.prisma` declara `provider = "sqlite"`, mas a
> produção aponta `DATABASE_URL` para Postgres. O provider do Prisma precisa casar com
> o banco real. Validar o comportamento do `netlify:build` (`prisma db push`) contra o
> Neon — é um risco conhecido a confirmar, não um fato resolvido.

---

## Rotas (App Router)

Grupo `(app)` = área autenticada com layout comum ([`src/app/(app)/layout.tsx`](src/app/(app)/layout.tsx)).
Rotas fora do grupo = fluxos públicos de acesso.

### Autenticadas — `(app)`
| Rota | Arquivo | O que é |
|---|---|---|
| `/` | `(app)/page.tsx` | Dashboard |
| `/clientes` · `/clientes/novo` · `/clientes/[id]` | `(app)/clientes/**` | Lista, cadastro e ficha do cliente |
| `/pipeline` | `(app)/pipeline/page.tsx` | Pipeline de projetos por estágio |
| `/funil` | `(app)/funil/page.tsx` | Funil comercial |
| `/projetos/[id]` · `/projetos/[id]/repasse` | `(app)/projetos/**` | Projeto e repasse para CS |
| `/equipe` | `(app)/equipe/page.tsx` | Time, convites, papéis |
| `/alertas` | `(app)/alertas/page.tsx` | Alertas / notificações |

### Públicas / acesso
| Rota | O que é |
|---|---|
| `/login` | Email + senha |
| `/primeiro-acesso` | Fallback: conta pré-cadastrada define a própria senha |
| `/convite?token=` | Fluxo principal: convidado define senha (token 7 dias) |
| `/esqueci-senha` · `/redefinir-senha` | Reset de senha (token 1h) |
| `/repasse/[token]` | Repasse acessível por token |

### API (route handlers)
| Rota | O que é |
|---|---|
| `/api/documentos/[documentId]` | Download/serve de documento de projeto |

---

## Modelo de dados (Prisma)

Fonte da verdade: [`prisma/schema.prisma`](prisma/schema.prisma). Agrupado por domínio:

- **Identidade e acesso:** `User`, `Session`, `PasswordResetToken`, `InviteToken`
  · enums `Role` (DIRETORIA, COORDENACAO, CONSULTOR, CS), `AccessStatus`, `Seniority`
- **Comercial / cliente:** `Client`, `Contact`, `Contract`, `ContractItem`,
  `ProjectDocument`, `ClientIntake` · enums `ContractKind`, `ContractItemKind`,
  `IntakeStatus`, `ProductLine` (RETAIL, TECFOOD)
- **Templates de implantação:** `ModuleTemplate`, `ActivityTemplate`,
  `StageChecklistTemplate`, `DelayCategory` · enums `ModuloGrupo`, `Responsavel`
- **Pipeline / projeto:** `PipelineStage`, `Project`, `ProjectUnit`, `ProjectModule`,
  `ProjectActivity`, `ProjectChecklistItem`, `StageTransition`, `ProjectPause`,
  `DelayJustification`, `TimelineEntry` · enums `ProjectStatus` (ATIVO, PAUSADO,
  CANCELADO), `ActivityStatus`
- **Operação:** `Notification`, `HealthLog`

---

## Camada de domínio — `src/lib`

Toda a lógica de negócio vive aqui; as páginas chamam Server Actions.

| Módulo | Responsabilidade |
|---|---|
| `actions.ts` | **51 Server Actions** — todo o write do sistema (auth, clientes, contratos, projetos, cronograma, documentos, notificações) |
| `auth.ts` · `identity.ts` · `permissions.ts` | Sessão, identidade do usuário, regras de permissão por `Role` |
| `db.ts` | Cliente Prisma (singleton) |
| `pipeline.ts` · `sla.ts` · `metrics.ts` | Estágios do pipeline, cálculo de SLA/atraso, métricas do dashboard |
| `intake.ts` | Validação comercial / entrada do cliente |
| `contrato-pdf.ts` · `plano-pdf.ts` · `cronograma-xlsx.ts` | Geração de PDF de contrato e plano, import/export de cronograma em Excel |
| `mailer.ts` | Envio SMTP (convite, reset). Sem `SMTP_HOST` → link aparece na tela (só dev) |
| `format.ts` | Formatação (datas, moeda) |

`src/components/**` (30 componentes) organizados por domínio: `clientes/`, `funil/`,
`intake/`, `project/`, `team/`, `ui/`.

---

## Fluxos-chave

1. **Onboarding de acesso** — convite (diretoria/coordenação cria usuário → token 7d
   por email → convidado define senha) ou primeiro-acesso (fallback manual). Domínio
   aceito no autocadastro: `ALLOWED_EMAIL_DOMAIN` (`teknisa.com`).
2. **Contrato → projeto** — upload/leitura do contrato (`unpdf`) → `ClientIntake`
   (validação comercial) → `createClientProject` gera o projeto a partir dos templates.
3. **Implantação** — projeto percorre `PipelineStage`s; `moveStage`, `toggleChecklist`,
   atividades e cronograma (`importarCronograma` via `xlsx`); pausas e justificativas
   de atraso alimentam SLA.
4. **Repasse para CS** — `/projetos/[id]/repasse` e link por token `/repasse/[token]`.

---

## Deploy (resumo — detalhe em `../docs/DEPLOY.md`)

- **Build no Netlify:** `npm run netlify:build` = `prisma generate && prisma db push &&
  node prisma/seed.mjs && next build`. O seed é idempotente.
- **Env de produção (Netlify):** `DATABASE_URL` (Postgres Neon), `APP_URL`, bloco SMTP,
  `ALLOWED_EMAIL_DOMAIN`, `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` (obrigatória com múltiplas
  instâncias), e **`SEED_DEMO` vazio** (senão nasce com contas demo abertas). Ver
  [`.env.example`](.env.example).
- **Seed de produção:** `db:seed:prod` (sem `SEED_DEMO`) cria só time + templates, sem
  clientes fictícios.

---

## Convenções

- Escrita sempre por **Server Action** (`src/lib/actions.ts`), nunca fetch manual no client.
- Permissão checada por `Role` em `permissions.ts` — validar no servidor, não só na UI.
- Segredo nunca versionado: `.env` real fora do git; `.env.example` é o modelo.
- Next.js desta versão tem breaking changes: ler `node_modules/next/dist/docs/` antes
  de usar API nova (ver `AGENTS.md`).
