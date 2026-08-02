# CRM Express — Especificação v1

> Sistema interno da Diretoria de Small Business (Teknisa) para gestão pós-venda:
> contrato → validação comercial → alocação → cronograma → implantação → go-live → CS.
> Mantido por Bruno Machado + Claude. Não substitui o CRM de prospecção/vendas (interno de outra diretoria).

## Decisões confirmadas (Bruno, 2026-07-17)

| Tema | Decisão |
|---|---|
| Escopo v1 | Somente **Express** (Retail + TecFood). Canais entra depois (v2, com pipeline de revendedores). |
| Pipelines | Dois funis (Retail / TecFood), separados por cor/tag/filtro. Coordenador enxerga o outro funil (troca de funil), permissões por produto. |
| Entrada de dados | Manual pelos coordenadores (Mariana/TecFood, Leonardo/Retail). Integração com contratos é futura. |
| Cliente | 1 card por cliente, com desdobramento de projetos dentro dele. Busca por razão social e nº da proposta. Aditivos (novos módulos) entram no cliente existente com destaque visual. |
| Projeto multi-loja | 1 projeto com desdobramento em unidades (ex.: 12 lojas). |
| Etapas do funil (proposta inicial, a validar com o time) | Contrato assinado → Validação com o comercial → Alocado a consultor → Cronograma em definição → Implantação em andamento → Go-live → Acompanhamento → Finalizado → CS ativo |
| Sub-fases da implantação | Checklist dentro do card (tarefas agendadas, data final, responsável), não colunas. |
| Movimentação | Qualquer um move o card, desde que o checklist da etapa esteja completo. |
| Projetos | Podem ser pausados, cancelados e apagados — tudo vira indicador. |
| SLA | Prazo ideal por etapa (benchmark a definir — começa vazio/configurável). Dias corridos. Medir tempo total **e** tempo sob controle Teknisa (pausas por pendência do cliente param o 2º relógio). |
| Atraso | Justificativa com **categoria fechada** (configurável, começa genérica) + campo aberto de detalhe. Preenchida pelo consultor. Não bloqueia movimentação. |
| Notificações | In-app primeiro; Discord (webhook) depois. |
| Alocação | Coordenação decide por nº de projetos + senioridade. Capacidade: 1 pouco / 2 ideal / 3 muito. Férias/afastamento mapeados; tarefas podem ser repassadas a outro consultor e devolvidas. |
| Atividades padrão | Modulares por módulo contratado, somam-se; deduplicação de atividades comuns (cadastros iniciais etc.). Consultor pode adicionar/remover/editar no projeto. Template tem: título, descrição (1 parágrafo), horas, nº de reuniões, dependências, pautas, envolvidos esperados do cliente (por papel — ex.: nutricionista ou dono). **Lista real de módulos/atividades: pendente de levantamento com coordenações.** |
| Cronograma | Interno, com export bonito para enviar ao cliente. Reuniões agendadas com o cliente (geralmente 2×/semana). Sem integração de calendário. |
| CS | Ao finalizar: reunião de handoff + checklist genérico de marcos + repasse de contato para CS (Lorena/Retail, Jussara/TecFood). CS levemente proativo: alertas, dicas, health check/score simples. |
| Perfis | Diretoria (tudo), Coordenação (microgestão do seu funil + acesso ao outro), Consultor (seus projetos/tarefas), CS. Comercial e Contratos ficam fora da v1. ~15 usuários. |
| Valor do deal no card | A confirmar com coordenação (por ora: visível para diretoria/coordenação, oculto para consultor — configurável). |
| Dashboard diretoria | Projetos em andamento, concluídos, alertas de atraso, projetos por etapa, consultores com mais tarefas, consultores com mais atrasos; filtros por data/pessoa/etapa. |
| Export | CSV/Excel. Sem integração BI — o CRM é o dash. |
| Plataforma | Web interna, minimamente responsiva. Login próprio (email/senha) — empresa usa webmail interno, sem SSO. |
| Infra | Indefinida (TI burocrático). Stack portátil: roda em qualquer lugar (container/node + banco SQL). |
| Prazo | ~1 mês para versão redonda. |
| Migração | Projetos em andamento entram como histórico (cadastro retroativo) — cliente nunca é recadastrado. |

