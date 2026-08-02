# CHANGELOG — CRM Express

Uma entrada por sessão relevante, mais recente no topo. Registra o que **mudou** e o
que ficou **verificado vs. pendente** — não repete o que o `git log` já diz.

Formato: `## AAAA-MM-DD — título curto` seguido de bullets. Marcar status com o
vocabulário honesto: ✅ no ar · 🔨 construído, não entregue · 🌿 só em branch · ⏳ pendente.

---

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
