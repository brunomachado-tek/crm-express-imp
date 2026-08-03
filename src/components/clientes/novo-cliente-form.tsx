"use client";

import { useRef, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { analisarContratoAction, analisarPlanoAction, createClientProject } from "@/lib/actions";
import type { LeituraContrato } from "@/lib/contrato-pdf";
import type { LeituraPlano } from "@/lib/plano-pdf";
import { AlertTriangle, CheckCircle2, ClipboardList, FileText, Loader2, RotateCcw, Upload } from "lucide-react";

type Grupo = "FIXO" | "BASICO" | "COMPLETO" | "ADICIONAL";
type Modulo = {
  id: string;
  nome: string;
  descricao: string | null;
  productLine: "TECFOOD" | "RETAIL";
  grupo: Grupo;
};
const GRUPO_LABEL: Record<Exclude<Grupo, "FIXO">, string> = {
  BASICO: "Escopo básico",
  COMPLETO: "Escopo completo (adicionais)",
  ADICIONAL: "Produtos adicionais",
};

const input =
  "w-full h-10 rounded-md border border-border bg-muted/50 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40";
const label = "text-sm font-medium";

function brl(v: number | null) {
  return v == null ? "" : String(v).replace(".", ",");
}

export function NovoClienteForm({ modules }: { modules: Modulo[] }) {
  const [lendo, startLendo] = useTransition();
  const [dados, setDados] = useState<LeituraContrato | null>(null);
  const [avisos, setAvisos] = useState<string[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [arquivo, setArquivo] = useState<string | null>(null);
  const [manual, setManual] = useState(false);
  // Trocar a chave remonta os campos, para que os valores lidos do contrato
  // virem os novos `defaultValue` sem precisar controlar campo por campo.
  const [versao, setVersao] = useState(0);
  // Produto e módulos são estado controlado: os botões Básico/Completo e o
  // radio de produto precisam ler e escrever a seleção na hora.
  const [produtoSel, setProdutoSel] = useState<"TECFOOD" | "RETAIL">("TECFOOD");
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);
  // Plano de projeto (opcional): dá os módulos contratados por nome, o
  // usuário-chave, os coordenadores e a previsão de início/término.
  const [lendoPlano, startLendoPlano] = useTransition();
  const [plano, setPlano] = useState<LeituraPlano | null>(null);
  const [planoNome, setPlanoNome] = useState<string | null>(null);
  const [planoAvisos, setPlanoAvisos] = useState<string[]>([]);
  const [planoErro, setPlanoErro] = useState<string | null>(null);
  const [planoModuleIds, setPlanoModuleIds] = useState<string[]>([]);
  const planoRef = useRef<HTMLInputElement>(null);

  // Check List de Aceite (opcional): dá os contatos do cliente (sponsor,
  // representante legal, responsável financeiro, primeiro acesso). Lido no
  // servidor ao cadastrar; aqui só escolhe o arquivo.
  const [checklistNome, setChecklistNome] = useState<string | null>(null);
  const checklistRef = useRef<HTMLInputElement>(null);

  const solucoes = dados?.contratos.flatMap((c) => c.itens.map((i) => i.solucao)) ?? [];
  const luso = dados?.contratos.find((c) => c.kind === "LUSO") ?? null;
  const pronto = !!dados || manual;

  const doProduto = modules.filter((m) => m.productLine === produtoSel);
  const fixos = doProduto.filter((m) => m.grupo === "FIXO");
  const contrataveis = doProduto.filter((m) => m.grupo !== "FIXO");
  const gruposPresentes = (["BASICO", "COMPLETO", "ADICIONAL"] as const).filter((g) =>
    contrataveis.some((m) => m.grupo === g)
  );

  function trocarProduto(line: "TECFOOD" | "RETAIL") {
    setProdutoSel(line);
    setMarcados(new Set()); // módulos são por produto; limpa ao trocar
  }
  function toggleModulo(id: string) {
    setMarcados((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  // Presets de escopo: mexem só em básico/completo e preservam os adicionais
  // (ex.: APP MyMenu marcado à parte). "Completo" é cumulativo (básico + mais).
  function aplicarEscopo(grupos: Grupo[]) {
    setMarcados((prev) => {
      const n = new Set(prev);
      for (const m of contrataveis) if (m.grupo === "BASICO" || m.grupo === "COMPLETO") n.delete(m.id);
      for (const m of contrataveis) if (grupos.includes(m.grupo)) n.add(m.id);
      return n;
    });
  }

  function analisar(file: File) {
    setErro(null);
    setAvisos([]);
    setArquivo(file.name);
    const fd = new FormData();
    fd.set("contrato", file);
    startLendo(async () => {
      const r = await analisarContratoAction(fd);
      if (!r.ok) {
        setErro(r.erro);
        setDados(null);
        return;
      }
      setDados(r.dados);
      setAvisos(r.avisos);
      // O contrato diz o produto (TecFood/Retail). Os módulos funcionais vêm do
      // plano de projeto: se ele já foi lido, mantém a marcação; senão, vazio
      // (o coordenador marca pelos botões Básico/Completo ou anexa o plano).
      setProdutoSel(r.dados.productLine ?? "TECFOOD");
      setMarcados(new Set(planoModuleIds));
      setVersao((v) => v + 1);
    });
  }

  function analisarPlano(file: File) {
    setPlanoErro(null);
    const fd = new FormData();
    fd.set("plano", file);
    startLendoPlano(async () => {
      const r = await analisarPlanoAction(fd);
      if (!r.ok) {
        setPlanoErro(r.erro);
        setPlano(null);
        return;
      }
      setPlano(r.dados);
      setPlanoNome(file.name);
      setPlanoAvisos(r.avisos);
      setPlanoModuleIds(r.moduleIds);
      // O plano é sempre TecFood; marca os módulos que ele declara.
      setProdutoSel("TECFOOD");
      setMarcados(new Set(r.moduleIds));
    });
  }

  function recomecar() {
    setDados(null);
    setAvisos([]);
    setErro(null);
    setArquivo(null);
    setManual(false);
    setProdutoSel("TECFOOD");
    setMarcados(new Set());
    setPlano(null);
    setPlanoNome(null);
    setPlanoAvisos([]);
    setPlanoErro(null);
    setPlanoModuleIds([]);
    if (fileRef.current) fileRef.current.value = "";
    if (planoRef.current) planoRef.current.value = "";
    setVersao((v) => v + 1);
  }

  return (
    <form action={createClientProject} className="space-y-5">
      {/* Passo 1: o contrato. Fica fora do bloco remontado para que o arquivo
          escolhido continue no formulário e seja enviado junto no cadastro. */}
      <section className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <FileText className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold">Contrato assinado</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Anexe o PDF do contrato que o comercial enviou. Os dados do cliente, os valores e o
              prazo de treinamento são lidos dele e preenchem o cadastro.
            </p>

            <input
              ref={fileRef}
              type="file"
              name="contrato"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) analisar(f);
              }}
            />

            {!dados && !lendo && (
              <div className="mt-4 flex items-center gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="h-10 px-4 inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary-hover transition-colors"
                >
                  <Upload className="h-4 w-4" /> Escolher o contrato em PDF
                </button>
                {!manual && (
                  <button
                    type="button"
                    onClick={() => {
                      setManual(true);
                      setVersao((v) => v + 1);
                    }}
                    className="text-sm text-muted-foreground hover:text-foreground underline"
                  >
                    Não tenho o PDF, preencher manualmente
                  </button>
                )}
              </div>
            )}

            {lendo && (
              <div className="mt-4" aria-live="polite">
                <p className="text-sm font-medium inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  Lendo {arquivo}
                </p>
                {/* Barra indeterminada: a leitura leva poucos segundos e não
                    tem progresso real para medir, então a animação sinaliza
                    que o sistema está trabalhando, sem fingir porcentagem. */}
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full w-1/3 rounded-full bg-primary animate-[carregando_1.1s_ease-in-out_infinite]" />
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">
                  Extraindo dados cadastrais, contratos, valores e prazos.
                </p>
              </div>
            )}

            {erro && !lendo && (
              <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <p>{erro}</p>
                  <button
                    type="button"
                    onClick={recomecar}
                    className="underline font-medium mt-1 inline-block"
                  >
                    Escolher outro arquivo
                  </button>
                </div>
              </div>
            )}

            {dados && !lendo && (
              <div className="mt-4 space-y-3">
                <div className="rounded-md border border-success/30 bg-success/5 px-3 py-2.5">
                  <p className="text-sm font-medium text-success inline-flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" /> Contrato lido: {arquivo}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {dados.contratos.map((c) => c.numero).join(" e ")}
                    {luso?.itens.length ? ` · ${luso.itens.length} linhas de serviço` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Confira os campos abaixo antes de cadastrar. Tudo é editável, e o PDF fica
                    anexado ao projeto.
                  </p>
                </div>

                {avisos.map((a) => (
                  <p
                    key={a}
                    className="rounded-md border border-warning-bg/40 bg-warning-bg/10 px-3 py-2 text-xs text-warning flex items-start gap-2"
                  >
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    {a}
                  </p>
                ))}

                <button
                  type="button"
                  onClick={recomecar}
                  className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Trocar o contrato
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Passo 2: plano de projeto (opcional). Traz os módulos contratados por
          nome, o usuário-chave e a previsão de início/término. */}
      <section className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
            <ClipboardList className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold">
              Plano de projeto <span className="text-muted-foreground font-normal">(opcional)</span>
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Anexe também o plano de projeto. É dele que saem os módulos contratados, o usuário-chave
              e a previsão de início e término.
            </p>

            <input
              ref={planoRef}
              type="file"
              name="plano"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) analisarPlano(f);
              }}
            />

            {!plano && !lendoPlano && (
              <button
                type="button"
                onClick={() => planoRef.current?.click()}
                className="mt-4 h-10 px-4 inline-flex items-center gap-2 rounded-md border border-border text-sm font-medium hover:bg-muted transition-colors"
              >
                <Upload className="h-4 w-4" /> Escolher o plano de projeto
              </button>
            )}

            {lendoPlano && (
              <div className="mt-4" aria-live="polite">
                <p className="text-sm font-medium inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-accent" /> Lendo o plano de projeto
                </p>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full w-1/3 rounded-full bg-accent animate-[carregando_1.1s_ease-in-out_infinite]" />
                </div>
              </div>
            )}

            {planoErro && !lendoPlano && (
              <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <p>{planoErro}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setPlanoErro(null);
                      if (planoRef.current) planoRef.current.value = "";
                    }}
                    className="underline font-medium mt-1 inline-block"
                  >
                    Escolher outro arquivo
                  </button>
                </div>
              </div>
            )}

            {plano && !lendoPlano && (
              <div className="mt-4 space-y-3">
                <div className="rounded-md border border-success/30 bg-success/5 px-3 py-2.5">
                  <p className="text-sm font-medium text-success inline-flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" /> Plano lido: {planoNome}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {planoModuleIds.length} módulo{planoModuleIds.length === 1 ? "" : "s"} marcado
                    {planoModuleIds.length === 1 ? "" : "s"} abaixo
                    {plano.usuarioChaveNome ? ` · usuário-chave: ${plano.usuarioChaveNome}` : ""}
                    {plano.previsaoInicio && plano.previsaoTermino
                      ? ` · previsão ${plano.previsaoInicio.split("-").reverse().join("/")} a ${plano.previsaoTermino
                          .split("-")
                          .reverse()
                          .join("/")}`
                      : ""}
                  </p>
                </div>

                {planoAvisos.map((a) => (
                  <p
                    key={a}
                    className="rounded-md border border-warning-bg/40 bg-warning-bg/10 px-3 py-2 text-xs text-warning flex items-start gap-2"
                  >
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    {a}
                  </p>
                ))}

                <button
                  type="button"
                  onClick={() => {
                    setPlano(null);
                    setPlanoNome(null);
                    setPlanoAvisos([]);
                    setPlanoModuleIds([]);
                    setMarcados(new Set());
                    if (planoRef.current) planoRef.current.value = "";
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Trocar o plano
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="bg-card border border-border rounded-lg p-6">
        <div className="flex gap-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
            <ClipboardList className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold">
              Check List de Aceite <span className="text-muted-foreground font-normal">(opcional)</span>
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Anexe o Check List de Aceite. Dele saem os contatos do cliente (sponsor, representante
              legal, responsável financeiro, primeiro acesso), que completam o perfil.
            </p>

            <input
              ref={checklistRef}
              type="file"
              name="checklist"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setChecklistNome(f.name);
              }}
            />

            {!checklistNome ? (
              <button
                type="button"
                onClick={() => checklistRef.current?.click()}
                className="mt-4 h-10 px-4 inline-flex items-center gap-2 rounded-md border border-border text-sm font-medium hover:bg-muted transition-colors"
              >
                <Upload className="h-4 w-4" /> Escolher o Check List de Aceite
              </button>
            ) : (
              <div className="mt-4 rounded-md border border-success/30 bg-success/5 px-3 py-2.5">
                <p className="text-sm font-medium text-success inline-flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" /> Anexado: {checklistNome}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setChecklistNome(null);
                    if (checklistRef.current) checklistRef.current.value = "";
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 mt-2"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Trocar
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {pronto && (
        <div key={versao} className="bg-card border border-border rounded-lg p-6 space-y-6">
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-foreground/80">Cliente</h2>
            <div className="space-y-1.5">
              <label htmlFor="razaoSocial" className={label}>
                Razão social
              </label>
              <input
                id="razaoSocial"
                name="razaoSocial"
                required
                defaultValue={dados?.razaoSocial ?? ""}
                className={input}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="cnpj" className={label}>
                  CNPJ
                </label>
                <input
                  id="cnpj"
                  name="cnpj"
                  defaultValue={dados?.cnpj ?? ""}
                  placeholder="00.000.000/0000-00"
                  className={input}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="propostaNumero" className={label}>
                  Nº da proposta
                </label>
                <input
                  id="propostaNumero"
                  name="propostaNumero"
                  defaultValue={dados?.propostaNumero ?? ""}
                  placeholder="ex.: 037472"
                  className={input}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="endereco" className={label}>
                Endereço
              </label>
              <input id="endereco" name="endereco" defaultValue={dados?.endereco ?? ""} className={input} />
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="cep" className={label}>
                  CEP
                </label>
                <input id="cep" name="cep" defaultValue={dados?.cep ?? ""} className={input} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <label htmlFor="cidade" className={label}>
                  Cidade
                </label>
                <input id="cidade" name="cidade" defaultValue={dados?.cidade ?? ""} className={input} />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="uf" className={label}>
                  UF
                </label>
                <input
                  id="uf"
                  name="uf"
                  maxLength={2}
                  defaultValue={dados?.uf ?? ""}
                  placeholder="SP"
                  className={input}
                />
              </div>
            </div>
          </section>

          <section className="space-y-4 border-t border-border pt-5">
            <h2 className="text-sm font-semibold text-foreground/80">Contrato</h2>

            {dados ? (
              // Com o PDF lido, os números vêm do documento e não são digitados.
              <div className="rounded-md border border-border bg-muted/40 px-3 py-2.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Contratos do documento
                </p>
                <ul className="mt-1 space-y-0.5">
                  {dados.contratos.map((c) => (
                    <li key={c.numero} className="text-sm">
                      <span className="font-medium">{c.numero}</span>
                      <span className="text-muted-foreground">
                        {c.vigenciaMeses ? ` · vigência ${c.vigenciaMeses} meses` : ""}
                        {c.limiteSaasMb ? ` · limite ${c.limiteSaasMb.toLocaleString("pt-BR")} MB` : ""}
                        {c.horasTreinamento ? ` · ${c.horasTreinamento}h de treinamento` : ""}
                        {c.prazoTreinamentoDias ? ` em até ${c.prazoTreinamentoDias} dias` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="space-y-1.5">
                <label htmlFor="numeroContrato" className={label}>
                  Nº do contrato <span className="text-muted-foreground font-normal">(opcional)</span>
                </label>
                <input
                  id="numeroContrato"
                  name="numeroContrato"
                  placeholder="LUSO-2026..."
                  className={input}
                />
              </div>
            )}

            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="dataAssinatura" className={label}>
                  Assinatura
                </label>
                <input
                  id="dataAssinatura"
                  name="dataAssinatura"
                  type="date"
                  defaultValue={dados?.dataAssinatura ?? ""}
                  className={input}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="valorLicenca" className={label}>
                  Licença (R$)
                </label>
                <input
                  id="valorLicenca"
                  name="valorLicenca"
                  inputMode="decimal"
                  defaultValue={brl(luso?.valorLicenca ?? null)}
                  placeholder="2300"
                  className={input}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="valorMensal" className={label}>
                  Mensalidade (R$)
                </label>
                <input
                  id="valorMensal"
                  name="valorMensal"
                  inputMode="decimal"
                  defaultValue={brl(luso?.valorMensal ?? null)}
                  placeholder="497"
                  className={input}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="contatoTeknisa" className={label}>
                  Comercial
                </label>
                <input
                  id="contatoTeknisa"
                  name="contatoTeknisa"
                  defaultValue={dados?.contatoTeknisa ?? ""}
                  placeholder="Quem vendeu"
                  className={input}
                />
              </div>
            </div>

            {luso && luso.itens.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                  Soluções contratadas, lidas do contrato
                </p>
                <div className="overflow-x-auto rounded-md border border-border">
                  <table className="w-full text-xs">
                    <tbody className="divide-y divide-border">
                      {luso.itens.map((i, n) => (
                        <tr key={`${i.kind}-${i.solucao}-${n}`}>
                          <td className="px-3 py-1.5">{i.solucao}</td>
                          <td className="px-3 py-1.5 text-muted-foreground">{i.tipoMedida ?? "-"}</td>
                          <td className="px-3 py-1.5 text-muted-foreground">
                            {i.kind === "LICENCA" ? "Licença" : "Manutenção"}
                          </td>
                          <td className="px-3 py-1.5 text-right">
                            {i.valorTotal?.toLocaleString("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>

          <section className="space-y-3 border-t border-border pt-5">
            <h2 className="text-sm font-semibold text-foreground/80">Produto e módulos contratados</h2>
            <p className="text-xs text-muted-foreground">
              Os módulos marcados definem as atividades do cronograma do consultor. O contrato vende
              o produto, mas não lista os módulos funcionais: marque o escopo contratado.
            </p>
            {solucoes.length > 0 && (
              <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs">
                <span className="font-medium">No contrato:</span>{" "}
                {[...new Set(solucoes)].join(", ")}
              </p>
            )}

            {/* Produto */}
            <div className="flex gap-2">
              {(["TECFOOD", "RETAIL"] as const).map((line) => (
                <label
                  key={line}
                  className={`flex-1 flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium cursor-pointer transition-colors ${
                    produtoSel === line ? "border-primary bg-primary/5 text-primary" : "border-border"
                  }`}
                >
                  <input
                    type="radio"
                    name="productLine"
                    value={line}
                    required
                    checked={produtoSel === line}
                    onChange={() => trocarProduto(line)}
                    className="accent-[#040486]"
                  />
                  {line === "TECFOOD" ? "TecFood Express" : "Retail Express"}
                </label>
              ))}
            </div>

            {/* Módulos ocultos para o submit: um input por id marcado. Os
                checkboxes visíveis são controlados; estes carregam a seleção. */}
            {[...marcados].map((id) => (
              <input key={id} type="hidden" name="modules" value={id} />
            ))}

            {/* Moldura fixa: entra sempre, não é selecionável. */}
            {fixos.length > 0 && (
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground/70">Sempre incluído:</span>{" "}
                {fixos.map((m) => m.nome).join(", ")}.
              </p>
            )}

            {/* Presets de escopo */}
            {gruposPresentes.includes("BASICO") && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground">Marcar rápido:</span>
                <button
                  type="button"
                  onClick={() => aplicarEscopo(["BASICO"])}
                  className="h-8 px-3 rounded-md border border-border text-xs font-medium hover:bg-muted transition-colors"
                >
                  Básico
                </button>
                {gruposPresentes.includes("COMPLETO") && (
                  <button
                    type="button"
                    onClick={() => aplicarEscopo(["BASICO", "COMPLETO"])}
                    className="h-8 px-3 rounded-md border border-border text-xs font-medium hover:bg-muted transition-colors"
                  >
                    Completo
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setMarcados(new Set())}
                  className="h-8 px-3 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Limpar
                </button>
              </div>
            )}

            {/* Módulos contratáveis, agrupados */}
            {contrataveis.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Escopo deste produto ainda não cadastrado.
              </p>
            ) : (
              <div className="space-y-4">
                {gruposPresentes.map((g) => (
                  <div key={g}>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                      {GRUPO_LABEL[g]}
                    </p>
                    <div className="grid sm:grid-cols-2 gap-1.5">
                      {contrataveis
                        .filter((m) => m.grupo === g)
                        .map((m) => (
                          <label
                            key={m.id}
                            className="flex items-start gap-2 text-sm text-foreground/80 rounded-md px-2 py-1.5 hover:bg-muted/50 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={marcados.has(m.id)}
                              onChange={() => toggleModulo(m.id)}
                              className="mt-0.5 accent-[#040486]"
                            />
                            <span>
                              {m.nome}
                              {m.descricao && (
                                <span className="block text-xs text-muted-foreground">{m.descricao}</span>
                              )}
                            </span>
                          </label>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="flex justify-end gap-3 border-t border-border pt-5">
            <SubmitButton />
          </div>
        </div>
      )}
    </form>
  );
}

// Estado de carregamento do envio: desabilita o botão e troca o texto enquanto a
// action roda. Evita o duplo clique (que criava o cliente e depois acusava CNPJ
// já cadastrado) e mostra que o cadastro está em andamento, que pode demorar
// alguns segundos por causa da leitura dos PDFs e da gravação dos anexos.
function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-10 px-5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2"
    >
      {pending && (
        <span className="h-4 w-4 rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground animate-spin" />
      )}
      {pending ? "Cadastrando..." : "Cadastrar cliente"}
    </button>
  );
}
