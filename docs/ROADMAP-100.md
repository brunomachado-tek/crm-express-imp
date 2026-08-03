# CRM Express — Roadmap para a versão 100%

> Versão provisória estável: commit `c6fba94`, tag **`provisorio-v1`**. Se algo
> quebrar na busca pela 100%, voltar com `git reset --hard provisorio-v1`.
> Produção: `crm-express-imp.netlify.app` (Netlify + Neon Postgres, pooled).
> Acesso: `bruno.machado@teknisa.com` / `teknisa123` (trocar em Configurações).

## Estado atual (provisório, funcionando)
- Deploy no ar; login, criar usuário (senha inicial teknisa123), trocar senha em
  Configurações, criar cliente por PDF (contrato + plano), cronograma agrupado por
  fase com editar/criar grupo, editar campos de atividade, feedback global (toast),
  performance com pooler, Check List de Aceite puxa contatos ao anexar no card.

## Pendências para a 100% (por prioridade)

### 1. Pipeline (adiado por limite)
- Remover **Pipeline** do menu lateral (`src/app/(app)/layout.tsx`).
- Botão **"Editar pipeline"** dentro do Funil (`funil/page.tsx`) abrindo `/pipeline`
  (só diretoria, `canEditPipeline`).
- **Salvar único**: hoje cada etapa/prazo salva sozinho (savePipelineStage/Transicao).
  Trocar por um form único com um botão **Salvar** (topo e base) que aplica todas as
  edições de nome/prazo/final de uma vez (nova action `savePipeline`, campos
  indexados por id; add/mover/apagar continuam ações imediatas via `formAction`).

### 2. Check List de Aceite — slot no wizard
- Hoje só puxa contatos ao anexar no **card** do cliente (`uploadDocument` +
  `checklist-aceite-pdf.ts`). Falta o **3º anexo opcional** no cadastro novo
  (`novo-cliente-form.tsx` + `createClientProject`), mesclando com contrato/plano.

### 3. Segurança / acesso (antes de liberar amplo)
- **Remover o reset temporário** da senha da diretoria no `seed.mjs` (hoje todo
  deploy reaplica `teknisa123` ao Bruno) — deixar a senha escolhida persistir.
- Apagar contas/dados de teste que sobraram (decidir com o Bruno o que fica).
- Restringir download de anexo por permissão (hoje qualquer logado abre por id).

### 4. Infra / entrega final
- **SMTP** (convite/redefinição por email): depende dos dados do TI da Teknisa.
- **Migração para o servidor da Teknisa** (destino final, por segurança) — o
  Netlify+Neon é temporário.
- Subdomínio próprio (`crm.teknisa.com`) via CNAME, se sair do `.netlify.app`.

### 5. Levantamento de negócio (do handoff original)
- Catálogo **Retail** (hoje placeholder; aguarda Leonardo).
- Validar split dos grupos fiscais TecFood com a Mariana.
- Prazos de SLA definitivos por etapa; categorias de justificativa de atraso.
- Revisão do questionário de repasse; se o consultor vê o valor do deal.

## Como retomar
Ler `docs/HANDOFF.md` (contexto completo) + este roadmap. Começar pela seção 1.
