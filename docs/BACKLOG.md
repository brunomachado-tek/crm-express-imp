# CRM Express — Backlog e plano de execução (v2)

> Demandas levantadas com o uso do time. Divididas por dificuldade, com
> dependências e o que precisa de **decisão de negócio** antes de construir.
> Base estável: tag `provisorio-v1`. Roadmap anterior: `docs/ROADMAP-100.md`.

## Legenda
- 🟢 Fácil (rápido, baixo risco) · 🟡 Médio · 🔴 Difícil / decisão de negócio
- 🧩 depende de outra demanda · 💬 precisa levantamento antes de codar

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
