"use client";

import { useRef, useState } from "react";
import { Loader2, Sheet } from "lucide-react";
import { importarCronograma } from "@/lib/actions";

// Importa a planilha de cronograma (Excel) das consultoras. Auto-submete ao
// escolher o arquivo, no padrão de campo único do projeto (sem botão de
// confirmar). A action lê a aba CRONOGRAMA e cria as atividades.
export function ImportCronogramaButton({ projectId }: { projectId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);

  return (
    <form action={importarCronograma}>
      <input type="hidden" name="projectId" value={projectId} />
      <input
        ref={inputRef}
        type="file"
        name="planilha"
        accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={(e) => {
          if (!e.target.files?.[0]) return;
          setEnviando(true);
          e.currentTarget.form?.requestSubmit();
        }}
      />
      <button
        type="button"
        disabled={enviando}
        onClick={() => inputRef.current?.click()}
        className="h-8 px-3 inline-flex items-center gap-1.5 rounded-md border border-border text-xs font-medium hover:bg-muted transition-colors disabled:opacity-60"
      >
        {enviando ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Importando…
          </>
        ) : (
          <>
            <Sheet className="h-3.5 w-3.5" /> Importar planilha
          </>
        )}
      </button>
    </form>
  );
}
