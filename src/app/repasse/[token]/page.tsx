import Image from "next/image";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { backIntakeStep, saveIntakeStep, submitIntake } from "@/lib/actions";
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
  TOTAL_ETAPAS,
  URGENCIA,
  splitChoices,
} from "@/lib/intake";
import {
  BlocoTitulo,
  Campo,
  EscolhaMultipla,
  EscolhaUnica,
  TextoCurto,
  TextoLongo,
  campoInput,
} from "@/components/intake/fields";
import { MaskedInput } from "@/components/ui/masked-input";
import { ArrowLeft, ArrowRight, CheckCircle2, Send } from "lucide-react";

export default async function RepassePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ etapa?: string }>;
}) {
  const { token } = await params;
  const { etapa: etapaParam } = await searchParams;

  const intake = await db.clientIntake.findUnique({
    where: { token },
    include: { project: { include: { client: true } } },
  });
  if (!intake) notFound();

  const cliente = intake.project.client;
  const enviado = intake.status === "ENVIADO" || etapaParam === "enviado";

  // Tela final: confirma o envio e encerra o fluxo.
  if (enviado) {
    return (
      <Shell cliente={cliente.razaoSocial}>
        <div className="bg-card border border-border rounded-lg p-8 text-center">
          <CheckCircle2 className="h-12 w-12 text-success mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-1">Repasse enviado</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            As informações foram para a equipe de implantação da Teknisa. A coordenação assume daqui
            e aciona vocês se faltar algum detalhe. Pode fechar esta página.
          </p>
        </div>
      </Shell>
    );
  }

  // Etapa pedida na URL, limitada ao intervalo válido.
  const pedida = parseInt(etapaParam ?? "1", 10);
  const etapa = Math.min(Math.max(isNaN(pedida) ? 1 : pedida, 1), TOTAL_ETAPAS);
  const passo = INTAKE_STEPS[etapa - 1];
  const pct = Math.round((etapa / TOTAL_ETAPAS) * 100);
  const ultima = etapa === TOTAL_ETAPAS;

  // Módulos contratáveis (a moldura fixa não é escolha do comercial).
  const modulos = await db.moduleTemplate.findMany({
    where: { active: true, productLine: intake.project.productLine, grupo: { not: "FIXO" } },
    orderBy: { ordem: "asc" },
  });

  return (
    <Shell cliente={cliente.razaoSocial}>
      {/* Progresso */}
      <div className="mb-6">
        <div className="flex items-baseline justify-between mb-2">
          <p className="text-sm font-medium">
            Etapa {etapa} de {TOTAL_ETAPAS}
            <span className="text-muted-foreground font-normal"> · {passo.titulo}</span>
          </p>
          <span className="text-xs text-muted-foreground">{pct}%</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <ol className="hidden sm:flex gap-1 mt-3">
          {INTAKE_STEPS.map((s) => (
            <li
              key={s.n}
              className={`flex-1 text-[11px] leading-tight ${
                s.n === etapa
                  ? "text-primary font-semibold"
                  : s.n < etapa
                    ? "text-foreground/60"
                    : "text-muted-foreground/60"
              }`}
            >
              {s.titulo}
            </li>
          ))}
        </ol>
      </div>

      <form
        action={ultima ? submitIntake : saveIntakeStep}
        className="bg-card border border-border rounded-lg p-6 space-y-5"
      >
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="etapa" value={etapa} />

        <div>
          <h2 className="text-lg font-semibold">{passo.titulo}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{passo.descricao}</p>
        </div>

        {etapa === 1 && (
          <>
            <Campo id="razaoSocial" label="Razão social">
              <TextoCurto id="razaoSocial" name="razaoSocial" defaultValue={intake.razaoSocial} required />
            </Campo>
            <Campo id="nomeFantasia" label="Nome fantasia" opcionalFlag>
              <TextoCurto id="nomeFantasia" name="nomeFantasia" defaultValue={intake.nomeFantasia} />
            </Campo>
            <div className="grid sm:grid-cols-2 gap-4">
              <Campo id="cnpj" label="CNPJ">
                <MaskedInput
                  id="cnpj"
                  name="cnpj"
                  mascara="cnpj"
                  defaultValue={intake.cnpj}
                  placeholder="00.000.000/0000-00"
                  className={campoInput}
                />
              </Campo>
              <Campo id="numUnidades" label="Quantas unidades ou lojas">
                <TextoCurto
                  id="numUnidades"
                  name="numUnidades"
                  defaultValue={intake.numUnidades}
                  inputMode="numeric"
                  placeholder="1"
                />
              </Campo>
            </div>

            <BlocoTitulo>Endereço</BlocoTitulo>
            <Campo id="endereco" label="Logradouro">
              <TextoCurto id="endereco" name="endereco" defaultValue={intake.endereco} />
            </Campo>
            <div className="grid sm:grid-cols-3 gap-4">
              <Campo id="cep" label="CEP">
                <MaskedInput
                  id="cep"
                  name="cep"
                  mascara="cep"
                  defaultValue={intake.cep}
                  placeholder="00000-000"
                  className={campoInput}
                />
              </Campo>
              <Campo id="cidade" label="Cidade">
                <TextoCurto id="cidade" name="cidade" defaultValue={intake.cidade} />
              </Campo>
              <Campo id="uf" label="UF">
                <TextoCurto id="uf" name="uf" defaultValue={intake.uf} placeholder="SP" />
              </Campo>
            </div>

            <Campo label="Segmento" hint="O que mais se aproxima da operação do cliente.">
              <EscolhaUnica name="segmento" opcoes={SEGMENTOS} defaultValue={intake.segmento} />
            </Campo>
          </>
        )}

        {etapa === 2 && (
          <>
            <BlocoTitulo>Contato principal</BlocoTitulo>
            <p className="text-xs text-muted-foreground">
              Quem decide e responde pelo projeto do lado do cliente.
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              <Campo id="cpNome" label="Nome">
                <TextoCurto id="cpNome" name="contatoPrincipalNome" defaultValue={intake.contatoPrincipalNome} required />
              </Campo>
              <Campo id="cpCargo" label="Cargo">
                <TextoCurto id="cpCargo" name="contatoPrincipalCargo" defaultValue={intake.contatoPrincipalCargo} placeholder="Sócio, gerente, nutricionista" />
              </Campo>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <Campo id="cpEmail" label="Email">
                <TextoCurto id="cpEmail" name="contatoPrincipalEmail" type="email" inputMode="email" defaultValue={intake.contatoPrincipalEmail} />
              </Campo>
              <Campo id="cpTel" label="Telefone ou WhatsApp">
                <MaskedInput id="cpTel" name="contatoPrincipalTelefone" mascara="telefone" defaultValue={intake.contatoPrincipalTelefone} placeholder="(00) 00000-0000" className={campoInput} />
              </Campo>
            </div>

            <BlocoTitulo>Responsável pela operação</BlocoTitulo>
            <p className="text-xs text-muted-foreground">
              Quem vive a rotina e vai participar dos treinamentos.
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              <Campo id="coNome" label="Nome" opcionalFlag>
                <TextoCurto id="coNome" name="contatoOperacaoNome" defaultValue={intake.contatoOperacaoNome} />
              </Campo>
              <Campo id="coTel" label="Telefone" opcionalFlag>
                <MaskedInput id="coTel" name="contatoOperacaoTelefone" mascara="telefone" defaultValue={intake.contatoOperacaoTelefone} placeholder="(00) 00000-0000" className={campoInput} />
              </Campo>
            </div>

            <BlocoTitulo>Responsável de TI</BlocoTitulo>
            <p className="text-xs text-muted-foreground">
              Quem cuida de internet, equipamentos e certificado digital.
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              <Campo id="tiNome" label="Nome" opcionalFlag>
                <TextoCurto id="tiNome" name="contatoTiNome" defaultValue={intake.contatoTiNome} />
              </Campo>
              <Campo id="tiTel" label="Telefone" opcionalFlag>
                <MaskedInput id="tiTel" name="contatoTiTelefone" mascara="telefone" defaultValue={intake.contatoTiTelefone} placeholder="(00) 00000-0000" className={campoInput} />
              </Campo>
            </div>
          </>
        )}

        {etapa === 3 && (
          <>
            <Campo label="Refeições por dia" hint="Somando todas as unidades.">
              <EscolhaUnica name="refeicoesDia" opcoes={REFEICOES_DIA} defaultValue={intake.refeicoesDia} colunas={3} />
            </Campo>
            <Campo label="Períodos atendidos" hint="Pode marcar mais de um.">
              <EscolhaMultipla name="periodos" opcoes={PERIODOS} selecionados={splitChoices(intake.periodos)} />
            </Campo>
            <Campo label="Tipo de serviço" hint="Pode marcar mais de um.">
              <EscolhaMultipla name="tiposServico" opcoes={TIPOS_SERVICO} selecionados={splitChoices(intake.tiposServico)} />
            </Campo>
            <Campo label="O cliente tem ficha técnica das receitas?">
              <EscolhaUnica name="fichaTecnica" opcoes={FICHA_TECNICA} defaultValue={intake.fichaTecnica} colunas={3} />
            </Campo>
            <Campo label="Tem nutricionista?">
              <EscolhaUnica name="nutricionista" opcoes={NUTRICIONISTA} defaultValue={intake.nutricionista} colunas={3} />
            </Campo>
            <Campo label="Tem produção própria ou cozinha central?">
              <EscolhaUnica name="producaoPropria" opcoes={SIM_NAO} defaultValue={intake.producaoPropria} colunas={2} />
            </Campo>

            <BlocoTitulo>Sistema atual</BlocoTitulo>
            <Campo id="sistemaAtual" label="Qual sistema usa hoje" opcionalFlag>
              <TextoCurto id="sistemaAtual" name="sistemaAtual" defaultValue={intake.sistemaAtual} placeholder="Planilhas, concorrente, nenhum" />
            </Campo>
            <Campo label="Precisa migrar dados do sistema atual?">
              <EscolhaUnica name="migrarDados" opcoes={MIGRAR_DADOS} defaultValue={intake.migrarDados} colunas={3} />
            </Campo>
            <Campo id="contextoOperacao" label="Contexto da operação" opcionalFlag hint="Particularidades que a implantação precisa saber antes do kickoff.">
              <TextoLongo id="contextoOperacao" name="contextoOperacao" defaultValue={intake.contextoOperacao} placeholder="Ex.: opera 24h, tem duas cozinhas, alta rotatividade de equipe" />
            </Campo>
          </>
        )}

        {etapa === 4 && (
          <>
            <Campo label="Módulos e serviços contratados" hint="Marque tudo que entrou no contrato.">
              {modulos.length > 0 ? (
                <EscolhaMultipla
                  name="modulos"
                  opcoes={modulos.map((m) => ({ value: m.id, label: m.nome, hint: m.descricao ?? undefined }))}
                  selecionados={splitChoices(intake.modulos)}
                  colunas={1}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nenhum módulo cadastrado para este produto ainda.
                </p>
              )}
            </Campo>
            <div className="grid sm:grid-cols-2 gap-4">
              <Campo id="numLicencas" label="Quantidade de licenças ou filiais">
                <TextoCurto id="numLicencas" name="numLicencas" inputMode="numeric" defaultValue={intake.numLicencas} />
              </Campo>
              <Campo id="goLiveDesejado" label="Go-live desejado" opcionalFlag>
                <input
                  id="goLiveDesejado"
                  name="goLiveDesejado"
                  type="date"
                  defaultValue={intake.goLiveDesejado ? new Date(intake.goLiveDesejado).toISOString().slice(0, 10) : ""}
                  className="w-full h-10 rounded-md border border-border bg-muted/50 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                />
              </Campo>
            </div>
            <Campo label="Urgência do projeto">
              <EscolhaUnica name="urgencia" opcoes={URGENCIA} defaultValue={intake.urgencia} colunas={3} />
            </Campo>
            <Campo label="Formato do treinamento">
              <EscolhaUnica name="formatoTreinamento" opcoes={FORMATO_TREINAMENTO} defaultValue={intake.formatoTreinamento} colunas={3} />
            </Campo>
            <Campo id="pessoasTreinamento" label="Quantas pessoas serão treinadas" opcionalFlag>
              <TextoCurto id="pessoasTreinamento" name="pessoasTreinamento" inputMode="numeric" defaultValue={intake.pessoasTreinamento} />
            </Campo>
            <Campo id="observacoesContratacao" label="Combinados comerciais" opcionalFlag hint="Promessas, descontos condicionados, escopo negociado à parte.">
              <TextoLongo id="observacoesContratacao" name="observacoesContratacao" defaultValue={intake.observacoesContratacao} rows={3} />
            </Campo>
          </>
        )}

        {etapa === 5 && (
          <>
            <Campo label="Regime tributário">
              <EscolhaUnica name="regimeTributario" opcoes={REGIME_TRIBUTARIO} defaultValue={intake.regimeTributario} colunas={3} />
            </Campo>
            <Campo label="Documentos fiscais emitidos" hint="Pode marcar mais de um.">
              <EscolhaMultipla name="documentosFiscais" opcoes={DOCUMENTOS_FISCAIS} selecionados={splitChoices(intake.documentosFiscais)} colunas={3} />
            </Campo>
            <Campo label="Certificado digital">
              <EscolhaUnica name="certificadoDigital" opcoes={CERTIFICADO_DIGITAL} defaultValue={intake.certificadoDigital} colunas={2} />
            </Campo>
            <Campo id="particularidadesFiscais" label="Particularidades fiscais" opcionalFlag>
              <TextoLongo id="particularidadesFiscais" name="particularidadesFiscais" defaultValue={intake.particularidadesFiscais} rows={3} placeholder="Substituição tributária, benefício fiscal, contador externo" />
            </Campo>

            <BlocoTitulo>Para fechar</BlocoTitulo>
            <Campo id="pontosAtencao" label="Pontos de atenção" opcionalFlag hint="O que pode travar a implantação, na sua leitura.">
              <TextoLongo id="pontosAtencao" name="pontosAtencao" defaultValue={intake.pontosAtencao} rows={3} />
            </Campo>
            <Campo id="observacoesGerais" label="Observações gerais" opcionalFlag>
              <TextoLongo id="observacoesGerais" name="observacoesGerais" defaultValue={intake.observacoesGerais} rows={3} />
            </Campo>
            <Campo id="preenchidoPor" label="Quem preencheu">
              <TextoCurto id="preenchidoPor" name="preenchidoPor" defaultValue={intake.preenchidoPor} required placeholder="Seu nome" />
            </Campo>
          </>
        )}

        <div className="flex items-center justify-between gap-3 pt-4 border-t border-border">
          {etapa > 1 ? (
            <button
              type="submit"
              formAction={backIntakeStep}
              className="h-10 px-4 inline-flex items-center gap-1.5 rounded-md border border-border text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" /> Voltar
            </button>
          ) : (
            <span />
          )}
          <button
            type="submit"
            className="h-10 px-5 inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary-hover transition-colors"
          >
            {ultima ? (
              <>
                <Send className="h-4 w-4" /> Enviar repasse
              </>
            ) : (
              <>
                Continuar <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </form>

      <p className="text-xs text-muted-foreground text-center mt-4">
        Suas respostas ficam salvas a cada etapa. Dá para fechar e voltar depois pelo mesmo link.
      </p>
    </Shell>
  );
}

function Shell({ cliente, children }: { cliente: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <Image
            src="/brand/teknisa.svg"
            alt="Teknisa"
            width={124}
            height={24}
            priority
            className="mx-auto"
          />
          <h1 className="font-display text-xl font-semibold mt-4">Repasse para implantação</h1>
          <p className="text-sm text-muted-foreground mt-1">{cliente}</p>
        </div>
        {children}
      </div>
    </div>
  );
}
