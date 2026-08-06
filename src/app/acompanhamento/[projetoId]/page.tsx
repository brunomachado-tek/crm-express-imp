import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { fmtDate, PRODUCT_LABELS, RESPONSAVEL_LABELS } from "@/lib/format";
import { PrintButton } from "@/components/acompanhamento/print-button";

export const metadata = {
  title: "Acompanhamento de Implantação · CRM Express",
};

// Documento de acompanhamento para o cliente: 1 por projeto, regerável a cada
// alteração. Fica fora do grupo (app) de propósito, para não herdar a barra
// lateral e sair limpo na impressão. O usuário gera o PDF pelo "Salvar como PDF"
// do navegador (o layout de impressão está no @media print do globals.css).
//
// É gerado no INÍCIO da implantação: as atividades ainda não estão em execução,
// então o documento é o plano detalhado (todos os blocos e atividades com todas
// as informações do CRM), sem status/tags de conclusão. A observação da
// atividade fica de fora de propósito: é nota interna do consultor (com @menção).

type Params = { projetoId: string };

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
            <span className="font-semibold">{total}</span>
            <span className="text-muted-foreground">
              atividades planejadas em {grupos.length} bloco{grupos.length === 1 ? "" : "s"}
            </span>
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
                  // Todos os campos que a atividade tem no CRM (menos a observação,
                  // que é nota interna). Só entra no documento o que está preenchido.
                  const campos: { rotulo: string; valor: string }[] = [
                    { rotulo: "Responsável", valor: RESPONSAVEL_LABELS[a.responsavel] },
                    ...(a.envolvidosCliente
                      ? [{ rotulo: "Envolvidos do cliente", valor: a.envolvidosCliente }]
                      : []),
                    ...(a.assignee?.name
                      ? [{ rotulo: "Consultor", valor: a.assignee.name }]
                      : []),
                    ...(a.horas != null
                      ? [{ rotulo: "Esforço", valor: `${a.horas}h` }]
                      : []),
                    ...(a.numReunioes
                      ? [
                          {
                            rotulo: "Reuniões",
                            valor: `${a.numReunioes} ${a.numReunioes > 1 ? "reuniões" : "reunião"}`,
                          },
                        ]
                      : []),
                    ...(a.dueDate
                      ? [{ rotulo: "Data prevista", valor: fmtDate(a.dueDate) }]
                      : []),
                    ...(a.scheduledAt
                      ? [{ rotulo: "Reunião agendada", valor: fmtDate(a.scheduledAt) }]
                      : []),
                  ];
                  return (
                    <li key={a.id} className="ac-item rounded-md border border-border p-4">
                      <p className="font-medium leading-snug">{a.titulo}</p>
                      {a.descricao && (
                        <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                          {a.descricao}
                        </p>
                      )}
                      {a.pautas && (
                        <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                          <span className="font-medium text-foreground">Pautas: </span>
                          {a.pautas}
                        </p>
                      )}
                      {a.observacao && (
                        <p className="text-sm mt-2 leading-relaxed rounded-md bg-muted px-3 py-2">
                          <span className="font-medium">Observação: </span>
                          <span className="text-muted-foreground">{a.observacao}</span>
                        </p>
                      )}
                      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
                        {campos.map((c) => (
                          <div key={c.rotulo}>
                            <dt className="text-[11px] uppercase tracking-wide text-muted-foreground/70">
                              {c.rotulo}
                            </dt>
                            <dd className="text-sm font-medium">{c.valor}</dd>
                          </div>
                        ))}
                      </dl>
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
