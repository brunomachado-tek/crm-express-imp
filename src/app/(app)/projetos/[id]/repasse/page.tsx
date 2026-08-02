import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { fmtDate } from "@/lib/format";
import {
  CERTIFICADO_DIGITAL,
  DOCUMENTOS_FISCAIS,
  FICHA_TECNICA,
  FORMATO_TREINAMENTO,
  INTAKE_STEPS,
  MIGRAR_DADOS,
  NUTRICIONISTA,
  PERIODOS,
  REFEICOES_DIA,
  REGIME_TRIBUTARIO,
  SEGMENTOS,
  SIM_NAO,
  TIPOS_SERVICO,
  URGENCIA,
  labelDe,
  labelsDe,
  splitChoices,
} from "@/lib/intake";
import { ArrowLeft, ClipboardList } from "lucide-react";

// Leitura das respostas do repasse dentro do CRM.
function Linha({ rotulo, valor }: { rotulo: string; valor: string | null | undefined }) {
  const vazio = !valor || valor === "não informado";
  return (
    <div className="grid sm:grid-cols-[220px_1fr] gap-1 sm:gap-4 py-2 border-b border-border/60 last:border-0">
      <dt className="text-xs text-muted-foreground sm:pt-0.5">{rotulo}</dt>
      <dd className={`text-sm ${vazio ? "text-muted-foreground/60" : ""}`}>
        {vazio ? "não informado" : valor}
      </dd>
    </div>
  );
}

function Secao({ n, children }: { n: number; children: React.ReactNode }) {
  const passo = INTAKE_STEPS[n - 1];
  return (
    <section className="bg-card border border-border rounded-lg p-5">
      <h2 className="text-sm font-semibold">{passo.titulo}</h2>
      <p className="text-xs text-muted-foreground mt-0.5 mb-3">{passo.descricao}</p>
      <dl>{children}</dl>
    </section>
  );
}

