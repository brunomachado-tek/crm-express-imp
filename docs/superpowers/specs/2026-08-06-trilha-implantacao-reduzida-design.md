# Design: trilha de implantação reduzida (upsell de cliente existente)

> Spec de design. Data: 2026-08-06. Aprovado pelo Bruno em conversa de brainstorming.
> Próximo passo depois da revisão: plano de implementação (writing-plans).

## Contexto e objetivo

Clientes ativos podem contratar um **novo módulo** e passar por uma **nova
implantação, mais curta** que a de um cliente novo. Hoje o CRM tem um único fluxo
de implantação (uma pipeline de etapas). Precisamos de uma **bifurcação**: além da
implantação padrão (trilha **Base**, cliente novo), uma implantação de **upsell**
(trilha **Reduzida**, módulo novo de quem já é cliente Teknisa).

Escopo inicial: **TecFood**. O modelo é genérico (trilha independe de produto), mas
a trilha Reduzida nasce só no TecFood. Retail segue como está (trilha Base).

## Decisões travadas

1. **Cliente do upsell**: reaproveita o mesmo cadastro (`Client`) quando o CNPJ já
   existe no CRM; cria um **novo projeto** (`Project`) ligado a ele. Encaixa no
   conceito de aditivo que o sistema já tem (`ProjectModule.isAditivo`,
   `ContractKind.ADITIVO`).
2. **A empresa pode ser cliente Teknisa e não estar neste CRM.** Por isso o caminho
   "É cliente Teknisa" cria o **cadastro completo** a partir do contrato quando o
   CNPJ ainda não existe; se existir, reaproveita.
3. **No upsell não há plano de projeto nem checklist.** Só o contrato.
4. **Etapas da trilha Reduzida** = as mesmas da Base, com duas mudanças:
   - remover a etapa de **Validação comercial do coordenador**;
   - renomear a **Validação comercial do consultor** para **Validação comercial CS**.
   Na prática, a trilha Reduzida colapsa a validação comercial numa única etapa
   "Validação comercial CS". O resto das etapas é igual à Base.
5. **O upsell passa por nova Reunião de Abertura** (o módulo novo pode ter sido
   contratado anos depois). A moldura fixa do cronograma (FIXO: Reunião de Abertura,
   Cadastros Iniciais, Encerramento) é mantida.

## Modelo de dados

Enum novo e um campo em duas tabelas. Mudança **aditiva** (segura no `db push`).

```prisma
enum TrilhaImplantacao {
  BASE
  REDUZIDA
}
```

- `PipelineStage.trilha  TrilhaImplantacao @default(BASE)`
- `Project.trilha        TrilhaImplantacao @default(BASE)`

Projetos e etapas existentes ficam em `BASE` pelo default. As etapas `REDUZIDA` são
novas (ver "Seed"). A unicidade/ordem das etapas passa a ser **por trilha**: a
`ordem` é interpretada dentro da trilha.

## Etapas da trilha Reduzida (definitivas)

São as mesmas da Base, com a validação comercial colapsada em "Validação comercial
CS" (remove a validação do coordenador, renomeia a do consultor para CS):

1. Contrato assinado
2. **Validação comercial CS**
3. Alocado
4. Cronograma
5. Implantação
6. Go-live
7. Acompanhamento
8. Finalizado (final)
9. CS ativo (final)

Sem `StageChecklistTemplate` para nenhuma etapa da trilha Reduzida. A diretoria ainda
pode ajustar pelo editor `/pipeline` (ver abaixo), mas este é o conjunto de partida.

> **Permissão do CS (decisão):** na trilha Reduzida o papel **CS pode mover etapas**
> (é ele quem faz a "Validação comercial CS" e conduz o upsell). Cada movimentação já
> gera **log automático** no registro do projeto: `moveStage` grava um
> `StageTransition` com autor e data, exibido na timeline do projeto. Implementação:
> `canMoveStage` passa a permitir CS quando `project.trilha === REDUZIDA`. Na trilha
> **Base**, o CS segue sem mover etapas (perfil de leitura, como hoje).

