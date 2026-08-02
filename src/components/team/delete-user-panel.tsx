"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Trash2, X } from "lucide-react";
import { deleteUserAction } from "@/lib/actions";

// Apagar usuário é irreversível e afeta outras pessoas, então segue o padrão do
// projeto: modal centralizado via portal, com as consequências escritas.
export function DeleteUserPanel({
  userId,
  nome,
  projetosAtivos,
  tarefasAbertas,
}: {
  userId: string;
  nome: string;
  projetosAtivos: number;
  tarefasAbertas: number;
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
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={`Apagar ${nome}`}
        className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-destructive/30 text-destructive hover:bg-destructive/5 transition-colors"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>

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

              <div className="text-sm text-muted-foreground space-y-2">
                <p>Ao apagar:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>a pessoa perde o acesso imediatamente e sai das listas da equipe;</li>
                  {projetosAtivos > 0 && (
                    <li>
                      <strong className="text-foreground">
                        {projetosAtivos} projeto{projetosAtivos === 1 ? "" : "s"}
                      </strong>{" "}
                      fica{projetosAtivos === 1 ? "" : "m"} sem consultor e precisa
                      {projetosAtivos === 1 ? "" : "m"} de nova alocação;
                    </li>
                  )}
                  {tarefasAbertas > 0 && (
                    <li>
                      <strong className="text-foreground">
                        {tarefasAbertas} tarefa{tarefasAbertas === 1 ? "" : "s"}
                      </strong>{" "}
                      aberta{tarefasAbertas === 1 ? "" : "s"} fica{tarefasAbertas === 1 ? "" : "m"} sem
                      responsável;
                    </li>
                  )}
                  <li>
                    <strong className="text-foreground">o histórico é preservado com o autor</strong>:
                    comentários, movimentações de etapa, justificativas e tarefas já concluídas
                    continuam no nome dela, para consulta da gestão.
                  </li>
                </ul>
                <p className="text-xs">
                  Se a pessoa só saiu de férias ou mudou de área, prefira editar o papel em vez de apagar.
                </p>
              </div>

              <form action={deleteUserAction} className="flex items-center justify-end gap-2 pt-1">
                <input type="hidden" name="userId" value={userId} />
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="h-9 px-3 rounded-md text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
                >
                  Manter usuário
                </button>
                <button
                  type="submit"
                  className="h-9 px-4 inline-flex items-center gap-1.5 rounded-md bg-destructive text-white text-sm font-medium hover:bg-destructive/90 transition-colors"
                >
                  <Trash2 className="h-4 w-4" /> Apagar {nome}
                </button>
              </form>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
