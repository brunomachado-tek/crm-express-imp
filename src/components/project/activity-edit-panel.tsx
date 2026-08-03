"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { updateActivity } from "@/lib/actions";
import { GrupoField } from "@/components/project/grupo-field";
import { EnvolvidoField } from "@/components/project/envolvido-field";
import { SubmitButton } from "@/components/ui/submit-button";
import type { Responsavel } from "@prisma/client";

const fieldLabel = "text-xs font-medium text-muted-foreground";
const fieldInput =
  "w-full h-9 rounded-md border border-border bg-muted/50 px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40";

// Edição dos campos de uma atividade já criada, com os mesmos campos da criação.
// Fica recolhido por padrão (o card mostra as tags); "Editar campos" abre o form.
export function ActivityEditPanel({
  activityId,
  titulo,
  descricao,
  horas,
  dueDate,
  responsavel,
  envolvidosCliente,
  assigneeId,
  grupoAtual,
  groups,
  consultants,
  showAssigneeSelect,
}: {
  activityId: string;
  titulo: string;
  descricao: string | null;
  horas: number | null;
  dueDate: string | null;
  responsavel: Responsavel;
  envolvidosCliente: string | null;
  assigneeId: string | null;
  grupoAtual: string;
  groups: string[];
  consultants: { id: string; name: string }[];
  showAssigneeSelect: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <Pencil className="h-3.5 w-3.5" /> {open ? "Cancelar edição" : "Editar campos"}
      </button>

      {open && (
        <form action={updateActivity} className="mt-3 border-t border-border/70 pt-3 space-y-3">
          <input type="hidden" name="activityId" value={activityId} />

          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[240px] space-y-1">
              <span className={fieldLabel}>Título da atividade</span>
              <input name="titulo" defaultValue={titulo} required autoComplete="off" className={fieldInput} />
            </div>
            <div className="w-24 space-y-1">
              <span className={fieldLabel}>Horas</span>
              <input
                name="horas"
                inputMode="decimal"
                defaultValue={horas ?? ""}
                className={fieldInput}
              />
            </div>
            <div className="w-40 space-y-1">
              <span className={fieldLabel}>Entrega</span>
              <input name="dueDate" type="date" defaultValue={dueDate ?? ""} className={fieldInput} />
            </div>
            <div className="w-40 space-y-1">
              <span className={fieldLabel}>Responsável</span>
              <select name="responsavel" defaultValue={responsavel} className={fieldInput}>
                <option value="AMBOS">Ambos</option>
                <option value="TEKNISA">Teknisa</option>
                <option value="CLIENTE">Cliente</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 items-end">
            <GrupoField
              groups={groups}
              labelClass={fieldLabel}
              inputClass={fieldInput}
              defaultValue={grupoAtual}
            />
            <div className="flex-1 min-w-[220px] space-y-1">
              <span className={fieldLabel}>Envolvidos do cliente</span>
              <EnvolvidoField id={`edit-envolvidos-${activityId}`} defaultValue={envolvidosCliente} />
            </div>
            {showAssigneeSelect && (
              <div className="flex-1 min-w-[200px] space-y-1">
                <span className={fieldLabel}>Atribuir a</span>
                <select name="assigneeId" defaultValue={assigneeId ?? ""} className={fieldInput}>
                  <option value="">Ninguém</option>
                  {consultants.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <span className={fieldLabel}>Descrição</span>
            <textarea
              name="descricao"
              rows={2}
              defaultValue={descricao ?? ""}
              className={`${fieldInput} h-auto py-2 resize-y`}
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-9 px-3 rounded-md border border-border text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
            >
              Cancelar
            </button>
            <SubmitButton
              pendingLabel="Salvando..."
              className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary-hover transition-colors"
            >
              Salvar
            </SubmitButton>
          </div>
        </form>
      )}
    </div>
  );
}
