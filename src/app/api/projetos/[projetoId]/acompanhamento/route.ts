import { renderToBuffer } from "@react-pdf/renderer";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { fmtDate, PRODUCT_LABELS, RESPONSAVEL_LABELS } from "@/lib/format";
import { AcompanhamentoDoc, type GrupoPDF, type CampoPDF } from "@/pdf/acompanhamento-doc.mjs";

// Precisa do runtime Node (o @react-pdf usa APIs de Node, e lê os TTF do disco).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Gera o PDF de acompanhamento no servidor e devolve o arquivo. Substituiu a
// impressão do navegador (o "Salvar como PDF" do Safari saía em branco).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ projetoId: string }> }
) {
  await requireUser();
  const { projetoId } = await params;

  const project = await db.project.findUnique({
    where: { id: projetoId },
    include: {
      client: true,
      consultant: true,
      stage: true,
      contracts: { where: { kind: "LUSO" }, take: 1 },
      activities: {
        orderBy: { ordem: "asc" },
        include: {
          assignee: true,
          template: { include: { moduleTemplate: { select: { nome: true } } } },
        },
      },
    },
  });
  if (!project || project.deleted) return new Response("Projeto não encontrado", { status: 404 });

  // Agrupa por fase (bloco do cronograma): fase explícita, senão o módulo de
  // origem, senão "Outras atividades". Mesma regra da lista de atividades.
  const grupos: GrupoPDF[] = [];
  const idx = new Map<string, number>();
  for (const a of project.activities) {
    const chave = a.fase?.trim() || a.template?.moduleTemplate?.nome || "Outras atividades";
    if (!idx.has(chave)) {
      idx.set(chave, grupos.length);
      grupos.push({ nome: chave, items: [] });
    }
    const campos: CampoPDF[] = [
      { rotulo: "Responsável", valor: RESPONSAVEL_LABELS[a.responsavel] },
      ...(a.envolvidosCliente ? [{ rotulo: "Envolvidos do cliente", valor: a.envolvidosCliente }] : []),
      ...(a.assignee?.name ? [{ rotulo: "Consultor", valor: a.assignee.name }] : []),
      ...(a.horas != null ? [{ rotulo: "Esforço", valor: `${a.horas}h` }] : []),
      ...(a.numReunioes
        ? [{ rotulo: "Reuniões", valor: `${a.numReunioes} ${a.numReunioes > 1 ? "reuniões" : "reunião"}` }]
        : []),
      ...(a.dueDate ? [{ rotulo: "Data prevista", valor: fmtDate(a.dueDate) }] : []),
      ...(a.scheduledAt ? [{ rotulo: "Reunião agendada", valor: fmtDate(a.scheduledAt) }] : []),
    ];
    grupos[idx.get(chave)!].items.push({
      titulo: a.titulo,
      descricao: a.descricao,
      pautas: a.pautas,
      observacao: a.observacao,
      campos,
    });
  }

  const luso = project.contracts[0];
  const local = [project.client.cidade, project.client.uf].filter(Boolean).join(", ");

  const buffer = await renderToBuffer(
    AcompanhamentoDoc({
      cliente: { razaoSocial: project.client.razaoSocial, cnpj: project.client.cnpj, local },
      produtoLabel: PRODUCT_LABELS[project.productLine],
      cor: project.productLine === "TECFOOD" ? "#0051d0" : "#059e1e",
      consultor: project.consultant?.name ?? "Sem consultor",
      etapa: project.stage.nome,
      contrato: luso?.numero ?? null,
      assinatura: project.dataContrato ? fmtDate(project.dataContrato) : null,
      geradoEm: fmtDate(new Date()),
      total: project.activities.length,
      blocos: grupos.length,
      grupos,
    })
  );

  const slug = project.client.razaoSocial
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 60);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="acompanhamento-${slug || "projeto"}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
