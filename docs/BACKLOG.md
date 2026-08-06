# CRM Express — Backlog e plano de execução (v2)

> Demandas levantadas com o uso do time. Divididas por dificuldade, com
> dependências e o que precisa de **decisão de negócio** antes de construir.
> Base estável: tag `provisorio-v1`. Roadmap anterior: `docs/ROADMAP-100.md`.

## Legenda
- 🟢 Fácil (rápido, baixo risco) · 🟡 Médio · 🔴 Difícil / decisão de negócio
- 🧩 depende de outra demanda · 💬 precisa levantamento antes de codar

---

## ✅ Progresso — 2026-08-03

**Onda 1 — CONCLUÍDA:** (1) tag "Cliente + Teknisa"; (2) permissão de edição já
cobria consultor alocado + coordenação + diretoria; (3) drag-and-drop (alça de 3
tracinhos) para reordenar atividades; (4) editor de checklist obrigatório por
etapa no `/pipeline`.

**Onda 2 — CONCLUÍDA:** (5) página "Minhas atividades" (faixas por prioridade +
blocos por cliente) com badge no menu (atrasadas + esta semana); (6) campo de
observação por atividade; (7) anexo de fechamento por módulo no cronograma.

**Onda 3 — PARCIAL:** central de notificações já existia (`/alertas`, badge,
marcar como lido, gatilhos de acesso/novo projeto/realocação). Menção **@nome** na
observação notifica o mencionado, com **autocomplete** de nomes.
- 🔴 **PENDENTE — Notificação de "prazo apertado" (infra):** é por tempo, não por
  evento. Precisa de um **job agendado (cron)**, ex.: Netlify Scheduled Functions,
  rodando 1x/dia para olhar as atividades vencendo e criar as notificações. Não dá
  para testar local (precisa do agendador no ar), então fazer num momento dedicado.
  Hoje o badge de "Minhas atividades" já cobre isso em tempo real na interface.

**Onda 4 — EM ANDAMENTO (decisões do Bruno registradas em 2026-08-06):**

- ✅ **Comissão do consultor — FEITO** (`/comissao`): **60% da 1ª mensalidade**
  (valorMensal do LUSO), **a receber no mês seguinte à entrega** (hoje "entregue"
  = etapa final `isFinal`). Página agrupada por consultor (lista todos os projetos
  de cada um), com filtro por consultor para coordenação/diretoria; consultor vê só
  os seus. KPIs: projetada (ativos) e a receber (entregues).

- ✅ **Justificativa descontar SLA + aprovação — FEITO (2026-08-06).**
  - Consultor informa **dias** + categoria + detalhe; nasce PENDENTE e alerta a
    **coordenação do produto**. Coordenador aprova/nega no card (✓/✗), consultor nunca
    aprova a própria (`canApproveDelay`).
  - Só **aprovada** desconta, e dos **dois relógios**: SLA da etapa (`slaFor`) e marco
    contratual do treinamento (`contractMilestones`). Aplicado no dashboard, funil,
    ficha do cliente e projeto.
  - Categorias fixadas: **Pendência do cliente, Escopo adicional, Problema técnico,
    Produto** (seed reativa as 4, desativa antigas). Ranking do dashboard ignora negadas.
  - Schema: `DelayJustification.dias/status/approvedById/approvedAt` + enum `DelayStatus`.
  - 🔨 buildado, no ar no imp2. ⏳ verificação funcional do Bruno pendente.

- ⏳ **PDF de acompanhamento — depois.** Decisões:
  - Conteúdo: **nome do grupo (módulo) + todas as atividades**, **consultor que
    entregou**, **envolvidos**, **data da entrega**, **resumo da atividade**.
  - **Layout bonito**, **logo Teknisa**, dentro da identidade visual do sistema
    (usar skills de design). **1 PDF por projeto**, regerável a cada alteração
    (gera novo e envia ao cliente).

**Outros:** slot do Check List no wizard de cadastro — FEITO. "Salvar único" do
pipeline — adiado (ver `ROADMAP-100.md` seção 1).

