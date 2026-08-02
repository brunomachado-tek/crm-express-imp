import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { brl, fmtDate } from "@/lib/format";
import { slaFor } from "@/lib/sla";
import { canDeleteClient, canEditClient, canHardDeleteClient } from "@/lib/permissions";
import {
  addContactAction,
  deleteContactAction,
  restoreClientAction,
  updateClientAction,
  updateContactAction,
  updateContractAction,
  uploadDocument,
} from "@/lib/actions";
import { ProductBadge, StageBadge, StatusBadge, AditivoBadge, SlaChip } from "@/components/badges";
import { TogglePanel } from "@/components/ui/toggle-panel";
import { MaskedInput } from "@/components/ui/masked-input";
import { FileUploadField } from "@/components/project/file-upload-field";
import { DeleteDocumentButton } from "@/components/project/delete-document-button";
import { DeleteClientPanel } from "@/components/clientes/delete-client-panel";
import { ContractReuploadPanel } from "@/components/clientes/contract-reupload-panel";
import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  Building2,
  CalendarDays,
  Check,
  FileText,
  Mail,
  MapPin,
  Package,
  Paperclip,
  Pencil,
  Phone,
  Plus,
  Receipt,
  RotateCcw,
  Store,
  Trash2,
  UserRound,
} from "lucide-react";

const KIND_LABELS: Record<string, string> = {
  SAAS: "SaaS · Infraestrutura em nuvem",
  LUSO: "Licenciamento e manutenção",
  ADITIVO: "Aditivo",
  OUTRO: "Outro",
};

const input =
  "w-full h-10 rounded-md border border-border bg-muted/50 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40";
const label = "text-sm font-medium";

const ERROS_CLIENTE: Record<string, string> = {
  permissao:
    "Seu perfil não pode editar o cadastro deste cliente. Fale com a coordenação do produto.",
  "contrato-duplicado": "Já existe um contrato cadastrado com esse número.",
  contato: "Informe ao menos o nome do contato.",
  arquivo: "Selecione o PDF do contrato.",
  "arquivo-tipo": "O contrato precisa ser um PDF.",
  "arquivo-grande": "Arquivo acima de 8 MB. Comprima o PDF.",
  "sem-projeto": "Este cliente não tem projeto para vincular o contrato.",
  "contrato-ilegivel": "Não consegui ler este contrato. Confira se é o PDF assinado.",
};

const OKS_CLIENTE: Record<string, string> = {
  contato: "Contato salvo.",
  contrato: "Contrato salvo. O marco contratual foi recalculado.",
  cliente: "Dados do cliente salvos.",
  restaurado: "Cliente restaurado.",
  "contrato-atualizado": "Cadastro atualizado a partir do contrato. Veja o registro na timeline do projeto.",
  "contrato-anexado": "Contrato anexado. Os dados foram mantidos.",
};

