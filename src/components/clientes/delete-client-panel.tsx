"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Archive, Trash2, X } from "lucide-react";
import { archiveClientAction, hardDeleteClientAction } from "@/lib/actions";

// Apagar cliente afeta projetos e histórico, então segue o padrão do projeto:
// modal centralizado via portal, com as consequências escritas. Duas ações:
// arquivar (padrão, reversível) e apagar em definitivo (só diretoria).
export function DeleteClientPanel({
  clientId,
  nome,
  projetos,
  contratos,
  canHardDelete,
  variant = "botao",
}: {
  clientId: string;
  nome: string;
  projetos: number;
  contratos: number;
  canHardDelete: boolean;
  // "botao" = botão com rótulo (página do cliente); "icone" = só a lixeira (lista)
  variant?: "botao" | "icone";
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      {variant === "icone" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          title={`Apagar ${nome}`}
          className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-destructive/30 text-destructive hover:bg-destructive/5 transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="h-9 px-3 inline-flex items-center gap-1.5 rounded-md border border-destructive/30 text-destructive text-sm hover:bg-destructive/5 transition-colors"
        >
          <Trash2 className="h-4 w-4" /> Apagar cliente
        </button>
      )}

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setOpen(false);
            }}
          >
            <div className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-lg space-y-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold inline-flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" /> Apagar {nome}
                </p>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="text-sm text-muted-foreground space-y-3">
                <div className="rounded-md border border-border bg-muted/40 p-3">
                  <p className="font-medium text-foreground inline-flex items-center gap-2">
                    <Archive className="h-4 w-4" /> Arquivar
                  </p>
                  <p className="mt-1 text-xs">
                    O cliente e seus{" "}
                    <strong className="text-foreground">
                      {projetos} projeto{projetos === 1 ? "" : "s"}
                    </strong>{" "}
                    somem das listas, do funil e do dashboard, mas o registro, os {contratos} contrato
                    {contratos === 1 ? "" : "s"} e o histórico continuam guardados. Dá para restaurar
                    depois.
                  </p>
                  <form action={archiveClientAction} className="mt-2.5">
                    <input type="hidden" name="clientId" value={clientId} />
                    <button
                      type="submit"
                      className="h-9 px-4 inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary-hover transition-colors"
                    >
                      <Archive className="h-4 w-4" /> Arquivar cliente
                    </button>
                  </form>
                </div>

                {canHardDelete && (
                  <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
                    <p className="font-medium text-destructive inline-flex items-center gap-2">
                      <Trash2 className="h-4 w-4" /> Apagar em definitivo
                    </p>
                    <p className="mt-1 text-xs">
                      Remove o cliente e tudo ligado a ele: projetos, contratos, atividades, anexos e
                      histórico. <strong className="text-foreground">Não tem volta.</strong> Use só
                      para cadastro de teste ou erro claro.
                    </p>
                    <form action={hardDeleteClientAction} className="mt-2.5">
                      <input type="hidden" name="clientId" value={clientId} />
                      <button
                        type="submit"
                        className="h-9 px-4 inline-flex items-center gap-1.5 rounded-md bg-destructive text-white text-sm font-medium hover:bg-destructive/90 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" /> Apagar em definitivo
                      </button>
                    </form>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-1 border-t border-border">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="h-9 px-3 rounded-md text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
