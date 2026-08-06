"use client";

import { Printer } from "lucide-react";

// Aciona o diálogo de impressão do navegador. O usuário escolhe "Salvar como
// PDF" para gerar o arquivo a enviar ao cliente. Some na impressão (.no-print).
export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="no-print inline-flex items-center gap-2 h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary-hover transition-colors"
    >
      <Printer className="h-4 w-4" /> Baixar PDF
    </button>
  );
}