**Deploy:** produção no **imp2** (`crm-express-imp2.netlify.app`, Netlify time pago
@yapp, repo público). Ponto de retorno estável: tag `provisorio-v1`.

---

## 🟢 Onda 1 — ganhos rápidos, baixo risco
1. **Trocar tag "Ambos" → "Cliente + Teknisa"** — só rótulo (`RESPONSAVEL_LABELS`
   + opções do select). ~trivial.
2. **Permissão do consultor editar atividades** — hoje `canManageActivities` já
   inclui o consultor alocado; confirmar o gap real e liberar. Pequeno.
3. **Reordenar atividades no cronograma** — definir onde a nova atividade entra.
   Versão simples: setas ↑/↓ por atividade gravando `ordem` (campo já existe).
4. **Checklist obrigatório por etapa (começar por "Validação comercial consultor")**
   — o sistema já tem `StageChecklistTemplate`. Popular o checklist da etapa nova.
   💬 **Padrão a firmar:** ao criar qualquer etapa, definir o checklist dela (a
   partir do nosso conhecimento do processo). Vale uma telinha de admin de
   checklist por etapa (aí vira 🟡).

## 🟡 Onda 2 — workflow do consultor (alto valor)
5. **"Minha lista de atividades"** (fila por consultor) — página nova agregando as
   atividades de todos os clientes ativos do consultor, ordenadas por prazo;
   linha = cliente · atividade · prazo; clicar abre o card. Sem schema novo
   (query por `assigneeId` + ordenação). Item de maior valor prático.
6. **Campo de observação em cada atividade** — texto aberto por atividade (novo
   campo `observacao`). 🧩 base para a menção @ (item 12).
7. **Anexo ao final de cada módulo** — documento de fechamento por módulo/grupo.
   Reusa o upload; precisa de um ponto de anexo por módulo (não por projeto).

## 🔴 Onda 3 — notificações (fundacional) e menções
8. **Central de notificações** — `Notification` já existe; falta a **tela** e os
   **gatilhos**: menção em comentário, prazo apertado, realocação em projeto,
   aprovação de novo usuário, etc. Fundacional para o item 9.
9. **Marcar usuário com @nome** em atividade/observação/comentário → notifica.
   🧩 depende de 8 (central) e 6 (campo de observação).

## 🔴 Onda 4 — regras de negócio / entregáveis pesados (precisam levantamento)
10. **Justificativa descontar do prazo + pausar SLA (cliente viajou)** 💬
    - Já existe `ProjectPause` (relógio duplo) e `DelayJustification`.
    - **A decidir:** o que pausa o relógio; **aprovação do coordenador** para o
      consultor não burlar; quais variáveis (viagem do cliente, pendência dele,
      feriado). Levantar antes de codar.
11. **Área de comissão do consultor** 💬
    - Consultor vê seus clientes ativos + comissão de cada um; coordenação/diretoria
      veem tudo com filtro por usuário.
    - **A decidir:** o **coeficiente/fórmula** do cálculo (bloqueia o build).
12. **Gerar PDF de acompanhamento para o cliente** 💬
    - Após setar atividades/datas/envolvidos, gerar um PDF bonito e organizado
      (documento oficial do passo a passo).
    - **A decidir:** conteúdo e layout do PDF. Geração server-side (peso médio-alto).

---

## Ordem sugerida
Onda 1 (1→4) primeiro: entregas rápidas que o time já sente. Depois Onda 2 (5→7),
com o **5 (minha lista)** como prioridade de valor. Onda 3 (8→9) constrói a base de
notificação. Onda 4 (10→12) exige **levantamento do Bruno** — dá para adiantar
esses levantamentos em paralelo enquanto codamos as ondas 1–3.

## Levantamentos a fazer em paralelo (não bloqueiam ondas 1–3)
- Regras de pausa de SLA + fluxo de aprovação (item 10).
- Coeficiente de comissão (item 11).
- Conteúdo/layout do PDF do cliente (item 12).
- Checklists por etapa do processo (item 4).
