"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { analisarContratoAction, applyContractToClient } from "@/lib/actions";
import type { LeituraContrato } from "@/lib/contrato-pdf";
import { AlertTriangle, FilePlus2, Loader2, RefreshCw, Upload, X } from "lucide-react";

// Reanexar o contrato de um cliente já cadastrado. Lê o PDF, mostra o que
// encontrou e pergunta antes de mexer em nada: atualizar o cadastro usando o
// contrato como base, ou só guardar o arquivo e manter os dados atuais.
export function ContractReuploadPanel({ clientId }: { clientId: string }) {
  const [lendo, startLendo] = useTransition();
  const [enviando, startEnviando] = useTransition();
  const [dados, setDados] = useState<LeituraContrato | null>(null);
  const [avisos, setAvisos] = useState<string[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!dados) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") fechar();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [dados]);

  function fechar() {
    setDados(null);
    setAvisos([]);
    setArquivo(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function analisar(file: File) {
    setErro(null);
    setArquivo(file);
    const fd = new FormData();
    fd.set("contrato", file);
    startLendo(async () => {
      const r = await analisarContratoAction(fd);
      if (!r.ok) {
        setErro(r.erro);
        setArquivo(null);
        return;
      }
      setDados(r.dados);
      setAvisos(r.avisos);
    });
  }

  function confirmar(modo: "atualizar" | "anexar") {
    if (!arquivo) return;
    const fd = new FormData();
    fd.set("clientId", clientId);
    fd.set("modo", modo);
    fd.set("contrato", arquivo);
    startEnviando(async () => {
      await applyContractToClient(fd);
    });
  }

  const luso = dados?.contratos.find((c) => c.kind === "LUSO") ?? null;

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) analisar(f);
        }}
      />
      <button
        type="button"
        disabled={lendo}
        onClick={() => fileRef.current?.click()}
        className="h-9 px-3 inline-flex items-center gap-1.5 rounded-md border border-border text-sm hover:bg-muted transition-colors disabled:opacity-60"
      >
        {lendo ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Lendo contrato…
          </>
        ) : (
          <>
            <FilePlus2 className="h-4 w-4" /> Atualizar pelo contrato
          </>
        )}
      </button>

      {erro && !lendo && (
        <p className="mt-2 text-xs text-destructive inline-flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5" /> {erro}
        </p>
      )}

      {dados &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget && !enviando) fechar();
            }}
          >
            <div className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-lg space-y-4 max-h-[85vh] overflow-y-auto">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold">Contrato lido. O que fazer com ele?</p>
                <button
                  type="button"
                  onClick={fechar}
                  disabled={enviando}
                  className="h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted transition-colors disabled:opacity-60"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="rounded-md border border-border bg-muted/40 px-3 py-2.5 text-xs space-y-1">
                <p className="font-medium text-foreground">{arquivo?.name}</p>
                <p className="text-muted-foreground">
                  {dados.contratos.map((c) => c.numero).join(" e ")}
                  {luso?.itens.length ? ` · ${luso.itens.length} linhas de serviço` : ""}
                </p>
                {dados.razaoSocial && (
                  <p className="text-muted-foreground">
                    {dados.razaoSocial}
                    {dados.cnpj ? ` · ${dados.cnpj}` : ""}
                  </p>
                )}
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

              <div className="space-y-2.5">
                <div className="rounded-md border border-primary/30 bg-primary/[0.04] p-3">
                  <p className="text-sm font-medium">Atualizar informações com este contrato</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Os dados cadastrais, os contratos e os valores passam a valer pelo que está neste
                    PDF. O que ele não traz fica como está. O arquivo é anexado ao projeto.
                  </p>
                  <button
                    type="button"
                    disabled={enviando}
                    onClick={() => confirmar("atualizar")}
                    className="mt-2.5 h-9 px-4 inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-60"
                  >
                    {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    Atualizar cadastro
                  </button>
                </div>

                <div className="rounded-md border border-border p-3">
                  <p className="text-sm font-medium">Só anexar, manter dados atuais</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Guarda o contrato como anexo do projeto e não altera nenhum dado já cadastrado.
                  </p>
                  <button
                    type="button"
                    disabled={enviando}
                    onClick={() => confirmar("anexar")}
                    className="mt-2.5 h-9 px-4 inline-flex items-center gap-1.5 rounded-md border border-border text-sm font-medium hover:bg-muted transition-colors disabled:opacity-60"
                  >
                    {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    Só anexar
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
