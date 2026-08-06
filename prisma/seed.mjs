// Seed inicial: time real da Express, templates provisórios (a validar com coordenações)
// e 2 clientes de demonstração extraídos dos contratos-modelo TecFood Express.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const hash = bcrypt.hashSync("teknisa123", 10);

async function main() {
  // Dados de demonstração (contas com senha pública teknisa123 e clientes de
  // exemplo) só entram quando SEED_DEMO=true. Em produção NUNCA rodar com essa
  // flag: senão o sistema nasce com contas que qualquer um acessa. O que é real
  // (conta da diretoria, pipeline, categorias, catálogo de módulos) entra sempre.
  const SEED_DEMO = process.env.SEED_DEMO === "true";

  // ── Usuários de demonstração (só com SEED_DEMO) ────────────
  const users = [
    { name: "Bruno Machado", email: "bruno@teknisa.com", role: "DIRETORIA" },
    { name: "Leandro Assis", email: "leandro@teknisa.com", role: "DIRETORIA" },
    { name: "Mariana", email: "mariana@teknisa.com", role: "COORDENACAO", productLine: "TECFOOD" },
    { name: "Leonardo", email: "leonardo@teknisa.com", role: "COORDENACAO", productLine: "RETAIL" },
    { name: "Marciana", email: "marciana@teknisa.com", role: "CONSULTOR", productLine: "TECFOOD", seniority: "SENIOR" },
    { name: "Patrícia Ávila", email: "patricia@teknisa.com", role: "CONSULTOR", productLine: "TECFOOD", seniority: "PLENO" },
    { name: "Caroline Oliveira", email: "caroline@teknisa.com", role: "CONSULTOR", productLine: "TECFOOD", seniority: "PLENO" },
    { name: "Lara Cezar", email: "lara@teknisa.com", role: "CONSULTOR", productLine: "TECFOOD", seniority: "JUNIOR" },
    { name: "Jussara", email: "jussara@teknisa.com", role: "CS", productLine: "TECFOOD" },
    { name: "Lorena", email: "lorena@teknisa.com", role: "CS", productLine: "RETAIL" },
  ];
  const u = {};
  if (SEED_DEMO) {
    for (const data of users) {
      u[data.name] = await prisma.user.upsert({
        where: { email: data.email },
        update: {},
        create: { ...data, passwordHash: hash },
      });
    }
  }

  // Conta real da diretoria: sempre nasce (e é mantida) com a senha genérica
  // `teknisa123`, para o acesso do dono do sistema nunca ficar preso a um
  // convite. Bruno entra com ela e troca em Configurações. (Temporário: enquanto
  // há redeploys frequentes, cada deploy reaplica essa senha; remover quando o
  // sistema estabilizar / migrar para o servidor da Teknisa.)
  await prisma.user.upsert({
    where: { email: "bruno.machado@teknisa.com" },
    update: { passwordHash: hash, status: "APROVADO", active: true },
    create: {
      name: "Bruno Machado",
      email: "bruno.machado@teknisa.com",
      role: "DIRETORIA",
      status: "APROVADO",
      passwordHash: hash,
    },
  });
  console.log("Conta da diretoria (bruno.machado@teknisa.com) com senha inicial: teknisa123");

  // ── Categorias de justificativa de atraso (decisão do Bruno, 2026-08-06) ──
  const delayCategories = [
    "Pendência do cliente",
    "Escopo adicional",
    "Problema técnico",
    "Produto",
  ];
  for (const nome of delayCategories) {
    await prisma.delayCategory.upsert({
      where: { nome },
      update: { active: true },
      create: { nome },
    });
  }
  // Categorias antigas somem do seletor sem apagar o histórico já registrado.
  await prisma.delayCategory.updateMany({
    where: { nome: { notIn: delayCategories } },
    data: { active: false },
  });

  // ── Pipeline (etapas do funil, com prazo ideal/SLA e flag de etapa final) ──
  // Editável em /pipeline: estes são só os valores de partida.
  const pipeline = [
    { key: "CONTRATO_ASSINADO", nome: "Contrato assinado", idealDays: 3 },
    { key: "VALIDACAO_COMERCIAL", nome: "Validação comercial", idealDays: 5 },
    { key: "ALOCADO", nome: "Alocado", idealDays: 3 },
    { key: "CRONOGRAMA", nome: "Cronograma", idealDays: 7 },
    { key: "IMPLANTACAO", nome: "Implantação", idealDays: 45 },
    { key: "GO_LIVE", nome: "Go-live", idealDays: 7 },
    { key: "ACOMPANHAMENTO", nome: "Acompanhamento", idealDays: 15 },
    { key: "FINALIZADO", nome: "Finalizado", idealDays: 5, isFinal: true },
    { key: "CS_ATIVO", nome: "CS ativo", isFinal: true },
  ];
  const stage = {};
  if ((await prisma.pipelineStage.count()) === 0) {
    for (let i = 0; i < pipeline.length; i++) {
      const s = pipeline[i];
      stage[s.key] = await prisma.pipelineStage.create({
        data: { nome: s.nome, ordem: i, idealDays: s.idealDays ?? null, isFinal: !!s.isFinal },
      });
    }
  } else {
    const all = await prisma.pipelineStage.findMany();
    for (const s of pipeline) stage[s.key] = all.find((x) => x.nome === s.nome);
  }

  // ── Checklist por etapa (o que precisa estar feito para mover o card) ──
  const checklists = {
    CONTRATO_ASSINADO: ["Contrato anexado ao card", "Dados do cliente conferidos"],
    VALIDACAO_COMERCIAL: ["Conversa com o comercial realizada", "Informações complementares registradas"],
    ALOCADO: ["Consultor definido e comunicado", "Repasse ao consultor via email"],
    CRONOGRAMA: ["Cronograma montado com o cliente", "Reuniões recorrentes agendadas"],
    IMPLANTACAO: ["Atividades do cronograma concluídas", "Treinamento realizado (24h contratuais)"],
    GO_LIVE: ["Go-live realizado", "Cliente operando em produção"],
    ACOMPANHAMENTO: ["Pendências pós-go-live resolvidas"],
    FINALIZADO: ["Reunião de handoff com CS realizada", "Contato repassado ao CS"],
  };
  const existingChecklist = await prisma.stageChecklistTemplate.count();
  if (existingChecklist === 0) {
    for (const [key, items] of Object.entries(checklists)) {
      let ordem = 0;
      for (const titulo of items) {
        await prisma.stageChecklistTemplate.create({ data: { stageId: stage[key].id, titulo, ordem: ordem++ } });
      }
    }
  }

  // ── Catálogo de módulos e atividades (TecFood: escopo real da Mariana) ──
  // FIXO = moldura da implantação (entra em todo projeto). BASICO/COMPLETO =
  // módulos contratáveis. ADICIONAL = produto à parte (APP MyMenu). As
  // atividades vêm do cronograma real (Porto/Sempre Refeições). O split dos
  // grupos fiscais (Entrada/Estoque, Saída/Faturamento) é uma proposta a
  // validar com a Mariana. As descrições alimentam o ícone de info da atividade.
  const TECFOOD = [
    { grupo: "FIXO", nome: "Reunião de Abertura", ordem: 1, descricao: "Abertura formal do projeto.", ativs: [
      { t: "Reunião de Abertura", d: "Apresentação do cronograma, da equipe e alinhamento de expectativas e acessos.", resp: "AMBOS", reun: 1, env: "Decisor + responsável operacional" },
    ]},
    { grupo: "FIXO", nome: "Cadastros Iniciais", ordem: 2, descricao: "Estruturação da base antes das rotinas.", ativs: [
      { t: "Árvore de Produto", d: "Estrutura de grupos e categorias de produtos." },
      { t: "Produto", d: "Cadastro de produtos e insumos." },
      { t: "Prato", d: "Cadastro de pratos e preparações." },
      { t: "Tipo de Prato", d: "Classificação dos pratos." },
      { t: "Serviço", d: "Cadastro dos serviços/refeições." },
    ]},
    { grupo: "BASICO", nome: "Planejamento", ordem: 10, descricao: "Cardápio, previsão de consumo e requisições.", ativs: [
      { t: "Elaboração de Cardápio", d: "Montagem do cardápio no sistema." },
      { t: "Cálculo da Previsão de Consumo", d: "Previsão a partir do cardápio e dos efetivos." },
      { t: "Emissão do Cardápio", d: "Geração e publicação do cardápio." },
      { t: "Consumo por Serviço", d: "Apuração de consumo por serviço." },
      { t: "Requisição por Serviço", d: "Requisição de insumos por serviço." },
      { t: "Requisição Geral", d: "Requisição geral de insumos." },
      { t: "Retirada de Planejamento", d: "Baixa de estoque conforme o planejamento." },
      { t: "Retirada Geral", d: "Baixa geral de estoque." },
      { t: "Medição de Efetivos", d: "Registro do número de refeições/efetivos.", dedup: "medicao_efetivos" },
    ]},
    { grupo: "BASICO", nome: "Estoque", ordem: 30, descricao: "Posições, movimentações e inventário.", ativs: [
      { t: "Posição de Estoque", d: "Saldo por local de estoque." },
      { t: "Movimentação de Estoque", d: "Entradas, saídas e transferências." },
      { t: "Ajuste de Inventário", d: "Ajuste de saldo por contagem física." },
    ]},
    { grupo: "BASICO", nome: "Documentos Fiscais de Entrada", ordem: 40, descricao: "Recebimento fiscal de notas de entrada.", ativs: [
      { t: "Manifestação do Destinatário", d: "Manifestação das notas recebidas." },
      { t: "Importação/Consulta (XML)", d: "Importação e consulta por arquivo XML." },
      { t: "Lançamento de Entrada", d: "Lançamento manual ou por chave de acesso." },
    ]},
    { grupo: "BASICO", nome: "Custo", ordem: 50, descricao: "Apuração e relatórios de custo.", ativs: [
      { t: "Relatórios de Custos", d: "Custo de refeição e de insumos." },
    ]},
    { grupo: "BASICO", nome: "Documentos Fiscais de Saída", ordem: 60, descricao: "Emissão fiscal de saída.", ativs: [
      { t: "Parametrização Fiscal", d: "CFOP, impostos e regras fiscais.", resp: "TEKNISA", env: "Contador ou responsável fiscal" },
      { t: "Lançamento de Saída", d: "Lançamento das operações de saída." },
      { t: "Transmissão de NF-e", d: "Transmissão da nota fiscal eletrônica." },
      { t: "Download da Danfe", d: "Danfe das notas emitidas." },
      { t: "Download do XML", d: "XML das notas emitidas." },
    ]},
    { grupo: "COMPLETO", nome: "Faturamento", ordem: 70, descricao: "Faturamento de refeições e apuração.", ativs: [
      { t: "Cadastro de Clientes", d: "Clientes de faturamento." },
      { t: "Clientes por Unidade", d: "Vínculo de clientes por unidade." },
      { t: "Clientes por Serviço", d: "Vínculo de clientes por serviço." },
      { t: "Conhecimento de Fornecimento de Refeições", d: "Emissão do conhecimento de fornecimento." },
      { t: "Cálculo da Apuração (Gestão Direta)", d: "Apuração de valores a faturar." },
      { t: "Medição de Efetivos", d: "Registro do número de refeições/efetivos.", dedup: "medicao_efetivos" },
    ]},
    { grupo: "COMPLETO", nome: "Compras", ordem: 80, descricao: "Solicitação e rotinas de compras.", ativs: [
      { t: "Parametrizações e Cadastros de Compras", d: "Configuração inicial do módulo." },
      { t: "Geração da Solicitação de Compras", d: "Criação de solicitações de compra." },
      { t: "Rotinas Diárias de Compras", d: "Cotação, pedido e acompanhamento." },
    ]},
    { grupo: "COMPLETO", nome: "Financeiro (ERP)", ordem: 90, descricao: "Contas a pagar/receber e conciliação.", ativs: [
      { t: "Banco", d: "Cadastro de bancos." },
      { t: "Agência", d: "Cadastro de agências." },
      { t: "Conta Corrente", d: "Cadastro de contas correntes." },
      { t: "Tipos de Título a Pagar", d: "Classificação dos títulos." },
      { t: "Títulos a Pagar/Pagos", d: "Gestão de contas a pagar." },
      { t: "Títulos a Receber/Recebidos", d: "Gestão de contas a receber." },
      { t: "Movimentação em Conta Corrente", d: "Lançamentos em conta." },
      { t: "Extrato", d: "Consulta de extrato." },
      { t: "Conciliação", d: "Conciliação bancária." },
      { t: "Gestão de Fluxo de Caixa", d: "Projeção e acompanhamento do caixa." },
    ]},
    { grupo: "ADICIONAL", nome: "APP MyMenu", ordem: 95, descricao: "App de cardápio digital e pesquisa de satisfação.", ativs: [
      { t: "Configuração e treinamento do APP MyMenu", d: "QR Code, cardápio e questionários de satisfação.", resp: "TEKNISA", reun: 1, env: "Responsável pelo atendimento" },
    ]},
    { grupo: "ADICIONAL", nome: "My Quest", ordem: 96, descricao: "App de pesquisas e avaliações (satisfação, NPS).", ativs: [
      { t: "Configuração e treinamento do My Quest", d: "Montagem das pesquisas, canais de coleta e leitura dos resultados.", resp: "TEKNISA", reun: 1, env: "Responsável pelo atendimento" },
    ]},
    { grupo: "FIXO", nome: "Encerramento", ordem: 100, descricao: "Auditoria, termo e handoff para o CS.", ativs: [
      { t: "Auditorias e Correções nos Processos", d: "Revisão dos processos e correções finais." },
      { t: "Elaboração do Termo de Encerramento", d: "Documento formal de encerramento." },
      { t: "Reunião de Encerramento e Handoff CS", d: "Passagem para o Customer Success.", resp: "AMBOS", reun: 1 },
    ]},
  ];

  if ((await prisma.moduleTemplate.count()) === 0) {
    for (const m of TECFOOD) {
      const rec = await prisma.moduleTemplate.create({
        data: { productLine: "TECFOOD", nome: m.nome, descricao: m.descricao, grupo: m.grupo, ordem: m.ordem },
      });
      let ao = 0;
      for (const a of m.ativs) {
        await prisma.activityTemplate.create({
          data: {
            productLine: "TECFOOD", moduleTemplateId: rec.id, titulo: a.t, descricao: a.d,
            responsavel: a.resp ?? "AMBOS", numReunioes: a.reun ?? 0,
            envolvidosCliente: a.env ?? null, dedupKey: a.dedup ?? null, ordem: ao++,
          },
        });
      }
    }
    // Retail: escopo ainda não definido (aguarda Leonardo). Placeholder mínimo.
    const rtBase = await prisma.moduleTemplate.create({
      data: { productLine: "RETAIL", nome: "Retail Express (base)", grupo: "BASICO", ordem: 0, descricao: "Retaguarda e gestão (escopo a definir)" },
    });
    await prisma.moduleTemplate.create({
      data: { productLine: "RETAIL", nome: "PDV", grupo: "COMPLETO", ordem: 1, descricao: "Frente de caixa (escopo a definir)" },
    });
    await prisma.activityTemplate.create({
      data: { productLine: "RETAIL", moduleTemplateId: rtBase.id, titulo: "Reunião de Abertura", descricao: "Apresentação do cronograma e alinhamento.", responsavel: "AMBOS", numReunioes: 1, ordem: 0 },
    });
  }

  // Gera o cronograma de um projeto: atividades dos módulos contratados MAIS as
  // da moldura fixa, na ordem do catálogo, sem repetir uma atividade que aparece
  // em mais de um módulo (dedupKey). Mesma lógica da action gerarCronograma.
  async function gerarCronograma(projectId, nomesContratados, { assigneeId = null, concluidasAte = 0 } = {}) {
    const fixos = await prisma.moduleTemplate.findMany({ where: { productLine: "TECFOOD", grupo: "FIXO" } });
    const contratados = await prisma.moduleTemplate.findMany({ where: { productLine: "TECFOOD", nome: { in: nomesContratados } } });
    for (const c of contratados) {
      await prisma.projectModule.create({ data: { projectId, moduleTemplateId: c.id } });
    }
    const ids = [...new Set([...fixos, ...contratados].map((m) => m.id))];
    const templates = await prisma.activityTemplate.findMany({
      where: { moduleTemplateId: { in: ids }, active: true }, include: { moduleTemplate: true },
    });
    templates.sort((a, b) => a.moduleTemplate.ordem - b.moduleTemplate.ordem || a.ordem - b.ordem);
    const seen = new Set();
    let ordem = 0;
    for (const t of templates) {
      if (t.dedupKey && seen.has(t.dedupKey)) continue;
      if (t.dedupKey) seen.add(t.dedupKey);
      const done = ordem < concluidasAte;
      await prisma.projectActivity.create({
        data: {
          projectId, templateId: t.id, titulo: t.titulo, descricao: t.descricao,
          horas: t.horas, numReunioes: t.numReunioes, responsavel: t.responsavel,
          pautas: t.pautas, envolvidosCliente: t.envolvidosCliente, ordem,
          assigneeId,
          status: done ? "CONCLUIDA" : ordem === concluidasAte ? "EM_ANDAMENTO" : "PENDENTE",
          completedAt: done ? new Date(2026, 4, 20 + ordem) : null,
        },
      });
      ordem++;
    }
  }

  // ── Clientes de demonstração (extraídos dos contratos-modelo) ──
  if (!SEED_DEMO) return; // em produção, nada de clientes de exemplo
  if (await prisma.client.count() > 0) return;

  // 1) Cooperativa de Alimentos de Embu — em implantação
  const embu = await prisma.client.create({
    data: {
      razaoSocial: "Cooperativa de Alimentos de Embu",
      cnpj: "06.171.240/0001-35",
      endereco: "Av. São Paulo, 272 - Jardim Silvia",
      cidade: "Embu das Artes",
      uf: "SP",
      propostaNumero: "037472",
      contacts: {
        create: [
          { nome: "Hosana Flores de Jesus Guida", email: "hosanaguida15@gmail.com", cargo: "Signatária" },
          { nome: "Esthefany Flores Alves Guida", email: "esthefanyguida@gmail.com", cargo: "Testemunha/contato" },
        ],
      },
    },
  });
  const pEmbu = await prisma.project.create({
    data: {
      clientId: embu.id,
      productLine: "TECFOOD",
      nome: "Implantação TecFood Express",
      stageId: stage["IMPLANTACAO"].id,
      consultantId: u["Marciana"].id,
      peso: 2,
      dataContrato: new Date("2026-04-07"),
      dataInicio: new Date("2026-04-15"),
      goLivePrevisto: new Date("2026-07-30"),
      stageEnteredAt: new Date("2026-05-10"),
    },
  });
  await prisma.contract.create({
    data: {
      clientId: embu.id, projectId: pEmbu.id, kind: "SAAS", numero: "SAAS-202604037472-01",
      dataAssinatura: new Date("2026-04-07"), vigenciaMeses: 24, limiteSaasMb: 30000,
      contatoTeknisa: "Ana Paula Freitas Therezo",
    },
  });
  await prisma.contract.create({
    data: {
      clientId: embu.id, projectId: pEmbu.id, kind: "LUSO", numero: "LUSO-202604037472-01",
      dataAssinatura: new Date("2026-04-07"), vigenciaMeses: 24,
      valorLicenca: 2300, valorMensal: 497, horasTreinamento: 24,
      contatoTeknisa: "Ana Paula Freitas Therezo",
      items: {
        create: [
          { kind: "LICENCA", solucao: "Teknisa TecFood", tipoMedida: "Filial TecFood", qtde: 1, valorUnit: 2000, valorTotal: 2000 },
          { kind: "LICENCA", solucao: "APP TecFood MyMenu", tipoMedida: "Filial APP", qtde: 1, valorUnit: 300, valorTotal: 300 },
          { kind: "MANUTENCAO", solucao: "Teknisa TecFood", tipoMedida: "Filial TecFood", qtde: 1, valorUnit: 398, valorTotal: 398 },
          { kind: "MANUTENCAO", solucao: "APP TecFood MyMenu", tipoMedida: "Filial APP", qtde: 1, valorUnit: 99, valorTotal: 99 },
        ],
      },
    },
  });
  // Embu contratou o escopo básico + APP MyMenu (contrato: Teknisa TecFood + APP).
  await gerarCronograma(
    pEmbu.id,
    ["Planejamento", "Estoque", "Documentos Fiscais de Entrada", "Custo", "Documentos Fiscais de Saída", "APP MyMenu"],
    { assigneeId: u["Marciana"].id, concluidasAte: 6 }
  );
  const embuStages = [
    ["CONTRATO_ASSINADO", "2026-04-07"], ["VALIDACAO_COMERCIAL", "2026-04-09"],
    ["ALOCADO", "2026-04-14"], ["CRONOGRAMA", "2026-04-15"], ["IMPLANTACAO", "2026-05-10"],
  ];
  let prev = null;
  for (const [key, at] of embuStages) {
    await prisma.stageTransition.create({
      data: { projectId: pEmbu.id, fromStageId: prev, toStageId: stage[key].id, at: new Date(at), byUserId: u["Mariana"].id },
    });
    prev = stage[key].id;
  }
  await prisma.timelineEntry.create({
    data: { projectId: pEmbu.id, tipo: "COMENTARIO", texto: "Cliente sem nutricionista. O próprio dono fará a parte de cardápios. Ajustar envolvidos das reuniões.", byUserId: u["Marciana"].id, at: new Date("2026-05-12") },
  });

  // 2) VR Distribuidora — recém-chegada, aguardando validação (gera alerta de novo projeto)
  const vr = await prisma.client.create({
    data: {
      razaoSocial: "VR Distribuidora e Comércio de Alimentos LTDA",
      cnpj: "29.234.862/0001-60",
      endereco: "Rodovia Presidente Dutra, 25551",
      cidade: "Queimados",
      uf: "RJ",
      propostaNumero: "038617",
      contacts: {
        create: [
          { nome: "Victor Roberto de Freitas da Silva", cargo: "Signatário" },
          { nome: "Paôlla da Silva Assis", cargo: "Testemunha/contato" },
        ],
      },
    },
  });
  const pVr = await prisma.project.create({
    data: {
      clientId: vr.id,
      productLine: "TECFOOD",
      nome: "Implantação TecFood Express",
      stageId: stage["VALIDACAO_COMERCIAL"].id,
      peso: 1,
      dataContrato: new Date("2026-07-10"),
      stageEnteredAt: new Date("2026-07-14"),
    },
  });
  await prisma.contract.create({
    data: {
      clientId: vr.id, projectId: pVr.id, kind: "SAAS", numero: "SAAS-202606038617-01",
      dataAssinatura: new Date("2026-07-10"), vigenciaMeses: 24, limiteSaasMb: 30000,
      contatoTeknisa: "Ana Paula Freitas Therezo",
    },
  });
  await prisma.contract.create({
    data: {
      clientId: vr.id, projectId: pVr.id, kind: "LUSO", numero: "LUSO-202606038617-01",
      dataAssinatura: new Date("2026-07-10"), vigenciaMeses: 24,
      valorLicenca: 1000, valorMensal: 325, horasTreinamento: 24,
      contatoTeknisa: "Ana Paula Freitas Therezo",
      items: {
        create: [
          { kind: "LICENCA", solucao: "Teknisa TecFood", tipoMedida: "Filial TecFood", qtde: 1, valorUnit: 1000, valorTotal: 1000 },
          { kind: "MANUTENCAO", solucao: "Teknisa TecFood", tipoMedida: "Filial TecFood", qtde: 1, valorUnit: 325, valorTotal: 325 },
        ],
      },
    },
  });
  // VR contratou só o escopo básico (contrato: Teknisa TecFood).
  await gerarCronograma(
    pVr.id,
    ["Planejamento", "Estoque", "Documentos Fiscais de Entrada", "Custo", "Documentos Fiscais de Saída"],
    {}
  );
  await prisma.stageTransition.create({
    data: { projectId: pVr.id, fromStageId: null, toStageId: stage["CONTRATO_ASSINADO"].id, at: new Date("2026-07-10") },
  });
  await prisma.stageTransition.create({
    data: { projectId: pVr.id, fromStageId: stage["CONTRATO_ASSINADO"].id, toStageId: stage["VALIDACAO_COMERCIAL"].id, at: new Date("2026-07-14"), byUserId: u["Mariana"].id },
  });
  await prisma.notification.create({
    data: {
      projectId: pVr.id, tipo: "NOVO_PROJETO",
      titulo: "Novo cliente: VR Distribuidora e Comércio de Alimentos",
      corpo: "Contrato LUSO-202606038617-01 assinado em 10/07. Aguardando validação com o comercial e alocação de consultor.",
    },
  });

  // instancia o checklist da etapa atual de cada projeto seedado
  for (const p of [pEmbu, pVr]) {
    const templates = await prisma.stageChecklistTemplate.findMany({
      where: { stageId: p.stageId, active: true },
      orderBy: { ordem: "asc" },
    });
    for (const t of templates) {
      await prisma.projectChecklistItem.create({
        data: { projectId: p.id, stageId: p.stageId, titulo: t.titulo, ordem: t.ordem },
      });
    }
  }

  console.log("Seed concluído.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
