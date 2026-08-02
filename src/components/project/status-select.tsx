"use client";

import { useState } from "react";
import { STATUS_LABELS } from "@/lib/format";
import type { ActivityStatus } from "@prisma/client";

const OPTIONS: ActivityStatus[] = ["PENDENTE", "EM_ANDAMENTO", "CONCLUIDA", "CANCELADA"];

// Controlado: o valor exibido acompanha a escolha na hora, e o form é
// enviado no onChange para persistir (o badge do card atualiza na revalidação).
export function StatusSelect({ defaultValue }: { defaultValue: ActivityStatus }) {
  const [value, setValue] = useState<ActivityStatus>(defaultValue);

  return (
    <select
      name="status"
      value={value}
      onChange={(e) => {
        setValue(e.currentTarget.value as ActivityStatus);
        e.currentTarget.form?.requestSubmit();
      }}
      className="h-8 rounded-md border border-border bg-card px-2 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-primary/40 hover:border-primary/40 transition-colors"
    >
      {OPTIONS.map((s) => (
        <option key={s} value={s}>
          {STATUS_LABELS[s]}
        </option>
      ))}
    </select>
  );
}
