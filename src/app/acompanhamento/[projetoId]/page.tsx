import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { fmtDate, PRODUCT_LABELS, STATUS_LABELS } from "@/lib/format";
import { PrintButton } from "@/components/acompanhamento/print-button";

export const metadata = {
  title: "Acompanhamento de Implantação · CRM Express",
};

// Documento de acompanhamento para o cliente: 1 por projeto, regerável a cada
// alteração. Fica fora do grupo (app) de propósito, para não herdar a barra
// lateral e sair limpo na impressão. O usuário gera o PDF pelo "Salvar como PDF"
// do navegador (o layout de impressão está no @media print do globals.css).

type Params = { projetoId: string };

const STATUS_TOM: Record<string, string> = {
  PENDENTE: "bg-muted text-muted-foreground",
  EM_ANDAMENTO: "bg-accent/10 text-accent",
  CONCLUIDA: "bg-success/10 text-success",
  CANCELADA: "bg-destructive/10 text-destructive",
};

export default async function AcompanhamentoPage({ params }: { params: Promise<Params> }) {
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
  if (!project || project.deleted) notFound();

  // Agrupa por fase (bloco do cronograma), mesma regra da lista de atividades:
  // fase explícita, senão o módulo de origem, senão "Outras atividades".
  const grupos: { nome: string; items: typeof project.activities }[] = [];
  const idx = new Map<string, number>();
  for (const a of project.activities) {
    const chave = a.fase?.trim() || a.template?.moduleTemplate?.nome || "Outras atividades";
    if (!idx.has(chave)) {
      idx.set(chave, grupos.length);
      grupos.push({ nome: chave, items: [] });
    }
    grupos[idx.get(chave)!].items.push(a);
  }

  const luso = project.contracts[0];
  const acento = project.productLine === "TECFOOD" ? "text-tecfood" : "text-retail";
  const acentoBorda = project.productLine === "TECFOOD" ? "border-tecfood" : "border-retail";
  const acentoBg = project.productLine === "TECFOOD" ? "bg-tecfood" : "bg-retail";
  const total = project.activities.length;
  const concluidas = project.activities.filter((a) => a.status === "CONCLUIDA").length;

  const cliente = project.client;
  const local = [cliente.cidade, cliente.uf].filter(Boolean).join(", ");

  return (
    <div className="ac-screen min-h-screen bg-muted py-8 px-4 print:bg-white print:p-0">
      {/* Barra de ação, some na impressão */}
      <div className="no-print max-w-[820px] mx-auto mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Pré-visualização do documento. Use "Baixar PDF" e escolha "Salvar como PDF".
        </p>
        <PrintButton />
      </div>

      {/* Folha */}
      <article className="ac-folha max-w-[820px] mx-auto bg-card text-foreground rounded-lg shadow-sm print:shadow-none print:rounded-none border border-border print:border-0 p-10 print:p-0">
        {/* Cabeçalho */}
        <header className={`flex items-start justify-between gap-6 border-b-2 ${acentoBorda} pb-5`}>
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/teknisa.svg" alt="Teknisa" width={150} height={28} />
            <p className="text-xs text-muted-foreground mt-2">CRM Express · Small Business</p>
          </div>
          <div className="text-right">
            <h1 className="font-display text-xl font-semibold text-primary leading-tight">
              Acompanhamento de Implantação
            </h1>
            <p className={`text-sm font-medium mt-1 ${acento}`}>
              {PRODUCT_LABELS[project.productLine]}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Gerado em {fmtDate(new Date())}
            </p>
          </div>
        </header>

        {/* Identificação do cliente */}
        <section className="mt-5">
          <h2 className="font-display text-2xl font-semibold leading-tight">{cliente.razaoSocial}</h2>
          <div className="mt-2 grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
            {cliente.cnpj && <Info rotulo="CNPJ" valor={cliente.cnpj} />}
            {local && <Info rotulo="Cidade / UF" valor={local} />}
            <Info rotulo="Consultor responsável" valor={project.consultant?.name ?? "Sem consultor"} />
            <Info rotulo="Etapa atual" valor={project.stage.nome} />
            {luso?.numero && <Info rotulo="Contrato" valor={luso.numero} />}
            {project.dataContrato && (
              <Info rotulo="Assinatura" valor={fmtDate(project.dataContrato)} />
            )}
          </div>
          <div className="mt-4 inline-flex items-center gap-2 rounded-md bg-muted px-3 py-1.5 text-sm">
            <span className="font-semibold">{concluidas}</span>
            <span className="text-muted-foreground">de {total} atividades concluídas</span>
          </div>
        </section>

        {/* Grupos e atividades */}
        <section className="mt-6 space-y-6">
          {grupos.map((g) => (
            <div key={g.nome} className="ac-grupo">
              <h3 className={`font-display text-base font-semibold flex items-center gap-2 border-l-4 ${acentoBorda} pl-3`}>
                {g.nome}
              </h3>
              <ul className="mt-3 space-y-2.5">
                {g.items.map((a) => {
                  const entregou = a.assignee?.name ?? project.consultant?.name ?? null;
                  const dataEntrega =
                    a.status === "CONCLUIDA" ? a.completedAt ?? a.dueDate : a.dueDate;
                  const rotuloData = a.status === "CONCLUIDA" ? "Entregue em" : "Previsto para";
                  return (
                    <li
                      key={a.id}
                      className="ac-item rounded-md border border-border p-3.5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-medium leading-snug">{a.titulo}</p>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_TOM[a.status] ?? "bg-muted text-muted-foreground"}`}
                        >
                          {STATUS_LABELS[a.status] ?? a.status}
                        </span>
                      </div>
                      {a.descricao && (
                        <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                          {a.descricao}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                        {entregou && (
                          <span>
                            Responsável pela entrega: <span className="text-foreground font-medium">{entregou}</span>
                          </span>
                        )}
                        {a.envolvidosCliente && (
                          <span>
                            Envolvidos: <span className="text-foreground">{a.envolvidosCliente}</span>
                          </span>
                        )}
                        {dataEntrega && (
                          <span>
                            {rotuloData}: <span className="text-foreground">{fmtDate(dataEntrega)}</span>
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          {grupos.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma atividade cadastrada neste projeto.</p>
          )}
        </section>

        {/* Rodapé */}
        <footer className={`mt-8 pt-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground`}>
          <span className={`inline-flex items-center gap-1.5`}>
            <span className={`inline-block h-2 w-2 rounded-full ${acentoBg}`} />
            Documento gerado pelo CRM Express · Teknisa Small Business
          </span>
          <span>{fmtDate(new Date())}</span>
        </footer>
      </article>
    </div>
  );
}

function Info({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <span className="block text-[11px] uppercase tracking-wide text-muted-foreground/70">
        {rotulo}
      </span>
      <span className="block font-medium">{valor}</span>
    </div>
  );
}
