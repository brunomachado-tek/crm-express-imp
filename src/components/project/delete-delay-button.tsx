"use client";

import { Trash2 } from "lucide-react";
import { deleteDelayJustification } from "@/lib/actions";

export function DeleteDelayButton({ justificativaId }: { justificativaId: string }) {
  return (
    <form
      action={deleteDelayJustification}
      onSubmit={(e) => {
        if (!confirm("Excluir esta justificativa? Ela sai também das métricas de atraso.")) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="justificativaId" value={justificativaId} />
      <button
        type="submit"
        title="Excluir justificativa"
        className="h-6 w-6 inline-flex items-center justify-center rounded-md text-muted-foreground/60 hover:bg-destructive/5 hover:text-destructive transition-colors"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </form>
  );
}
