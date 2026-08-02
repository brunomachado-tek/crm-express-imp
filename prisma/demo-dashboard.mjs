// Demonstração para o dashboard: alguns projetos TecFood concluídos (em meses
// diferentes, para o SLA médio e a tendência) e alguns ativos (um atrasado),
// com histórico de transições para o "tempo médio por etapa". Idempotente pelo
// razaoSocial. Rodar: node prisma/demo-dashboard.mjs
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const dia = 24 * 60 * 60 * 1000;

async function main() {
  const stages = await prisma.pipelineStage.findMany({ orderBy: { ordem: "asc" } });
  const cons = await prisma.user.findMany({ where: { role: "CONSULTOR", productLine: "TECFOOD" } });
  const final = stages.find((s) => s.isFinal);

  // Cria um projeto com transições ao longo das etapas. `assinatura` e, se
  // concluído, `finalizacao` definem o SLA. As transições distribuem o tempo
  // entre as etapas até a atual.
  async function criar({ nome, assinatura, finalizacao, etapaAtualIdx, consultorIdx, entrouHaDias }) {
    if (await prisma.client.findFirst({ where: { razaoSocial: nome } })) return;
    const client = await prisma.client.create({
      data: { razaoSocial: nome, cidade: "São Paulo", uf: "SP" },
    });
    const concluido = !!finalizacao;
    const stageAtual = concluido ? final : stages[etapaAtualIdx];
    const stageEnteredAt = concluido
      ? new Date(finalizacao)
      : new Date(Date.now() - entrouHaDias * dia);
    const project = await prisma.project.create({
      data: {
        clientId: client.id,
        productLine: "TECFOOD",
        nome: "Implantação TecFood Express",
        stageId: stageAtual.id,
        stageEnteredAt,
        status: "ATIVO",
        consultantId: cons[consultorIdx % cons.length].id,
        dataContrato: new Date(assinatura),
        dataFinalizacao: concluido ? new Date(finalizacao) : null,
      },
    });
    await prisma.contract.create({
      data: {
        clientId: client.id, projectId: project.id, kind: "LUSO",
        numero: `LUSO-DEMO-${Math.random().toString(36).slice(2, 8)}`,
        dataAssinatura: new Date(assinatura), vigenciaMeses: 24,
        valorLicenca: 2000, valorMensal: 400, horasTreinamento: 24, prazoTreinamentoDias: 60,
      },
    });

    // Transições: distribui o intervalo assinatura→(finalização ou entrada atual)
    // pelas etapas percorridas, para o "tempo médio por etapa" ter histórico.
    const inicio = new Date(assinatura).getTime();
    const fim = (concluido ? new Date(finalizacao) : stageEnteredAt).getTime();
    const idxFinal = concluido ? stages.indexOf(final) : etapaAtualIdx;
    const passos = Math.max(1, idxFinal);
    const passo = (fim - inicio) / passos;
    let prev = null;
    for (let i = 0; i <= idxFinal; i++) {
      const at = new Date(inicio + passo * i);
      await prisma.stageTransition.create({
        data: { projectId: project.id, fromStageId: prev, toStageId: stages[i].id, at },
      });
      prev = stages[i].id;
    }
  }

  const hoje = Date.now();
  const mes = (m) => new Date(new Date().getFullYear(), new Date().getMonth() - m, 10).toISOString();

  // Concluídos em meses diferentes (SLA médio + tendência)
  await criar({ nome: "Cozinha Industrial Aurora", assinatura: mes(4), finalizacao: mes(2), consultorIdx: 0 });
  await criar({ nome: "Refeições Bom Prato", assinatura: mes(4), finalizacao: mes(1), consultorIdx: 1 });
  await criar({ nome: "Sabor & Nutrição Coletiva", assinatura: mes(3), finalizacao: mes(0), consultorIdx: 2 });
  await criar({ nome: "Cooperativa Alimentar Vale Verde", assinatura: mes(5), finalizacao: mes(2), consultorIdx: 3 });

  // Ativos: um em dia, um atrasado (entrou há muito na etapa), um recente
  await criar({ nome: "Restaurante Sabor & Arte", assinatura: mes(2), etapaAtualIdx: 4, consultorIdx: 0, entrouHaDias: 8 });
  await criar({ nome: "Grupo Delícia Refeições", assinatura: mes(3), etapaAtualIdx: 3, consultorIdx: 1, entrouHaDias: 45 });
  await criar({ nome: "Casa do Almoço Ltda", assinatura: mes(0), etapaAtualIdx: 1, consultorIdx: 2, entrouHaDias: 3 });

  // Justificativas de atraso e pausas nos ativos, para a aba Qualidade e causas.
  if ((await prisma.delayJustification.count()) === 0) {
    const cats = await prisma.delayCategory.findMany({ where: { active: true } });
    const ativos = await prisma.project.findMany({
      where: { productLine: "TECFOOD", status: "ATIVO", stage: { isFinal: false } },
    });
    let i = 0;
    for (const pr of ativos) {
      if (cats.length > 0) {
        await prisma.delayJustification.create({
          data: { projectId: pr.id, stageId: pr.stageId, categoryId: cats[i % cats.length].id, detalhe: "Cliente não enviou os dados no prazo." },
        });
        if (i % 2 === 0) {
          await prisma.delayJustification.create({
            data: { projectId: pr.id, stageId: pr.stageId, categoryId: cats[(i + 1) % cats.length].id, detalhe: "Aguardando parametrização fiscal." },
          });
        }
      }
      if (i === 0) await prisma.projectPause.create({ data: { projectId: pr.id, startedAt: new Date(Date.now() - 20 * dia), endedAt: new Date(Date.now() - 6 * dia), motivo: "Cliente em fechamento contábil" } });
      if (i === 1) await prisma.projectPause.create({ data: { projectId: pr.id, startedAt: new Date(Date.now() - 9 * dia), endedAt: null, motivo: "Aguardando certificado digital" } });
      i++;
    }
  }

  const n = await prisma.project.count({ where: { productLine: "TECFOOD" } });
  console.log(`Demo pronta. Projetos TecFood: ${n}. (Rode em prisma/demo-dashboard.mjs)`);
  void hoje;
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
