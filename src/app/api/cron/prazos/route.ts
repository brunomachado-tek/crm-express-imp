import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Cria avisos de "prazo apertado" para atividades pendentes vencendo (ou vencidas).
// Chamada 1x/dia pela função agendada do Netlify (netlify/functions/prazos.mts),
// que envia o token. Deduplica: no máximo um aviso por atividade a cada 3 dias.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? req.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || token !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  const now = new Date();
  const limite = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000); // vence nos próximos 2 dias
  const tresDias = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

  const atividades = await db.projectActivity.findMany({
    where: {
      status: { in: ["PENDENTE", "EM_ANDAMENTO"] },
      dueDate: { not: null, lte: limite },
      project: { deleted: false, status: "ATIVO" },
    },
    include: { project: { include: { client: true } } },
  });

  let criadas = 0;
  for (const a of atividades) {
    const destinatario = a.assigneeId ?? a.project.consultantId;
    if (!destinatario || !a.dueDate) continue;

    const jaAvisou = await db.notification.count({
      where: { activityId: a.id, tipo: "PRAZO", createdAt: { gte: tresDias } },
    });
    if (jaAvisou > 0) continue;

    const venc = a.dueDate.toLocaleDateString("pt-BR", { timeZone: "UTC" });
    const atrasada = a.dueDate.getTime() < now.getTime();
    await db.notification.create({
      data: {
        userId: destinatario,
        projectId: a.projectId,
        activityId: a.id,
        tipo: "PRAZO",
        titulo: atrasada ? `Atividade atrasada: ${a.titulo}` : `Prazo apertado: ${a.titulo}`,
        corpo: `${a.project.client.razaoSocial} · ${atrasada ? "venceu" : "vence"} em ${venc}`,
      },
    });
    criadas++;
  }

  return NextResponse.json({ ok: true, verificadas: atividades.length, criadas });
}