## Análise dos contratos (modelo TecFood Express)

Cada venda gera um **pacote de 2 contratos vinculados** com o mesmo número-raiz:

- `SAAS-AAAAMM<proposta>-<seq>` — Gestão de Infraestrutura em Nuvem (ex.: SAAS-202604037472-01)
- `LUSO-AAAAMM<proposta>-<seq>` — Licenciamento e Manutenção de Software

O número-raiz embute ano/mês + **nº da proposta** (ex.: 202604037472 → 2026-04, proposta 037472) → chave de busca.

### Campos estruturados a extrair para o card

**Do cabeçalho/partes:**
- Razão social, CNPJ, endereço completo (cidade/UF)
- Contato Teknisa (vendedor/qualificador — ex.: "Ana Paula Freitas Therezo")
- Nº contrato SAAS, nº contrato LUSO, nº proposta, data de assinatura
- Signatários do cliente + emails (vêm do protocolo Certisign — viram contatos do cliente)

**Da cláusula PREÇOS (LUSO):**
- Soluções de serviço contratadas (= módulos), cada uma com: tipo de medida (ex.: Filial TecFood), qtde mínima, valor unitário, desconto, total
  - Ex. contrato 1: Teknisa TecFood (R$2.000) + APP TecFood MyMenu (R$300) → Licença R$2.300, Manutenção R$497/mês
  - Ex. contrato 2: Teknisa TecFood (R$1.000) → Manutenção R$325/mês
- Valor total de Licença de Uso (one-time) e Manutenção (mensal)

**Da cláusula SERVIÇO (LUSO) — marcos contratuais que alimentam o SLA:**
- Treinamento: **24h** em até **2 meses** da assinatura
- EAD + Acompanhamento Remoto + Webinar: **2 meses** de acesso a partir da assinatura
- **6 meses** sem conclusão do projeto → cliente paga Taxa de Administração R$500/mês (alerta crítico!)
- Condição de treinamento: EAD concluído com ≥70% de aproveitamento (dever de casa do cliente)
- Go-live na data do cronograma é contrapartida de desconto (contrato 2)

**Do SAAS:**
- Vigência 24 meses, renovação automática 12
- Limite base de dados (30.000 Mb) — relevante para CS/upsell futuro

**Anexo I (LUSO):** lista completa de funcionalidades por módulo — insumo para o futuro cadastro de módulos/atividades.

### Alertas derivados do contrato (automáticos)
1. 45 dias da assinatura sem treinamento concluído → alerta (prazo contratual 2 meses)
2. 5 meses da assinatura sem projeto concluído → alerta crítico (taxa de R$500 em 30 dias)
3. Prazos ideais por etapa (configuráveis) → alerta de atraso + justificativa categorizada

## Pendências de levantamento (Bruno)
1. **Lista de módulos + atividades padrão** por produto (Retail e TecFood) — com coordenações. ← trava o motor de cronograma
2. Prazos ideais por etapa (benchmark SLA)
3. Categorias de justificativa de atraso definitivas
4. Valor do deal visível para consultor? (com coordenação)
5. Restrições de infra do TI da Teknisa
6. Etapas definitivas do funil (validar proposta com o time)
7. Modelo de contrato **Retail Express** (só temos TecFood) — conferir se os campos batem

## Stack (v1)
- Next.js (App Router) + TypeScript + Tailwind — app web único
- Prisma + SQLite em dev; troca por Postgres via env quando a infra for definida (schema compatível)
- Auth própria: email + senha (hash), sessão via cookie; papéis: DIRETORIA, COORDENACAO, CONSULTOR, CS
- Upload do PDF do contrato anexado ao card (filesystem em dev; storage configurável)
