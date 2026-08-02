"use client";

import { Trash2 } from "lucide-react";
import { deleteActivity } from "@/lib/actions";

export function DeleteActivityButton({ activityId }: { activityId: string }) {
  return (
    <form
      action={deleteActivity}
      onSubmit={(e) => {
        if (!confirm("Excluir esta atividade? Essa ação não pode ser desfeita.")) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="activityId" value={activityId} />
      <button
        type="submit"
        title="Excluir atividade"
        className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-border text-muted-foreground hover:border-destructive/40 hover:bg-destructive/5 hover:text-destructive transition-colors"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </form>
  );
}