## Fluxo do "Novo cliente"

O botão "Novo cliente" ganha uma **escolha inicial** antes do upload do contrato:

- **Não é cliente Teknisa** → trilha **Base**. Fluxo de hoje inalterado: contrato +
  plano de projeto opcional + checklist por etapa.
- **É cliente Teknisa** → trilha **Reduzida**. Pede **só o contrato**. Lê o contrato
  como hoje e:
  - se o **CNPJ já existe** no CRM, reaproveita o `Client` e cria um novo `Project`
    ligado a ele;
  - se **não existe**, cria o cadastro completo do cliente a partir do contrato.
  - **Não** oferece etapa de plano de projeto. **Não** instancia checklist.
  - O novo projeto nasce com `trilha = REDUZIDA` e na **primeira etapa da trilha
    Reduzida**.

## Cronograma do upsell

Reutiliza o gerador atual (`gerarCronogramaProjeto`): instancia as atividades dos
**módulos contratados** (os novos) **mais a moldura fixa** (Reunião de Abertura,
Cadastros Iniciais, Encerramento), na ordem do catálogo, sem repetir atividade
compartilhada (`dedupKey`). Não há leitura de plano de projeto (não existe no
upsell). O contrato do upsell é um contrato novo/aditivo, lido como hoje.

## Editor de pipeline (`/pipeline`, diretoria)

Ganha um **select de trilha (Base / Reduzida)** no topo. Todo o CRUD de etapas
(criar, renomear, reordenar, prazo, marcar final, apagar, e checklist) passa a
operar **dentro da trilha selecionada**. Ao apagar uma etapa, os projetos daquela
etapa vão para a etapa vizinha **da mesma trilha**.

## Funil (`/funil`, TecFood)

Ganha uma **chave Base / Reduzida**, no mesmo padrão da chave TecFood/Retail já
existente. O quadro kanban mostra as colunas (etapas) e os cards (projetos) da
trilha selecionada. Como as etapas diferem entre trilhas, os dois conjuntos não se
misturam no mesmo quadro.

## Áreas afetadas (para o plano)

- `prisma/schema.prisma`: enum `TrilhaImplantacao` + campo `trilha` em
  `PipelineStage` e `Project`.
- `prisma/seed.mjs`: criar as etapas da trilha Reduzida (idempotente).
- `src/lib/pipeline.ts`: `loadStages`/`firstStage` passam a receber/filtrar por
  trilha.
- `src/app/(app)/funil/page.tsx`: chave de trilha + filtro das etapas e projetos.
- `src/app/(app)/pipeline/*`: select de trilha; CRUD escopado por trilha.
- `src/app/(app)/clientes/novo/*` (+ actions de cadastro): escolha "É cliente /
  Não é cliente"; roteamento de trilha; pular plano e checklist no upsell; definir
  `Project.trilha` e a primeira etapa da trilha.
- `src/lib/actions.ts`: `createClientProject`/`gerarCronogramaProjeto` cientes da
  trilha; não instanciar checklist na Reduzida; primeira etapa pela trilha.
- Página do projeto (stepper), `moveStage` e checklist: carregar/mover etapas da
  **trilha do projeto**; sem checklist na Reduzida.
- `src/lib/permissions.ts`: `canMoveStage` permite o papel **CS** quando
  `project.trilha === REDUZIDA` (segue negando na Base).

## Migração e compatibilidade

- Mudança aditiva: projetos e etapas atuais ficam em `BASE` pelo default; nada quebra.
- As etapas `REDUZIDA` são criadas pelo seed no próximo deploy (idempotente).
- Sem impacto em métricas/SLA: `slaFor`, `contractMilestones` e o dashboard não
  dependem da trilha; continuam olhando a etapa atual do projeto.

## Fora de escopo

- Trilha Reduzida para Retail (Retail ainda é placeholder).
- Qualquer alteração no fluxo de plano de projeto/checklist da trilha Base.
