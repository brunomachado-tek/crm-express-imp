import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { slaFor, somaDescontoAprovado } from "@/lib/sla";
import { loadStages } from "@/lib/pipeline";
import { FunilBoard, type CardBoard } from "@/components/funil/funil-board";
import { canMoveStage } from "@/lib/permissions";
import { TRILHA_LABELS } from "@/lib/format";
import type { ProductLine } from "@prisma/client";

export default async function FunilPage({
  searchParams,
}: {
  searchParams: Promise<{ funil?: string; trilha?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const funil: ProductLine =
    params.funil === "RETAIL" || params.funil === "TECFOOD"
      ? (params.funil as ProductLine)
      : user.productLine ?? "TECFOOD";
  const trilha = params.trilha === "REDUZIDA" ? "REDUZIDA" : "BASE";

  const [projects, stages] = await Promise.all([
    db.project.findMany({
      where: { deleted: false, productLine: funil, trilha, status: { not: "CANCELADO" } },
      include: {
        client: true,
        consultant: true,
        stage: true,
        pauses: true,
        checklist: { orderBy: { ordem: "asc" } },
        contracts: { where: { kind: "LUSO" } },
        modules: { include: { moduleTemplate: true } },
        delays: { where: { status: "APROVADA" }, select: { status: true, dias: true, stageId: true } },
      },
      orderBy: { stageEnteredAt: "asc" },
    }),
    loadStages(trilha),
  ]);

  const accent = funil === "TECFOOD" ? "border-t-tecfood" : "border-t-retail";

  // Dados já prontos para o quadro (client component): só o necessário.
  const cards: CardBoard[] = projects.map((p) => ({
    id: p.id,
    stageId: p.stageId,
    cliente: p.client.razaoSocial,
    cidade: p.client.cidade,
    uf: p.client.uf,
    valorMensal: p.contracts[0]?.valorMensal ?? null,
    consultor: p.consultant?.name ?? null,
    status: p.status,
    sla: slaFor(p, undefined, somaDescontoAprovado(p.delays, p.stageId)),
    temAditivo: p.modules.some((m) => m.isAditivo),
    // Todo mundo enxerga o quadro; só quem toca a implantação arrasta o card.
    // A action confere de novo no servidor.
    podeMover: canMoveStage(user, p),
    // checklist da etapa atual: é o que trava o avanço
    checklist: p.checklist
      .filter((c) => c.stageId === p.stageId)
      .map((c) => ({ id: c.id, titulo: c.titulo, done: c.done })),
  }));

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Funil de implantação</h1>
          <p className="text-sm text-muted-foreground">
            {projects.length} projeto{projects.length === 1 ? "" : "s"} no funil{" "}
            {funil === "TECFOOD" ? "TecFood" : "Retail"}.{" "}
            {/* Só sugere arrastar para quem tem ao menos um card que pode mover. */}
            {cards.some((c) => c.podeMover)
              ? "Arraste um card para mudar de etapa."
              : "Clique em um card para abrir o projeto."}
          </p>
        </div>
        {/* Hierarquia: primeiro o serviço (TecFood/Retail), depois o tipo de
            cliente (novos clientes / clientes da base). */}
        <div className="flex flex-col items-end gap-2">
          <div className="flex rounded-lg border border-border bg-card p-1 gap-1">
            {(["TECFOOD", "RETAIL"] as const).map((f) => (
              <Link
                key={f}
                href={`/funil?funil=${f}&trilha=${trilha}`}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  funil === f
                    ? f === "TECFOOD"
                      ? "bg-tecfood text-white"
                      : "bg-retail text-white"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {f === "TECFOOD" ? "TecFood" : "Retail"}
              </Link>
            ))}
          </div>
          <div className="flex rounded-lg border border-border bg-card p-1 gap-1">
            {(["BASE", "REDUZIDA"] as const).map((t) => (
              <Link
                key={t}
                href={`/funil?funil=${funil}&trilha=${t}`}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  trilha === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {TRILHA_LABELS[t]}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <FunilBoard
        etapas={stages.map((s) => ({ id: s.id, nome: s.nome, ordem: s.ordem }))}
        cards={cards}
        accent={accent}
        voltarPara={`/funil?funil=${funil}&trilha=${trilha}`}
      />
    </div>
  );
}
