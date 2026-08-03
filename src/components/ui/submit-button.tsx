"use client";

import { useFormStatus } from "react-dom";

// Botão de submit com estado de envio: enquanto a action roda, desabilita e
// troca o rótulo (evita o duplo/triplo clique que duplicava registros quando o
// sistema está lento). O spinner usa a cor do texto do botão (border-current).
export function SubmitButton({
  children,
  pendingLabel,
  className = "",
}: {
  children: React.ReactNode;
  pendingLabel: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`inline-flex items-center justify-center gap-1.5 disabled:opacity-60 disabled:cursor-wait ${className}`}
    >
      {pending && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent opacity-70" />
      )}
      {pending ? pendingLabel : children}
    </button>
  );
}
