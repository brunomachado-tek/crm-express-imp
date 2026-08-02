"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyLinkButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        // não espera a Promise: em alguns contextos (sem permissão/HTTPS) ela
        // nunca resolve nem rejeita, e travaria o feedback visual. O link já
        // fica visível na tela para copiar manualmente se isso falhar.
        navigator.clipboard?.writeText(text).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="h-8 px-3 inline-flex items-center gap-1.5 rounded-md border border-border text-xs font-medium hover:bg-muted transition-colors shrink-0"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copiado" : "Copiar link"}
    </button>
  );
}
