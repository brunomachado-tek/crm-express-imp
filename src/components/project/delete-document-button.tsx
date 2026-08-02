"use client";

import { Trash2 } from "lucide-react";
import { deleteDocument } from "@/lib/actions";

export function DeleteDocumentButton({ documentId }: { documentId: string }) {
  return (
    <form
      action={deleteDocument}
      onSubmit={(e) => {
        if (!confirm("Excluir este documento? Essa ação não pode ser desfeita.")) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="documentId" value={documentId} />
      <button
        type="submit"
        title="Excluir documento"
        className="h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors shrink-0"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </form>
  );
}
