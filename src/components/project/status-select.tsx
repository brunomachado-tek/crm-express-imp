"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { STATUS_LABELS } from "@/lib/format";
import type { ActivityStatus } from "@prisma/client";

const OPTIONS: ActivityStatus[] = ["PENDENTE", "EM_ANDAMENTO", "CONCLUIDA", "CANCELADA"];

// Controlado: o valor exibido acompanha a escolha na hora, e o form é
// enviado no onChange para persistir (o badge do card atualiza na revalidação).
// Enquanto salva, mostra "salvando" e desabilita, para não parecer travado (a
// persistência passa pelo servidor e pode levar 1 a 2 segundos).
export function StatusSelect({ defaultValue }: { defaultValue: ActivityStatus }) {
  const [value, setValue] = useState<ActivityStatus>(defaultValue);
  const { pending } = useFormStatus();

  return (
    <span className="inline-flex items-center gap-2">
      <select
        name="status"
        value={value}
        disabled={pending}
        onChange={(e) => {
          setValue(e.currentTarget.value as ActivityStatus);
          e.currentTarget.form?.requestSubmit();
        }}
        className="h-8 rounded-md border border-border bg-card px-2 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-primary/40 hover:border-primary/40 transition-colors disabled:opacity-60 disabled:cursor-wait"
      >
        {OPTIONS.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABELS[s]}
          </option>
        ))}
      </select>
      {pending && (
        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <span className="h-3 w-3 rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground animate-spin" />
          salvando
        </span>
      )}
    </span>
  );
}
