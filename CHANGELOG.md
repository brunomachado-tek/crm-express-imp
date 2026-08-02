# CHANGELOG — CRM Express

Uma entrada por sessão relevante, mais recente no topo. Registra o que **mudou** e o
que ficou **verificado vs. pendente** — não repete o que o `git log` já diz.

Formato: `## AAAA-MM-DD — título curto` seguido de bullets. Marcar status com o
vocabulário honesto: ✅ no ar · 🔨 construído, não entregue · 🌿 só em branch · ⏳ pendente.

---

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
