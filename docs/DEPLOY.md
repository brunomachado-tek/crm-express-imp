# Deploy do CRM Express no Netlify

> Este CRM é uma aplicação full-stack (Next.js + banco + upload + login), não um
> site estático. Não sobe por drag-and-drop como a landing da TSEA. Precisa de um
> banco Postgres hospedado e de variáveis de ambiente. Este documento é o passo a
> passo. O que exige a sua conta/senhas está marcado com **[VOCÊ]**; o que é
> código já está pronto ou o Claude aplica está marcado com **[CLAUDE]**.

## Visão geral do que muda em produção

- **Banco**: local usa SQLite (arquivo). Serverless não tem disco persistente,
  então produção usa **Postgres** (Neon, plano grátis). É trocar o provider do
  Prisma e apontar `DATABASE_URL` para o Neon.
- **Anexos**: os PDFs (contrato, plano, planilha) hoje gravam em disco. Em
  produção isso some. Vão passar a ser guardados **dentro do banco** (bytes),
  porque o volume é baixo. Sem serviço de storage à parte.
- **E-mail**: sem SMTP configurado, em produção convites e redefinição de senha
  **não são enviados** e o link **nunca aparece na tela** (isso já foi blindado).
  Por isso o SMTP é obrigatório em produção.

## Pré-requisitos de segurança (antes de expor na internet)

Já resolvidos no código:
- Cookie de sessão só por HTTPS em produção.
- Link de redefinição/convite nunca aparece na tela em produção.
- Contas de demonstração (`teknisa123`) e clientes fictícios só entram com
  `SEED_DEMO=true` — em produção não se define essa variável.

Falta configurar no deploy (abaixo): `SMTP_*`, `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`.

## Passo a passo

### 1. Banco Postgres no Neon — **[VOCÊ]**
1. Criar conta em https://neon.tech (grátis, pode logar com Google).
2. Criar um projeto (região São Paulo/US East). Nome: `crm-express`.
3. Copiar a **connection string** (começa com `postgresql://...`, com
   `?sslmode=require` no fim). Guardar; será a `DATABASE_URL`.

### 2. Migração do código para Postgres — **[CLAUDE]**
Quando você tiver a `DATABASE_URL` do Neon, o Claude aplica (numa branch, com
teste no primeiro deploy):
- `schema.prisma`: provider `sqlite` → `postgresql`.
- `ProjectDocument`: passa a guardar o arquivo (bytes) no banco.
- Upload/download de anexos: gravam e leem do banco, não do disco.
- Busca de cliente: `contains` com `mode: "insensitive"` (no Postgres a busca é
  sensível a maiúsculas por padrão).
- Limite de upload alinhado ao teto das funções do Netlify (~6 MB).

### 3. Repositório no GitHub — **[VOCÊ]**
1. Criar um repositório privado (ex.: `crm-express`).
2. No terminal, dentro de `crm-express/`:
   ```bash
   git add -A && git commit -m "Deploy inicial"
   git remote add origin git@github.com:SEU_USUARIO/crm-express.git
   git push -u origin main
   ```

### 4. Netlify — **[VOCÊ]**
1. Criar conta em https://netlify.com e "Add new site" → "Import from GitHub" →
   escolher o repositório.
2. O `netlify.toml` já define o build; confirme:
   - Build command: `npm run netlify:build`
   - Publish: `.next`
3. Em **Site settings → Environment variables**, colar:
   | Variável | Valor |
   |---|---|
   | `DATABASE_URL` | a string do Neon (passo 1) |
   | `APP_URL` | a URL do site Netlify (ex.: `https://crm-express.netlify.app`) |
   | `ALLOWED_EMAIL_DOMAIN` | `teknisa.com` |
   | `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | dados do webmail Teknisa |
   | `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | gere com `openssl rand -hex 32` |
   | **não** definir `SEED_DEMO` | (deixa produção sem contas de teste) |
4. "Deploy site".

### 5. Primeiro acesso — **[VOCÊ]**
- No log do build do Netlify vai aparecer o **link de convite** da conta da
  diretoria (`bruno.machado@teknisa.com`). Abra o link, defina a senha e entre.
- A partir daí, convide o resto do time pela tela de Equipe.

## Observações
- **Teste real**: a migração de banco só é validada de verdade no primeiro
  deploy (não há Postgres no ambiente de desenvolvimento do Claude).
- **Local continua com SQLite**: o desenvolvimento e os testes do dia a dia
  seguem em SQLite; a branch de deploy é que usa Postgres.
- **Limite de arquivo**: as funções do Netlify aceitam ~6 MB por upload. PDFs
  maiores que isso vão falhar; se virar necessidade, migramos os anexos para um
  storage dedicado (Netlify Blobs).
