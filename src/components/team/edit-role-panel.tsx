"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Pencil, X } from "lucide-react";
import { updateUserRoleAction } from "@/lib/actions";
import { ROLE_LABELS } from "@/lib/format";
import type { ProductLine, Role, User } from "@prisma/client";

const ROLE_OPTIONS: Role[] = ["DIRETORIA", "COORDENACAO", "CONSULTOR", "CS"];

type TargetUser = Pick<User, "id" | "name" | "role" | "productLine">;

export function EditRolePanel({ targetUser }: { targetUser: TargetUser }) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<Role>(targetUser.role);
  const needsProductLine = role !== "DIRETORIA";

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
        title={`Editar papel de ${targetUser.name}`}
        className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-border text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>

      {/* `open` só vira true depois de um clique, então nunca há portal
          durante a renderização no servidor. A checagem de `document` é a
          garantia de que isso continua valendo. */}
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setOpen(false);
            }}
          >
            <div className="w-full max-w-sm rounded-lg border border-border bg-card p-5 shadow-lg space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Editar papel de {targetUser.name}</p>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <form action={updateUserRoleAction} className="space-y-4">
                <input type="hidden" name="userId" value={targetUser.id} />
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Papel</label>
                  <select
                    name="role"
                    value={role}
                    onChange={(e) => setRole(e.target.value as Role)}
                    className="w-full h-9 rounded-md border border-border bg-muted/50 px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                </div>
                {needsProductLine && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Produto</label>
                    <select
                      name="productLine"
                      defaultValue={targetUser.productLine ?? ""}
                      className="w-full h-9 rounded-md border border-border bg-muted/50 px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    >
                      <option value="">Sem produto</option>
                      <option value={"TECFOOD" satisfies ProductLine}>TecFood</option>
                      <option value={"RETAIL" satisfies ProductLine}>Retail</option>
                    </select>
                  </div>
                )}
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="h-9 px-3 rounded-md text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary-hover transition-colors"
                  >
                    Salvar alterações
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
