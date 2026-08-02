import type { Opcao } from "@/lib/intake";

// Campos do formulário de repasse. Tudo server-rendered: o estado visual de
// seleção sai de `peer-checked` no CSS, sem JavaScript no cliente (o
// formulário precisa funcionar bem em qualquer navegador do comercial).

export const campoInput =
  "w-full h-10 rounded-md border border-border bg-muted/50 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40";
export const campoLabel = "text-sm font-medium";
const opcional = <span className="text-muted-foreground font-normal">(opcional)</span>;

export function Campo({
  id,
  label,
  hint,
  opcionalFlag = false,
  children,
}: {
  id?: string;
  label: string;
  hint?: string;
  opcionalFlag?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className={campoLabel}>
        {label} {opcionalFlag && opcional}
      </label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {children}
    </div>
  );
}

export function TextoCurto({
  id,
  name,
  defaultValue,
  placeholder,
  type = "text",
  required = false,
  inputMode,
}: {
  id?: string;
  name: string;
  defaultValue?: string | number | null;
  placeholder?: string;
  type?: string;
  required?: boolean;
  inputMode?: "text" | "numeric" | "tel" | "email";
}) {
  return (
    <input
      id={id}
      name={name}
      type={type}
      required={required}
      inputMode={inputMode}
      defaultValue={defaultValue ?? ""}
      placeholder={placeholder}
      className={campoInput}
    />
  );
}

export function TextoLongo({
  id,
  name,
  defaultValue,
  placeholder,
  rows = 4,
}: {
  id?: string;
  name: string;
  defaultValue?: string | null;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      id={id}
      name={name}
      rows={rows}
      defaultValue={defaultValue ?? ""}
      placeholder={placeholder}
      className="w-full rounded-md border border-border bg-muted/50 px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
    />
  );
}

const cartao =
  "flex items-start gap-2.5 rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary/40 peer-checked:border-primary peer-checked:bg-primary/[0.04] peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40";

// Escolha única em cartões (mais fácil de tocar e ler que um radio solto).
export function EscolhaUnica({
  name,
  opcoes,
  defaultValue,
  colunas = 2,
}: {
  name: string;
  opcoes: Opcao[];
  defaultValue?: string | null;
  colunas?: 1 | 2 | 3;
}) {
  const grid = colunas === 1 ? "grid-cols-1" : colunas === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2";
  return (
    <div className={`grid gap-2 ${grid}`}>
      {opcoes.map((o) => (
        <label key={o.value} className="group cursor-pointer">
          <input
            type="radio"
            name={name}
            value={o.value}
            defaultChecked={defaultValue === o.value}
            className="peer sr-only"
          />
          <span className={cartao}>
            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 border-border group-has-[:checked]:border-primary">
              <span className="h-2 w-2 rounded-full bg-transparent group-has-[:checked]:bg-primary" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium leading-snug">{o.label}</span>
              {o.hint && (
                <span className="block text-xs text-muted-foreground mt-0.5">{o.hint}</span>
              )}
            </span>
          </span>
        </label>
      ))}
    </div>
  );
}

// Escolha múltipla em cartões.
export function EscolhaMultipla({
  name,
  opcoes,
  selecionados = [],
  colunas = 2,
}: {
  name: string;
  opcoes: Opcao[];
  selecionados?: string[];
  colunas?: 1 | 2 | 3;
}) {
  const grid = colunas === 1 ? "grid-cols-1" : colunas === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2";
  return (
    <div className={`grid gap-2 ${grid}`}>
      {opcoes.map((o) => (
        <label key={o.value} className="group cursor-pointer">
          <input
            type="checkbox"
            name={name}
            value={o.value}
            defaultChecked={selecionados.includes(o.value)}
            className="peer sr-only"
          />
          <span className={cartao}>
            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 border-border group-has-[:checked]:border-primary group-has-[:checked]:bg-primary">
              <svg
                viewBox="0 0 12 12"
                className="h-2.5 w-2.5 text-primary-foreground opacity-0 group-has-[:checked]:opacity-100"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M1.5 6.5L4.5 9.5L10.5 2.5" />
              </svg>
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium leading-snug">{o.label}</span>
              {o.hint && (
                <span className="block text-xs text-muted-foreground mt-0.5">{o.hint}</span>
              )}
            </span>
          </span>
        </label>
      ))}
    </div>
  );
}

// Título de bloco dentro de uma etapa (agrupa campos relacionados).
export function BlocoTitulo({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pt-2">
      {children}
    </h3>
  );
}
