# Trilha de Implantação Reduzida — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar uma segunda trilha de etapas ("Reduzida") no TecFood para o upsell de cliente existente, com fluxo de cadastro, funil, editor de pipeline e cronograma próprios.

**Architecture:** Um marcador `trilha` (enum `BASE`/`REDUZIDA`) em `PipelineStage` e `Project`. Toda leitura/edição de etapas passa a filtrar pela trilha. O cadastro ganha a escolha "É cliente / Não é cliente Teknisa" que roteia a trilha e, no upsell, pula plano e checklist e reaproveita o cliente pelo CNPJ.

**Tech Stack:** Next.js 16 (App Router, Server Actions), Prisma 6 + PostgreSQL (Neon), TypeScript strict, Tailwind v4.

## Global Constraints

- **Sem testes automatizados** neste repo. A verificação de cada task é: `npx tsc --noEmit` limpo **e** `npx next build` limpo. Verificação funcional é do Bruno na URL viva (deploy automático no push da `main`).
- **Dev local não roda** (schema é `postgresql`, `.env` local aponta pra SQLite). Não tentar `npm run dev`; validar por tsc + build.
- Se aparecerem erros em `.next/types/* 2.ts`, são duplicatas de sync: `find .next/types -name "* 2.ts" -delete` e repetir.
- Após mexer no schema: `npx prisma generate` local. O `db push` roda no build do Netlify (aditivo é seguro).
- **Nunca travessão (—) em texto de usuário.** Usar ponto, vírgula ou dois-pontos.
- **Label sempre acima do campo.** Sem botão de confirmar para campo único (auto-submit no onChange).
- Commit com `git commit -m "msg simples"` (heredoc é bloqueado). Push: `git push origin main`.
- Co-autoria nos commits: `Co-Authored-By: Claude <noreply@anthropic.com>`.

---

## File Structure

- `prisma/schema.prisma` — enum `TrilhaImplantacao`; campo `trilha` em `PipelineStage` e `Project`.
- `prisma/seed.mjs` — cria as etapas da trilha `REDUZIDA` (idempotente).
- `src/lib/pipeline.ts` — `loadStages`/`firstStage` recebem `trilha`.
- `src/lib/permissions.ts` — `canMoveStage` libera CS na trilha `REDUZIDA`.
- `src/lib/actions.ts` — `moveStage`, `createClientProject`, `gerarCronogramaProjeto` e as 5 actions de pipeline ficam trilha-aware.
- `src/app/(app)/pipeline/page.tsx` — select de trilha; CRUD escopado.
- `src/app/(app)/funil/page.tsx` — chave Base/Reduzida; filtro.
- `src/app/(app)/projetos/[id]/page.tsx` — stepper carrega etapas da trilha do projeto.
- `src/components/clientes/novo-cliente-form.tsx` — escolha "É cliente / Não é cliente".

---

## Task 1: Schema — enum e campo `trilha`

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: `enum TrilhaImplantacao { BASE REDUZIDA }`; `PipelineStage.trilha` e `Project.trilha`, ambos `TrilhaImplantacao @default(BASE)`.

- [ ] **Step 1: Adicionar o enum** perto dos outros enums de pipeline (antes de `model PipelineStage`):

```prisma
enum TrilhaImplantacao {
  BASE
  REDUZIDA
}
```

- [ ] **Step 2: Adicionar o campo em `PipelineStage`** (após `isFinal`):

```prisma
  trilha    TrilhaImplantacao @default(BASE)
```

- [ ] **Step 3: Adicionar o campo em `Project`** (após `productLine`):

```prisma
  trilha         TrilhaImplantacao @default(BASE)
```

- [ ] **Step 4: Regenerar o client e checar tipos**

Run: `npx prisma generate && npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "Schema: trilha de implantacao (BASE/REDUZIDA) em etapa e projeto"
```

---

## Task 2: Seed das etapas da trilha Reduzida

**Files:**
- Modify: `prisma/seed.mjs` (bloco de criação de `pipelineStage`, ~linha 84-104)

**Interfaces:**
- Consumes: enum `TrilhaImplantacao` (Task 1).
- Produces: 9 etapas com `trilha: "REDUZIDA"` no banco, idempotente.

