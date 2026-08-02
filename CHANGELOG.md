# CHANGELOG — CRM Express

Uma entrada por sessão relevante, mais recente no topo. Registra o que **mudou** e o
que ficou **verificado vs. pendente** — não repete o que o `git log` já diz.

Formato: `## AAAA-MM-DD — título curto` seguido de bullets. Marcar status com o
vocabulário honesto: ✅ no ar · 🔨 construído, não entregue · 🌿 só em branch · ⏳ pendente.

---

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
