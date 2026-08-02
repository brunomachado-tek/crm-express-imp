# Checklist de deploy — decisões e passo a passo

> Companheiro do `docs/DEPLOY.md` (que tem o detalhe técnico). Este aqui é a
> **lista de ação**: primeiro as decisões de conta que só o Bruno toma, depois o
> passo a passo marcável. Legenda: **[VOCÊ]** = Bruno faz - **[CLAUDE]** = eu faço.
>
> **Regra de segurança (importante):** senha, connection string do banco e a
> chave de criptografia **vão coladas direto no painel do Netlify**, nunca aqui no
> chat. Nenhum segredo precisa passar por mim. O que eu preciso de você é só coisa
> não secreta: a URL do repositório e a confirmação de que colou as variáveis.

---

## Parte 0 — Decisões de conta (DEFINIDAS em 2026-08-02)

| Serviço | Decisão | Escolha do Bruno |
|---|---|---|
| **GitHub** | Onde fica o código (repo **privado**). | ✅ Criar/usar conta com **e-mail Teknisa**. |
| **Neon** (Postgres) | Login para criar o banco. | ✅ **Criar conta Teknisa** nova. |
| **Netlify** | Conta de hospedagem. | ✅ **A mesma da TSEA** (a que já hospeda a landing). |
| **Domínio** | Endereço público. | ✅ Nome do site Netlify **`crm-express-teknisa`** → endereço `crm-express-teknisa.netlify.app`. Subdomínio próprio (`.teknisa.com`) fica para depois, precisa do DNS com o TI. |
| **SMTP (e-mail)** | Envio de convite / redefinição. | ⏳ **Ainda não tem os dados** do TI. Sobe sem SMTP por ora. |

> **Consequência de subir sem SMTP:** em produção o link de convite/redefinição
> **não é enviado nem aparece na tela** (blindagem de segurança). Você mesmo
> **consegue entrar**, porque o link da conta da diretoria sai no **log do build**
> (Parte 5). Mas **não dá para convidar o time real pela tela de Equipe** enquanto
> o SMTP não estiver configurado. Ou seja: sobe agora para testar sozinho, e o
> convite do time fica travado até você conseguir os dados de SMTP com o TI.

---

## Parte 1 — GitHub (rede de segurança online) — **[VOCÊ]** + **[CLAUDE]**

Hoje o código está commitado **só na sua máquina** (3 commits, sem `git remote`).
Subir para o GitHub é a primeira rede de segurança de verdade.

- [ ] **[VOCÊ]** Criar o repositório **privado** no GitHub. Sugestão de nome: `crm-express`.
      Não marque "add README/gitignore" (o projeto já tem os seus).
- [ ] **[VOCÊ]** Me mandar aqui no chat **a URL do repo** (ex.:
      `https://github.com/seu-usuario/crm-express`). Isso não é segredo.
- [ ] **[CLAUDE]** Eu configuro o `git remote` e faço o **primeiro push** da `main`
      (com seu ok antes de empurrar). A partir daí o código está no GitHub.

---

## Parte 2 — Banco Postgres no Neon — **[VOCÊ]**

- [ ] Criar conta em **https://neon.tech** (plano grátis serve).
- [ ] Criar um projeto chamado `crm-express`, região mais perto do Brasil
      (US East ou São Paulo, se aparecer).
- [ ] Copiar a **connection string** (começa com `postgresql://...` e termina com
      `?sslmode=require`). **Guarde num lugar seguro. Não cole aqui.** Ela vai
      direto no Netlify no passo 4.

---

## Parte 3 — Migração do código para Postgres — **[CLAUDE]**

Assim que o repo estiver no GitHub (Parte 1), eu faço, **numa branch separada**:

- [ ] **[CLAUDE]** Trocar o banco de SQLite para PostgreSQL no `schema.prisma`.
- [ ] **[CLAUDE]** Fazer os anexos (PDFs) serem guardados **dentro do banco**, já
      que o Netlify não tem disco que persista.
- [ ] **[CLAUDE]** Ajustar a busca de cliente para não diferenciar maiúsculas
      (o Postgres diferencia por padrão) e alinhar o limite de upload (~6 MB).

Isto só é validado de verdade no primeiro deploy (não tenho Postgres aqui para
testar antes). O seu ambiente local **continua em SQLite**, sem mudança no dia a dia.

---

## Parte 4 — Netlify (colocar no ar) — **[VOCÊ]**

- [ ] Entrar em **https://netlify.com** (conta que você decidiu na Parte 0).
- [ ] **"Add new site" → "Import an existing project" → GitHub** → escolher o repo `crm-express`.
- [ ] Conferir o build (o `netlify.toml` já preenche): build `npm run netlify:build`, publish `.next`.
- [ ] Em **Site settings → Environment variables**, colar (aqui, não no chat):

| Variável | O que pôr |
|---|---|
| `DATABASE_URL` | a connection string do Neon (Parte 2) |
| `APP_URL` | `https://crm-express-teknisa.netlify.app` |
| `ALLOWED_EMAIL_DOMAIN` | `teknisa.com` |
| `SMTP_HOST` `SMTP_PORT` `SMTP_USER` `SMTP_PASS` `SMTP_FROM` | ⏳ **pular por enquanto** (sem dados do TI). Deixar de fora até ter o SMTP. |
| `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | uma chave fixa; gere no terminal com o comando abaixo |
| `SEED_DEMO` | **não criar** essa variável (é o que mantém produção sem as contas de teste) |

> Na criação do site, o Netlify pede o nome: digite **`crm-express-teknisa`** para
> o endereço sair como `crm-express-teknisa.netlify.app` (o mesmo que já pôs no `APP_URL`).

Para gerar a chave de criptografia (rode no seu terminal e cole o resultado no Netlify):

```bash
openssl rand -hex 32
```

- [ ] Clicar **"Deploy site"**.
- [ ] **[VOCÊ]** Me avisar quando o deploy terminar (e se der erro, me manda o log do build).

---

## Parte 5 — Primeiro acesso — **[VOCÊ]**

- [ ] No **log do build do Netlify**, procurar o **link de convite** da conta
      `bruno.machado@teknisa.com` (o seed imprime ele lá).
- [ ] Abrir o link, definir sua senha e entrar.
- [ ] Convidar o resto do time pela tela **Equipe**.

---

## O que ainda fica pendente depois de no ar

- Apagar as contas de demonstração (`teknisa123`) antes de liberar para a equipe real.
- Configurar o subdomínio Teknisa (CNAME) se decidir sair do `.netlify.app`.
- Confirmar o SMTP funcionando com um convite de teste **para você mesmo** primeiro.

---

## Resumo de quem faz o quê

1. **[VOCÊ]** decide as contas (Parte 0), cria GitHub + Neon + Netlify, cola as variáveis.
2. **[VOCÊ]** me manda: a URL do repo (Parte 1) e o aviso de deploy pronto (Parte 4).
3. **[CLAUDE]** faço o push inicial e a migração SQLite→Postgres, e verifico o
   primeiro deploy end-to-end (login, cadastro por PDF, upload de anexo).