Contexto: hoje o bloco cria as etapas Base só quando `pipelineStage.count() === 0`. As etapas Base existentes ganham `trilha=BASE` pelo default do db push. Adicionar um bloco análogo para a Reduzida, guardado por contagem de etapas `REDUZIDA`.

- [ ] **Step 1: Após o bloco que cria as etapas Base, adicionar:**

```javascript
  // Etapas da trilha REDUZIDA (upsell de cliente existente): as mesmas da Base,
  // com a validação comercial colapsada em "Validação comercial CS". Sem checklist.
  const reduzidas = [
    { nome: "Contrato assinado", idealDays: 3 },
    { nome: "Validação comercial CS", idealDays: 5 },
    { nome: "Alocado", idealDays: 3 },
    { nome: "Cronograma", idealDays: 7 },
    { nome: "Implantação", idealDays: 45 },
    { nome: "Go-live", idealDays: 7 },
    { nome: "Acompanhamento", idealDays: 15 },
    { nome: "Finalizado", idealDays: 5, isFinal: true },
    { nome: "CS ativo", isFinal: true },
  ];
  if ((await prisma.pipelineStage.count({ where: { trilha: "REDUZIDA" } })) === 0) {
    for (let i = 0; i < reduzidas.length; i++) {
      const s = reduzidas[i];
      await prisma.pipelineStage.create({
        data: {
          nome: s.nome,
          ordem: i,
          idealDays: s.idealDays ?? null,
          isFinal: !!s.isFinal,
          trilha: "REDUZIDA",
        },
      });
    }
  }
```

- [ ] **Step 2: Checar tipos** (o seed é `.mjs`, não entra no tsc; validar por leitura). Rodar `npx tsc --noEmit`.
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add prisma/seed.mjs
git commit -m "Seed: etapas da trilha reduzida (validacao comercial CS, sem checklist)"
```

---

## Task 3: `pipeline.ts` trilha-aware

**Files:**
- Modify: `src/lib/pipeline.ts`

**Interfaces:**
- Produces: `loadStages(trilha?: TrilhaImplantacao)` e `firstStage(trilha?: TrilhaImplantacao)`. Sem argumento, mantêm o comportamento de hoje **filtrando por `BASE`** (compatibilidade: todos os projetos/etapas atuais são BASE).

- [ ] **Step 1: Reescrever `loadStages` e `firstStage`:**

```typescript
import { db } from "./db";
import type { PipelineStage, TrilhaImplantacao } from "@prisma/client";

export async function loadStages(
  trilha: TrilhaImplantacao = "BASE"
): Promise<PipelineStage[]> {
  return db.pipelineStage.findMany({ where: { trilha }, orderBy: { ordem: "asc" } });
}

export async function firstStage(
  trilha: TrilhaImplantacao = "BASE"
): Promise<PipelineStage | null> {
  return db.pipelineStage.findFirst({ where: { trilha }, orderBy: { ordem: "asc" } });
}
```

(`stageLabel` fica igual.)

- [ ] **Step 2: Checar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros (chamadas existentes sem argumento continuam válidas).

- [ ] **Step 3: Commit**

```bash
git add src/lib/pipeline.ts
git commit -m "pipeline.ts: loadStages e firstStage por trilha (default BASE)"
```

---

## Task 4: `permissions.ts` — CS move na trilha Reduzida

**Files:**
- Modify: `src/lib/permissions.ts` (`canMoveStage`, ~linha 59)

**Interfaces:**
- Consumes: `Project.trilha`.
- Produces: `canMoveStage(user, project)` passa a aceitar `project.trilha`. Ajustar o tipo `ProjectScope` para incluir `trilha`.

- [ ] **Step 1: Incluir `trilha` no tipo de escopo** (topo do arquivo):

```typescript
type ProjectScope = Pick<Project, "consultantId" | "productLine" | "trilha">;
```

- [ ] **Step 2: Reescrever `canMoveStage`:**

```typescript
// Mover o projeto de etapa e marcar o checklist. Regra do cronograma
// (canManageActivities) MAIS o CS na trilha Reduzida: no upsell é o CS quem faz a
// "Validação comercial CS" e conduz. Cada movimentação já vira log (StageTransition).
export function canMoveStage(user: SessionUser, project: ProjectScope) {
  if (project.trilha === "REDUZIDA" && user.role === "CS") return true;
  return canManageActivities(user, project);
}
```

- [ ] **Step 3: Checar tipos**

Run: `npx tsc --noEmit`
Expected: pode acusar call sites que passam um `project` sem `trilha`. Onde acusar (ex.: funil, projeto), garantir que o objeto carrega `trilha` (o `Project` do Prisma já traz; ajustar `select`/`Pick` locais se houver). Corrigir e repetir até limpo.

- [ ] **Step 4: Commit**

```bash
git add src/lib/permissions.ts
git commit -m "permissions: CS pode mover etapa na trilha reduzida"
```

---

## Task 5: Actions trilha-aware (moveStage, cadastro, cronograma, pipeline CRUD)

**Files:**
- Modify: `src/lib/actions.ts`

**Interfaces:**
- Consumes: `loadStages`/`firstStage(trilha)` (Task 3), `canMoveStage` (Task 4).
- Produces: `createClientProject` aceita `trilha` via form; `gerarCronogramaProjeto` inalterado (moldura fixa mantida); as 5 actions de pipeline operam por trilha.

- [ ] **Step 1: `moveStage` carrega etapas da trilha do projeto.** Em `moveStage` (~1332), trocar o `db.pipelineStage.findMany({ orderBy: { ordem: "asc" } })` por uma busca dependente do projeto. Como o `project` e as `stages` são buscados em paralelo, reordenar: buscar o projeto primeiro, depois as etapas da trilha dele.

```typescript
  const project = await db.project.findUniqueOrThrow({
    where: { id: projectId },
    include: { checklist: true, client: true },
  });
  const stages = await db.pipelineStage.findMany({
    where: { trilha: project.trilha },
    orderBy: { ordem: "asc" },
  });
