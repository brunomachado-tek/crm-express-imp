"use client";

import { useState } from "react";
import { X } from "lucide-react";

// Painel que abre e fecha. Mantém as telas de consulta limpas, com a edição
// a um clique de distância. O conteúdo continua sendo renderizado no servidor
// (vem por `children`), então a lógica de permissão fica no servidor.
export function TogglePanel({
  label,
  titulo,
  icon,
  defaultOpen = false,
  variante = "secundario",
  children,
}: {
  label: string;
  titulo?: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  variante?: "primario" | "secundario" | "discreto";
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  if (!open) {
    const estilo =
      variante === "primario"
        ? "bg-primary text-primary-foreground hover:bg-primary-hover"
        : variante === "discreto"
          ? "text-muted-foreground hover:bg-muted hover:text-foreground"
          : "border border-border hover:bg-muted";
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`h-9 px-3 inline-flex items-center gap-1.5 rounded-md text-sm font-medium transition-colors ${estilo}`}
      >
        {icon}
        {label}
      </button>
    );
  }

  return (
    <div className="w-full rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold inline-flex items-center gap-2">
          {icon}
          {titulo ?? label}
        </p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted transition-colors"
          aria-label="Fechar"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {children}
    </div>
  );
}
