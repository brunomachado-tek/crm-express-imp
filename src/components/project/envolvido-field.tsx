"use client";

import { useState } from "react";
import { Undo2 } from "lucide-react";

export const ENVOLVIDO_OPTIONS = [
  "Nutricionista",
  "Comprador",
  "Responsável pelo estoque",
  "Gerente da unidade",
  "Dono do estabelecimento",
  "Contador ou responsável fiscal",
  "Decisor",
  "Equipe operacional",
];

const OUTRO = "__outro__";
const selectClass =
  "w-full h-9 rounded-md border border-border bg-muted/50 px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40";

export function EnvolvidoField({ id, defaultValue }: { id: string; defaultValue?: string | null }) {
  const isPreset = !defaultValue || ENVOLVIDO_OPTIONS.includes(defaultValue);
  const [custom, setCustom] = useState(!isPreset);

  if (custom) {
    return (
      <div className="flex items-center gap-1.5">
        <input
          id={id}
          name="envolvidosCliente"
          defaultValue={defaultValue ?? ""}
          placeholder="Especifique quem participa"
          className={selectClass}
        />
        <button
          type="button"
          onClick={() => setCustom(false)}
          title="Escolher da lista"
          className="h-9 w-9 shrink-0 inline-flex items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted transition-colors"
        >
          <Undo2 className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <select
      id={id}
      name="envolvidosCliente"
      defaultValue={defaultValue ?? ""}
      onChange={(e) => {
        if (e.target.value === OUTRO) setCustom(true);
      }}
      className={selectClass}
    >
      <option value="">Nenhum específico</option>
      {ENVOLVIDO_OPTIONS.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
      <option value={OUTRO}>Outro (especificar)</option>
    </select>
  );
}