export default async function ClientePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; erro?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { ok, erro } = await searchParams;

  const client = await db.client.findUnique({
    where: { id },
    include: {
      contacts: { orderBy: { nome: "asc" } },
      contracts: { include: { items: true }, orderBy: { dataAssinatura: "asc" } },
      projects: {
        // sem filtro de `deleted`: cliente arquivado tem os projetos marcados
        // como deletados junto, e a ficha precisa continuar mostrando tudo
        include: {
          consultant: true,
          stage: true,
          pauses: true,
          units: true,
          documents: { orderBy: { uploadedAt: "desc" } },
          modules: { include: { moduleTemplate: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!client) notFound();

  // Todo mundo consulta a ficha do cliente; editar cadastro, contrato e
  // contatos é de quem atua nos projetos dele (a action confere de novo).
  const arquivado = !!client.deletedAt;
  const podeEditar = !arquivado && canEditClient(user, client.projects);
  const podeApagar = canDeleteClient(user, client.projects);
  const podeApagarDefinitivo = canHardDeleteClient(user);

  const licencaTotal = client.contracts.reduce((s, c) => s + (c.valorLicenca ?? 0), 0);
  const mensalidadeTotal = client.contracts.reduce((s, c) => s + (c.valorMensal ?? 0), 0);
  const unidadesTotal = client.projects.reduce((s, p) => s + p.units.length, 0);
  const assinaturas = client.contracts
    .map((c) => c.dataAssinatura)
    .filter((d): d is Date => !!d)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  const ultimaAssinatura = assinaturas[0] ?? null;
  const comercial = client.contracts.find((c) => c.contatoTeknisa)?.contatoTeknisa ?? null;

  // Soluções/serviços contratados, agregados a partir dos itens de todos os contratos.
  const solucoesMap = new Map<string, { solucao: string; medida: string | null; licenca: number; mensal: number }>();
  for (const c of client.contracts) {
    for (const it of c.items) {
      const key = it.solucao;
      const cur = solucoesMap.get(key) ?? { solucao: it.solucao, medida: it.tipoMedida, licenca: 0, mensal: 0 };
      if (it.kind === "LICENCA") cur.licenca += it.valorTotal ?? 0;
      else cur.mensal += it.valorTotal ?? 0;
      solucoesMap.set(key, cur);
    }
  }
  const solucoes = [...solucoesMap.values()];

  // Anexos de todos os projetos do cliente, reunidos em um lugar só.
  const anexos = client.projects.flatMap((p) =>
    p.documents.map((d) => ({ ...d, projetoNome: p.nome ?? "Implantação", projetoId: p.id }))
  );

  const overview = [
    { label: "Contratos", value: String(client.contracts.length), icon: FileText },
    { label: "Projetos", value: String(client.projects.length), icon: Package },
    { label: "Unidades", value: String(unidadesTotal), icon: Store },
    { label: "Licença (única)", value: brl(licencaTotal), icon: Receipt },
    { label: "Recorrência", value: `${brl(mensalidadeTotal)}/mês`, icon: Banknote },
  ];

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <Link href="/clientes" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2">
          <ArrowLeft className="h-4 w-4" /> Clientes
        </Link>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold flex items-center gap-2 flex-wrap">
              <Building2 className="h-6 w-6 text-primary shrink-0" />
              {client.razaoSocial}
            </h1>
            {client.nomeFantasia && (
              <p className="text-sm text-muted-foreground mt-1">{client.nomeFantasia}</p>
            )}
            <div className="flex items-center gap-x-4 gap-y-1 mt-1.5 text-sm text-muted-foreground flex-wrap">
              <span>{client.cnpj ?? "CNPJ não informado"}</span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {client.cidade ?? "sem cidade"}{client.uf ? `/${client.uf}` : ""}
              </span>
              {client.propostaNumero && <span>Proposta {client.propostaNumero}</span>}
              {comercial && (
                <span className="inline-flex items-center gap-1">
                  <UserRound className="h-3.5 w-3.5" /> {comercial}
                </span>
              )}
            </div>
            {client.endereco && (
              <p className="text-xs text-muted-foreground mt-1">{client.endereco}</p>
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {ultimaAssinatura && (
              <div className="text-right">
                <p className="text-xs text-muted-foreground inline-flex items-center gap-1 justify-end">
                  <CalendarDays className="h-3.5 w-3.5" /> Assinatura mais recente
                </p>
                <p className="text-sm font-medium">{fmtDate(ultimaAssinatura)}</p>
              </div>
            )}
            {/* Atualizar pelo contrato e apagar ficam no topo, ao lado da
                identificação do cliente. Some quando o cliente está arquivado. */}
            {!arquivado && podeEditar && <ContractReuploadPanel clientId={client.id} />}
            {!arquivado && podeApagar && (
              <DeleteClientPanel
                clientId={client.id}
                nome={client.razaoSocial}
                projetos={client.projects.length}
                contratos={client.contracts.length}
                canHardDelete={podeApagarDefinitivo}
              />
            )}
          </div>
        </div>
      </div>

      {arquivado && (
        <div className="rounded-md border border-warning-bg/40 bg-warning-bg/10 px-4 py-3 text-sm flex items-center justify-between gap-3 flex-wrap">
          <span className="inline-flex items-center gap-2 text-warning">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Cliente arquivado. Não aparece nas listas, no funil nem no dashboard.
          </span>
          {podeApagar && (
            <div className="flex items-center gap-2">
              <form action={restoreClientAction}>
                <input type="hidden" name="clientId" value={client.id} />
                <button className="h-8 px-3 inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary-hover">
                  <RotateCcw className="h-3.5 w-3.5" /> Restaurar cliente
                </button>
              </form>
              {podeApagarDefinitivo && (
                <DeleteClientPanel
                  clientId={client.id}
                  nome={client.razaoSocial}
                  projetos={client.projects.length}
                  contratos={client.contracts.length}
                  canHardDelete
                  variant="icone"
                />
              )}
            </div>
          )}
        </div>
      )}

      {erro && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-2.5 text-sm text-destructive flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {ERROS_CLIENTE[erro] ?? "Não foi possível concluir a ação."}
        </div>
      )}

      {ok && (
        <div className="rounded-md border border-success/30 bg-success/5 px-4 py-2.5 text-sm text-success inline-flex items-center gap-2">
          <Check className="h-4 w-4" />
          {OKS_CLIENTE[ok] ?? "Alteração salva."}
        </div>
      )}

      {/* Visão geral */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {overview.map(({ label: l, value, icon: Icon }) => (
          <div key={l} className="bg-card border border-border rounded-lg p-3.5">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">{l}</p>
              <Icon className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <p className="text-lg font-semibold mt-0.5">{value}</p>
          </div>
        ))}
      </div>

      {/* Dados cadastrais, editáveis */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-sm font-semibold text-foreground/80">Dados cadastrais</h2>
        </div>
        {podeEditar && (
        <TogglePanel
          label="Editar dados do cliente"
          titulo="Editar dados do cliente"
          icon={<Pencil className="h-4 w-4 text-primary" />}
        >
          <form action={updateClientAction} className="space-y-4">
            <input type="hidden" name="clientId" value={client.id} />
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="razaoSocial" className={label}>Razão social</label>
                <input id="razaoSocial" name="razaoSocial" required defaultValue={client.razaoSocial} className={input} />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="nomeFantasia" className={label}>
                  Nome fantasia <span className="text-muted-foreground font-normal">(opcional)</span>
                </label>
                <input id="nomeFantasia" name="nomeFantasia" defaultValue={client.nomeFantasia ?? ""} className={input} />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="cnpj" className={label}>CNPJ</label>
                <MaskedInput id="cnpj" name="cnpj" mascara="cnpj" defaultValue={client.cnpj} placeholder="00.000.000/0000-00" className={input} />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="propostaNumero" className={label}>Nº da proposta</label>
                <input id="propostaNumero" name="propostaNumero" defaultValue={client.propostaNumero ?? ""} className={input} />
              </div>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="endereco" className={label}>Endereço</label>
              <input id="endereco" name="endereco" defaultValue={client.endereco ?? ""} className={input} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 space-y-1.5">
                <label htmlFor="cidade" className={label}>Cidade</label>
                <input id="cidade" name="cidade" defaultValue={client.cidade ?? ""} className={input} />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="uf" className={label}>UF</label>
                <input id="uf" name="uf" maxLength={2} defaultValue={client.uf ?? ""} className={input} />
              </div>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="notes" className={label}>
                Observações <span className="text-muted-foreground font-normal">(opcional)</span>
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={3}
                defaultValue={client.notes ?? ""}
                className="w-full rounded-md border border-border bg-muted/50 px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              />
            </div>
            <div className="flex justify-end">
              <button className="h-10 px-5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary-hover transition-colors">
                Salvar dados
              </button>
            </div>
          </form>
        </TogglePanel>
        )}
        {client.notes && (
          <div className="rounded-lg bg-card border border-border p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Observações</h3>
            <p className="text-sm whitespace-pre-wrap">{client.notes}</p>
          </div>
        )}
      </section>

      {/* Projetos */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground/80">Projetos de implantação</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {client.projects.map((p) => {
            const sla = slaFor(p);
            return (
              <Link
                key={p.id}
                href={`/projetos/${p.id}`}
                className="rounded-lg bg-card border border-border p-4 hover:border-primary/40 hover:shadow-sm transition-all"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <ProductBadge line={p.productLine} />
                  <StageBadge label={p.stage.nome} />
                  <StatusBadge status={p.status} />
                  {p.modules.some((m) => m.isAditivo) && <AditivoBadge />}
                </div>
                <p className="mt-2 text-sm font-medium">{p.nome ?? "Implantação"}</p>
                <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                  <SlaChip sla={sla} />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {p.consultant ? `Consultor(a): ${p.consultant.name}` : "Sem consultor alocado"}
                  {" · "}Contrato: {fmtDate(p.dataContrato)}
                </p>
                {p.units.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {p.units.length} unidade{p.units.length === 1 ? "" : "s"}: {p.units.map((u) => u.nome).join(", ")}
                  </p>
                )}
                {p.modules.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Módulos: {p.modules.map((m) => m.moduleTemplate.nome).join(", ")}
                  </p>
                )}
              </Link>
            );
          })}
          {client.projects.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum projeto.</p>
          )}
        </div>
      </section>

      {/* Soluções e serviços contratados */}
      {solucoes.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground/80">Soluções e serviços contratados</h2>
          <div className="bg-card border border-border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="text-left px-4 py-2.5 font-medium">Solução</th>
                  <th className="text-left px-4 py-2.5 font-medium hidden sm:table-cell">Medida</th>
                  <th className="text-right px-4 py-2.5 font-medium">Licença</th>
                  <th className="text-right px-4 py-2.5 font-medium">Manutenção</th>
                </tr>
              </thead>
              <tbody>
                {solucoes.map((s) => (
                  <tr key={s.solucao} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-2.5 font-medium">{s.solucao}</td>
                    <td className="px-4 py-2.5 text-muted-foreground hidden sm:table-cell">{s.medida ?? "-"}</td>
                    <td className="px-4 py-2.5 text-right">{s.licenca > 0 ? brl(s.licenca) : "-"}</td>
                    <td className="px-4 py-2.5 text-right">{s.mensal > 0 ? `${brl(s.mensal)}/mês` : "-"}</td>
                  </tr>
                ))}
                <tr className="bg-muted/40 font-semibold">
                  <td className="px-4 py-2.5" colSpan={2}>Total</td>
                  <td className="px-4 py-2.5 text-right">{brl(licencaTotal)}</td>
                  <td className="px-4 py-2.5 text-right">{brl(mensalidadeTotal)}/mês</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Documentos e anexos */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-sm font-semibold text-foreground/80">Documentos e anexos</h2>
          {client.projects.length > 0 && podeEditar && (
            <form action={uploadDocument} className="flex items-center gap-2">
              {client.projects.length > 1 ? (
                <select name="projectId" className="h-8 rounded-md border border-border bg-card px-2 text-xs">
                  {client.projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome ?? "Implantação"}
                    </option>
                  ))}
                </select>
              ) : (
                <input type="hidden" name="projectId" value={client.projects[0].id} />
              )}
              <FileUploadField label="Anexar documento" />
            </form>
          )}
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          {anexos.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
              <Paperclip className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Nenhum documento anexado ainda.</p>
              <p className="text-xs text-muted-foreground">
                Anexe o contrato assinado, aditivos e comprovantes.
              </p>
            </div>
          ) : (
            <ul className="space-y-1.5">
              {anexos.map((doc) => (
                <li key={doc.id} className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2 flex-wrap">
                  <a
                    href={`/api/documentos/${doc.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-w-0 flex-1 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
                  >
                    <FileText className="h-4 w-4 shrink-0" />
                    <span className="truncate">{doc.filename}</span>
                  </a>
                  <Link
                    href={`/projetos/${doc.projetoId}`}
                    className="text-xs text-muted-foreground hover:text-foreground shrink-0"
                  >
                    {doc.projetoNome}
                  </Link>
                  <span className="text-xs text-muted-foreground shrink-0">{fmtDate(doc.uploadedAt)}</span>
                  <DeleteDocumentButton documentId={doc.id} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <div className="grid lg:grid-cols-2 gap-6 items-start">
        {/* Contratos */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground/80">Contratos</h2>
          {client.contracts.map((c) => (
            <div key={c.id} className="rounded-lg bg-card border border-border p-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-sm font-medium flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  {c.numero}
                </p>
                <span className="text-xs text-muted-foreground">Assinado {fmtDate(c.dataAssinatura)}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {KIND_LABELS[c.kind] ?? c.kind}
                {c.vigenciaMeses ? ` · vigência ${c.vigenciaMeses} meses` : ""}
              </p>
              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                {c.valorLicenca != null && (
                  <p className="text-muted-foreground">Licença: <span className="text-foreground font-medium">{brl(c.valorLicenca)}</span></p>
                )}
                {c.valorMensal != null && (
                  <p className="text-muted-foreground">Manutenção: <span className="text-foreground font-medium">{brl(c.valorMensal)}/mês</span></p>
                )}
                {c.limiteSaasMb != null && (
                  <p className="text-muted-foreground">Limite SaaS: <span className="text-foreground font-medium">{c.limiteSaasMb.toLocaleString("pt-BR")} Mb</span></p>
                )}
                {c.horasTreinamento != null && (
                  <p className="text-muted-foreground">Treinamento: <span className="text-foreground font-medium">{c.horasTreinamento}h</span></p>
                )}
                {c.prazoTreinamentoDias != null && (
                  <p className="text-muted-foreground">Prazo do treinamento: <span className="text-foreground font-medium">{c.prazoTreinamentoDias} dias</span></p>
                )}
                {c.contatoTeknisa && (
                  <p className="text-muted-foreground col-span-2">Comercial: <span className="text-foreground">{c.contatoTeknisa}</span></p>
                )}
              </div>

              <div className="mt-3">
                {podeEditar && (
                <TogglePanel
                  label="Editar contrato"
                  titulo={`Editar ${c.numero}`}
                  variante="discreto"
                  icon={<Pencil className="h-3.5 w-3.5" />}
                >
                  <form action={updateContractAction} className="space-y-3">
                    <input type="hidden" name="contractId" value={c.id} />
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className={label}>Número</label>
                        <input name="numero" defaultValue={c.numero} className={input} />
                      </div>
                      <div className="space-y-1.5">
                        <label className={label}>Data de assinatura</label>
                        <input
                          name="dataAssinatura"
                          type="date"
                          defaultValue={c.dataAssinatura ? new Date(c.dataAssinatura).toISOString().slice(0, 10) : ""}
                          className={input}
                        />
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <label className={label}>Licença (R$)</label>
                        <input name="valorLicenca" inputMode="decimal" defaultValue={c.valorLicenca ?? ""} className={input} />
                      </div>
                      <div className="space-y-1.5">
                        <label className={label}>Mensalidade (R$)</label>
                        <input name="valorMensal" inputMode="decimal" defaultValue={c.valorMensal ?? ""} className={input} />
                      </div>
                      <div className="space-y-1.5">
                        <label className={label}>Vigência (meses)</label>
                        <input name="vigenciaMeses" inputMode="numeric" defaultValue={c.vigenciaMeses ?? ""} className={input} />
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <label className={label}>Treinamento (horas)</label>
                        <input name="horasTreinamento" inputMode="numeric" defaultValue={c.horasTreinamento ?? ""} className={input} />
                      </div>
                      <div className="space-y-1.5">
                        <label className={label}>Prazo do treinamento (dias)</label>
                        <input
                          name="prazoTreinamentoDias"
                          inputMode="numeric"
                          defaultValue={c.prazoTreinamentoDias ?? ""}
                          placeholder="60"
                          className={input}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className={label}>Limite SaaS (Mb)</label>
                        <input name="limiteSaasMb" inputMode="numeric" defaultValue={c.limiteSaasMb ?? ""} className={input} />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className={label}>Comercial responsável</label>
                      <input name="contatoTeknisa" defaultValue={c.contatoTeknisa ?? ""} className={input} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      O <strong>prazo do treinamento</strong> conta a partir da assinatura e define o
                      marco contratual exibido na página do projeto.
                    </p>
                    <div className="flex justify-end">
                      <button className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary-hover">
                        Salvar contrato
                      </button>
                    </div>
                  </form>
                </TogglePanel>
                )}
              </div>
              {c.items.length > 0 && (
                <table className="w-full mt-3 text-xs border-t border-border">
                  <tbody>
                    {c.items.map((i) => (
                      <tr key={i.id} className="border-b border-border/60 last:border-0">
                        <td className="py-1.5 text-muted-foreground">{i.kind === "LICENCA" ? "Licença" : "Manutenção"}</td>
                        <td className="py-1.5">{i.solucao}{i.qtde > 1 ? ` (${i.qtde}x)` : ""}</td>
                        <td className="py-1.5 text-right font-medium">{brl(i.valorTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
          {client.contracts.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum contrato cadastrado.</p>
          )}
        </section>

        {/* Contatos */}
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-foreground/80">Contatos</h2>
          </div>

          {podeEditar && (
          <TogglePanel
            label="Adicionar contato"
            titulo="Novo contato"
            icon={<Plus className="h-4 w-4 text-primary" />}
          >
            <form action={addContactAction} className="space-y-3">
              <input type="hidden" name="clientId" value={client.id} />
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className={label}>Nome</label>
                  <input name="nome" required className={input} />
                </div>
                <div className="space-y-1.5">
                  <label className={label}>Cargo</label>
                  <input name="cargo" placeholder="Sócio, nutricionista, TI" className={input} />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className={label}>Celular ou telefone</label>
                  <MaskedInput name="telefone" mascara="telefone" placeholder="(00) 00000-0000" className={input} />
                </div>
                <div className="space-y-1.5">
                  <label className={label}>Email</label>
                  <input name="email" type="email" placeholder="nome@empresa.com" className={input} />
                </div>
              </div>
              <div className="flex justify-end">
                <button className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary-hover">
                  Adicionar contato
                </button>
              </div>
            </form>
          </TogglePanel>
          )}

          <div className="rounded-lg bg-card border border-border divide-y divide-border">
            {client.contacts.map((ct) => (
              <div key={ct.id} className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{ct.nome}</p>
                    {ct.cargo && <p className="text-xs text-muted-foreground">{ct.cargo}</p>}
                    {/* Telefone e email aparecem sempre, para dar para ver de imediato o que falta. */}
                    <div className="flex gap-x-4 gap-y-1 mt-1.5 text-xs flex-wrap">
                      <span className="inline-flex items-center gap-1">
                        <Phone className="h-3 w-3 text-muted-foreground shrink-0" />
                        {ct.telefone ? (
                          <a href={`tel:${ct.telefone.replace(/[^\d+]/g, "")}`} className="text-accent hover:underline">
                            {ct.telefone}
                          </a>
                        ) : (
                          <span className="text-muted-foreground/60">telefone não informado</span>
                        )}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
                        {ct.email ? (
                          <a href={`mailto:${ct.email}`} className="text-accent hover:underline">
                            {ct.email}
                          </a>
                        ) : (
                          <span className="text-muted-foreground/60">email não informado</span>
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {podeEditar && (
                    <form action={deleteContactAction}>
                      <input type="hidden" name="contactId" value={ct.id} />
                      <button
                        title={`Remover ${ct.nome}`}
                        className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-destructive/30 text-destructive hover:bg-destructive/5"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </form>
                    )}
                  </div>
                </div>

                <div className="mt-2">
                  {podeEditar && (
                  <TogglePanel
                    label="Editar"
                    titulo={`Editar ${ct.nome}`}
                    variante="discreto"
                    icon={<Pencil className="h-3.5 w-3.5" />}
                  >
                    <form action={updateContactAction} className="space-y-3">
                      <input type="hidden" name="contactId" value={ct.id} />
                      <div className="grid sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className={label}>Nome</label>
                          <input name="nome" required defaultValue={ct.nome} className={input} />
                        </div>
                        <div className="space-y-1.5">
                          <label className={label}>Cargo</label>
                          <input name="cargo" defaultValue={ct.cargo ?? ""} className={input} />
                        </div>
                      </div>
                      <div className="grid sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className={label}>Celular ou telefone</label>
                          <MaskedInput name="telefone" mascara="telefone" defaultValue={ct.telefone} placeholder="(00) 00000-0000" className={input} />
                        </div>
                        <div className="space-y-1.5">
                          <label className={label}>Email</label>
                          <input name="email" type="email" defaultValue={ct.email ?? ""} className={input} />
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <button className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary-hover">
                          Salvar contato
                        </button>
                      </div>
                    </form>
                  </TogglePanel>
                  )}
                </div>
              </div>
            ))}
            {client.contacts.length === 0 && (
              <p className="p-3 text-sm text-muted-foreground">Nenhum contato cadastrado.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