```

(O resto de `moveStage` fica igual: `canMoveStage` já recebe `project` com `trilha`.)

- [ ] **Step 2: `createClientProject` recebe a trilha e o modo upsell.** Logo após validar `productLine` (~1013), ler a trilha do form:

```typescript
  const ehCliente = String(formData.get("ehClienteTeknisa") ?? "") === "1";
  const trilha = ehCliente ? "REDUZIDA" : "BASE";
```

- [ ] **Step 3: No upsell, reaproveitar o cliente pelo CNPJ em vez de barrar.** Substituir o bloco do CNPJ duplicado (~1051-1054) por:

```typescript
  let clienteExistenteId: string | null = null;
  if (cnpj) {
    const jaExiste = await db.client.findUnique({ where: { cnpj } });
    if (jaExiste) {
      if (ehCliente) {
        clienteExistenteId = jaExiste.id; // upsell: novo projeto no mesmo cliente
      } else {
        redirect(`/clientes/novo?erro=cnpj-duplicado&cliente=${jaExiste.id}`);
      }
    }
  }
```

- [ ] **Step 4: No upsell, ignorar o plano de projeto.** Onde o plano é lido (~1039-1046), envolver em `if (!ehCliente)` para não processar plano no upsell:

```typescript
  const pdfPlano = ehCliente ? null : formData.get("plano");
```

(As linhas seguintes que usam `pdfPlano`/`plano` já tratam `null`/ausência.)

- [ ] **Step 5: Primeira etapa pela trilha.** Trocar `const inicial = await firstStage();` (~1081) por:

```typescript
  const inicial = await firstStage(trilha);
```

- [ ] **Step 6: Criar ou reaproveitar o cliente e gravar a trilha no projeto.** Onde cria o `client` (~1084), usar o existente quando houver:

```typescript
  const client = clienteExistenteId
    ? await db.client.findUniqueOrThrow({ where: { id: clienteExistenteId } })
    : await db.client.create({ data: { /* ...campos como hoje... */ } });
```

E no `db.project.create` (~1100), adicionar `trilha` ao `data`:

```typescript
      trilha,
```

- [ ] **Step 7: Não instanciar checklist no upsell.** Trocar `await instantiateChecklist(project.id, inicial.id);` (~1238) por:

```typescript
  if (!ehCliente) await instantiateChecklist(project.id, inicial.id);
```

(`gerarCronogramaProjeto` continua sendo chamado igual: mantém a moldura fixa, incluindo Reunião de Abertura, conforme a decisão.)

- [ ] **Step 8: Pipeline CRUD por trilha.** Nas 5 actions (`addPipelineStage`, `savePipelineStage`, `savePipelineTransicao`, `movePipelineStage`, `deletePipelineStage`), ler a trilha do form e escopar. Em cada uma, no topo (após a checagem de permissão):

```typescript
  const trilhaRaw = String(formData.get("trilha") ?? "BASE");
  const trilha = trilhaRaw === "REDUZIDA" ? "REDUZIDA" : "BASE";
