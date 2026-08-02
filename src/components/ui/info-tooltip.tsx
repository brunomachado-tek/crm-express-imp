import { Info } from "lucide-react";

// Tooltip só com CSS (hover e foco pelo teclado), sem posicionamento
// calculado em JavaScript. O handoff registra que UI flutuante com cálculo de
// posição já quebrou no Safari, então aqui o balão é um filho posicionado
// dentro do próprio card.
export function InfoTooltip({
  children,
  label = "Ver detalhes",
}: {
  children: React.ReactNode;
  label?: string;
}) {
  return (
    <span className="relative inline-flex group align-middle shrink-0">
      <button
        type="button"
        aria-label={label}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground/60 hover:text-accent hover:bg-accent/10 focus-visible:ring-2 focus-visible:ring-accent/40 outline-none transition-colors"
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-0 top-7 z-30 w-72 max-w-[70vw] rounded-lg border border-border bg-card p-3 text-xs font-normal leading-relaxed text-foreground/80 shadow-lg opacity-0 invisible translate-y-1 transition-all duration-150 group-hover:opacity-100 group-hover:visible group-hover:translate-y-0 group-focus-within:opacity-100 group-focus-within:visible group-focus-within:translate-y-0"
      >
        {children}
      </span>
    </span>
  );
}