export default async function RepasseRespostasPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;

  const project = await db.project.findUnique({
    where: { id },
    include: { client: true, intake: true },
  });
  if (!project || project.deleted) notFound();
  const intake = project.intake;
  if (!intake) notFound();

  const modulos = await db.moduleTemplate.findMany({
    where: { id: { in: splitChoices(intake.modulos) } },
  });

  const enviado = intake.status === "ENVIADO";

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <Link
          href={`/projetos/${project.id}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ArrowLeft className="h-4 w-4" /> {project.client.razaoSocial}
        </Link>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold inline-flex items-center gap-2">
              <ClipboardList className="h-6 w-6 text-primary" /> Repasse do comercial
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {enviado
                ? `Enviado em ${fmtDate(intake.submittedAt)}${intake.preenchidoPor ? ` por ${intake.preenchidoPor}` : ""}.`
                : "Ainda em preenchimento pelo comercial. O que aparece abaixo já foi salvo."}
            </p>
          </div>
          <span
            className={`text-xs font-semibold rounded-full px-2.5 py-1 shrink-0 ${
              enviado ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
            }`}
          >
            {enviado ? "Recebido" : "Em preenchimento"}
          </span>
        </div>
      </div>

      <Secao n={1}>
        <Linha rotulo="Razão social" valor={intake.razaoSocial} />
        <Linha rotulo="Nome fantasia" valor={intake.nomeFantasia} />
        <Linha rotulo="CNPJ" valor={intake.cnpj} />
        <Linha rotulo="Segmento" valor={intake.segmento ? labelDe(SEGMENTOS, intake.segmento) : null} />
        <Linha rotulo="Unidades ou lojas" valor={intake.numUnidades?.toString()} />
        <Linha
          rotulo="Endereço"
          valor={[intake.endereco, intake.cidade, intake.uf, intake.cep].filter(Boolean).join(", ") || null}
        />
      </Secao>

      <Secao n={2}>
        <Linha
          rotulo="Contato principal"
          valor={
            intake.contatoPrincipalNome
              ? `${intake.contatoPrincipalNome}${intake.contatoPrincipalCargo ? `, ${intake.contatoPrincipalCargo}` : ""}`
              : null
          }
        />
        <Linha rotulo="Email" valor={intake.contatoPrincipalEmail} />
        <Linha rotulo="Telefone" valor={intake.contatoPrincipalTelefone} />
        <Linha
          rotulo="Responsável pela operação"
          valor={
            intake.contatoOperacaoNome
              ? `${intake.contatoOperacaoNome}${intake.contatoOperacaoTelefone ? ` · ${intake.contatoOperacaoTelefone}` : ""}`
              : null
          }
        />
        <Linha
          rotulo="Responsável de TI"
          valor={
            intake.contatoTiNome
              ? `${intake.contatoTiNome}${intake.contatoTiTelefone ? ` · ${intake.contatoTiTelefone}` : ""}`
              : null
          }
        />
      </Secao>

      <Secao n={3}>
        <Linha rotulo="Refeições por dia" valor={intake.refeicoesDia ? labelDe(REFEICOES_DIA, intake.refeicoesDia) : null} />
        <Linha rotulo="Períodos atendidos" valor={intake.periodos ? labelsDe(PERIODOS, intake.periodos) : null} />
        <Linha rotulo="Tipo de serviço" valor={intake.tiposServico ? labelsDe(TIPOS_SERVICO, intake.tiposServico) : null} />
        <Linha rotulo="Ficha técnica" valor={intake.fichaTecnica ? labelDe(FICHA_TECNICA, intake.fichaTecnica) : null} />
        <Linha rotulo="Nutricionista" valor={intake.nutricionista ? labelDe(NUTRICIONISTA, intake.nutricionista) : null} />
        <Linha rotulo="Produção própria" valor={intake.producaoPropria ? labelDe(SIM_NAO, intake.producaoPropria) : null} />
        <Linha rotulo="Sistema atual" valor={intake.sistemaAtual} />
        <Linha rotulo="Migração de dados" valor={intake.migrarDados ? labelDe(MIGRAR_DADOS, intake.migrarDados) : null} />
        <Linha rotulo="Contexto da operação" valor={intake.contextoOperacao} />
      </Secao>

      <Secao n={4}>
        <Linha rotulo="Módulos contratados" valor={modulos.map((m) => m.nome).join(", ") || null} />
        <Linha rotulo="Licenças ou filiais" valor={intake.numLicencas?.toString()} />
        <Linha rotulo="Go-live desejado" valor={intake.goLiveDesejado ? fmtDate(intake.goLiveDesejado) : null} />
        <Linha rotulo="Urgência" valor={intake.urgencia ? labelDe(URGENCIA, intake.urgencia) : null} />
        <Linha rotulo="Treinamento" valor={intake.formatoTreinamento ? labelDe(FORMATO_TREINAMENTO, intake.formatoTreinamento) : null} />
        <Linha rotulo="Pessoas a treinar" valor={intake.pessoasTreinamento?.toString()} />
        <Linha rotulo="Combinados comerciais" valor={intake.observacoesContratacao} />
      </Secao>

      <Secao n={5}>
        <Linha rotulo="Regime tributário" valor={intake.regimeTributario ? labelDe(REGIME_TRIBUTARIO, intake.regimeTributario) : null} />
        <Linha rotulo="Documentos fiscais" valor={intake.documentosFiscais ? labelsDe(DOCUMENTOS_FISCAIS, intake.documentosFiscais) : null} />
        <Linha rotulo="Certificado digital" valor={intake.certificadoDigital ? labelDe(CERTIFICADO_DIGITAL, intake.certificadoDigital) : null} />
        <Linha rotulo="Particularidades fiscais" valor={intake.particularidadesFiscais} />
        <Linha rotulo="Pontos de atenção" valor={intake.pontosAtencao} />
        <Linha rotulo="Observações gerais" valor={intake.observacoesGerais} />
      </Secao>
    </div>
  );
}