```

Trocar todo `db.pipelineStage.findMany({ orderBy: { ordem: "asc" } })` dentro dessas actions por:

```typescript
  const stages = await db.pipelineStage.findMany({
    where: { trilha },
    orderBy: { ordem: "asc" },
  });
```

Em `addPipelineStage`, o `create` recebe `trilha`:

```typescript
    await tx.pipelineStage.create({ data: { nome, ordem: pos, trilha } });
```

Em `deletePipelineStage`, a realocação de projetos (`updateMany where stageId`) e a renumeração já ficam corretas porque só operam sobre `stages` da trilha; ao renumerar, filtrar por trilha:

```typescript
    const restantes = await tx.pipelineStage.findMany({
      where: { trilha },
      orderBy: { ordem: "asc" },
    });
```

Nos `redirect` finais dessas actions, preservar a trilha: `redirect(\`/pipeline?trilha=${trilha}&ok=...\`)`.

- [ ] **Step 9: Checar tipos e build**

Run: `find .next/types -name "* 2.ts" -delete; npx tsc --noEmit && npx next build`
Expected: ambos limpos.

- [ ] **Step 10: Commit**

```bash
git add src/lib/actions.ts
git commit -m "actions: trilha-aware (moveStage, cadastro upsell, pipeline CRUD por trilha)"
```

---

## Task 6: Editor `/pipeline` com select de trilha

**Files:**
- Modify: `src/app/(app)/pipeline/page.tsx`

**Interfaces:**
- Consumes: `loadStages(trilha)` (Task 3); as pipeline actions esperam um campo `trilha` no form (Task 5).

- [ ] **Step 1: Ler a trilha da URL** (`searchParams`) e carregar as etapas dela. O componente recebe `searchParams`; extrair `trilha` (`"REDUZIDA"` ou default `"BASE"`), e chamar `loadStages(trilha)`.

- [ ] **Step 2: Adicionar o select no topo da página**, dois links/abas que trocam `?trilha=BASE` e `?trilha=REDUZIDA` (padrão da chave TecFood/Retail do funil). Rótulos: "Base" e "Reduzida".

- [ ] **Step 3: Propagar a trilha para todas as actions.** Em cada `<form action={...}>` de etapa/transição, incluir `<input type="hidden" name="trilha" value={trilha} />`.

- [ ] **Step 4: Checar tipos e build**

Run: `find .next/types -name "* 2.ts" -delete; npx tsc --noEmit && npx next build`
Expected: limpos.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/pipeline/page.tsx"
git commit -m "pipeline: select de trilha (Base/Reduzida) no editor"
```

---

## Task 7: Funil com chave Base/Reduzida

**Files:**
- Modify: `src/app/(app)/funil/page.tsx`

**Interfaces:**
- Consumes: `loadStages(trilha)` (Task 3); `Project.trilha`.

- [ ] **Step 1: Ler `trilha` do `searchParams`** (default `"BASE"`), junto do `funil` (produto) que já existe.

- [ ] **Step 2: Filtrar projetos e etapas pela trilha.** Na query de `project.findMany`, adicionar `trilha` ao `where`. Trocar `loadStages()` por `loadStages(trilha)`.

- [ ] **Step 3: Adicionar a chave Base/Reduzida** ao lado da chave de produto existente, trocando `?trilha=`. Mostrar só no TecFood (o Retail segue só Base) ou sempre, à escolha do layout; manter simples: sempre visível, links que preservam o `funil` atual.

- [ ] **Step 4: Checar tipos e build**

Run: `find .next/types -name "* 2.ts" -delete; npx tsc --noEmit && npx next build`
Expected: limpos.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/funil/page.tsx"
git commit -m "funil: chave Base/Reduzida por trilha"
```

---

## Task 8: Stepper do projeto na trilha certa

**Files:**
- Modify: `src/app/(app)/projetos/[id]/page.tsx` (~linha 92, `const stages = await loadStages();`)

**Interfaces:**
- Consumes: `loadStages(trilha)`; `project.trilha` (já carregado na query do projeto).

- [ ] **Step 1: Carregar as etapas da trilha do projeto.** O `project` já é buscado antes. Trocar:

```typescript
  const stages = await loadStages(project.trilha);
```

- [ ] **Step 2: Checar tipos e build**

Run: `find .next/types -name "* 2.ts" -delete; npx tsc --noEmit && npx next build`
Expected: limpos. Conferir que o stepper e o "mover etapa" usam esse `stages` (da trilha), não uma lista global.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/projetos/[id]/page.tsx"
git commit -m "projeto: stepper carrega etapas da trilha do projeto"
```

---

## Task 9: Escolha "É cliente / Não é cliente" no cadastro

**Files:**
- Modify: `src/components/clientes/novo-cliente-form.tsx`
- Modify (se necessário): `src/app/(app)/clientes/novo/page.tsx`

**Interfaces:**
- Produces: campo de form `ehClienteTeknisa` (`"1"` para upsell) consumido por `createClientProject` (Task 5).

- [ ] **Step 1: Primeiro passo de escolha.** Antes do upload do contrato, apresentar duas opções (label acima, dois botões/cards): **"Não é cliente Teknisa"** e **"É cliente Teknisa"**. Guardar a escolha em estado (`useState`). Enquanto não escolher, não mostrar o resto do formulário.

- [ ] **Step 2: Enviar a escolha.** Incluir `<input type="hidden" name="ehClienteTeknisa" value={ehCliente ? "1" : "0"} />` no form que chama `createClientProject`.

- [ ] **Step 3: No modo "É cliente", esconder plano e checklist.** Ocultar os campos de upload de **plano de projeto** e de **checklist** quando `ehCliente` for verdadeiro (no upsell só o contrato). O contrato continua obrigatório. Ajustar o texto de topo para deixar claro que é implantação de módulo novo (trilha reduzida), sem travessão.

- [ ] **Step 4: Checar tipos e build**

Run: `find .next/types -name "* 2.ts" -delete; npx tsc --noEmit && npx next build`
Expected: limpos.

- [ ] **Step 5: Commit**

```bash
git add "src/components/clientes/novo-cliente-form.tsx" "src/app/(app)/clientes/novo/page.tsx"
git commit -m "cadastro: escolha E cliente / Nao e cliente Teknisa (roteia trilha reduzida)"
```

---

## Task 10: Push, deploy e verificação funcional

**Files:** nenhum (entrega).

- [ ] **Step 1: Build final limpo**

Run: `find .next/types -name "* 2.ts" -delete; npx tsc --noEmit && npx next build`
Expected: limpos.

- [ ] **Step 2: Push** (deploy automático no imp2; o `db push` do build aplica `trilha` e o seed cria as etapas Reduzida)

```bash
git push origin main
```

- [ ] **Step 3: Verificação funcional (Bruno, na URL viva imp2):**
  - `/pipeline` mostra o select Base/Reduzida; a Reduzida tem "Validação comercial CS" e não tem a validação do coordenador.
  - "Novo cliente" mostra a escolha; "É cliente Teknisa" pede só o contrato, cria o cadastro (ou reaproveita pelo CNPJ) e cai na trilha Reduzida.
  - O projeto de upsell tem cronograma (com Reunião de Abertura) e o stepper das etapas reduzidas.
  - Um usuário CS consegue mover a etapa num projeto da trilha Reduzida, e a movimentação aparece na timeline do projeto.
  - Funil do TecFood alterna Base/Reduzida.

---

## Self-Review (feito na escrita)

- **Cobertura do spec:** modelo (T1), etapas Reduzida (T2), pipeline.ts (T3), permissão CS (T4), moveStage + cadastro + cronograma + pipeline CRUD (T5), editor (T6), funil (T7), stepper (T8), escolha no cadastro (T9), deploy/verificação (T10). Todas as seções do spec têm task.
- **Placeholders:** nenhum passo com "TBD"; código real onde a mudança é curta, e localização exata (arquivo:linha) onde a mudança é dentro de função longa.
- **Consistência de tipos:** `trilha: TrilhaImplantacao` em `PipelineStage`/`Project`; `loadStages`/`firstStage` com o mesmo parâmetro; `ProjectScope` de `permissions.ts` inclui `trilha`; campo de form `ehClienteTeknisa` produzido em T9 e consumido em T5; campo `trilha` produzido em T6 e consumido em T5.
