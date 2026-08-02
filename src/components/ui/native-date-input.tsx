"use client";

// Input de data nativo do navegador. O calendário customizado quebrava
// dentro de listas longas (posicionamento absoluto sobrepondo linhas
// vizinhas); o nativo é gerenciado pelo próprio navegador e nunca quebra.
export function NativeDateInput({
  id,
  name,
  defaultValue,
  autoSubmit = false,
  className,
}: {
  id?: string;
  name: string;
  defaultValue?: string | null;
  autoSubmit?: boolean;
  className?: string;
}) {
  return (
    <input
      id={id}
      type="date"
      name={name}
      defaultValue={defaultValue ?? ""}
      onChange={autoSubmit ? (e) => e.currentTarget.form?.requestSubmit() : undefined}
      className={className}
    />
  );
}
