"use client";

import { useRef, useState } from "react";

// Textarea com autocomplete de @menção. Ao digitar "@" seguido de letras, mostra
// um dropdown com os nomes do time; ao escolher, insere "@Primeiro nome" (o
// backend casa a menção pelo primeiro nome). Uncontrolled: o valor vai no submit
// pelo próprio DOM (name), então setar `.value` direto funciona.
export function MentionTextarea({
  name,
  defaultValue,
  placeholder,
  className,
  users,
}: {
  name: string;
  defaultValue?: string;
  placeholder?: string;
  className?: string;
  users: { id: string; name: string }[];
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [inicio, setInicio] = useState(0); // posição do "@"

  function onChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const pos = e.target.selectionStart ?? 0;
    const antes = e.target.value.slice(0, pos);
    const m = antes.match(/@([\p{L}]*)$/u);
    if (m) {
      setQuery(m[1].toLowerCase());
      setInicio(pos - m[0].length);
      setOpen(true);
    } else {
      setOpen(false);
    }
  }

  const norm = (s: string) =>
    s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const sugestoes = open
    ? users.filter((u) => norm(u.name).includes(norm(query))).slice(0, 6)
    : [];

  function escolher(u: { id: string; name: string }) {
    const ta = ref.current;
    if (!ta) return;
    const primeiro = u.name.split(" ")[0];
    const pos = ta.selectionStart ?? ta.value.length;
    const novo = `${ta.value.slice(0, inicio)}@${primeiro} ${ta.value.slice(pos)}`;
    ta.value = novo;
    const cursor = inicio + primeiro.length + 2;
    ta.focus();
    ta.setSelectionRange(cursor, cursor);
    setOpen(false);
  }

  return (
    <div className="relative">
      <textarea
        ref={ref}
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        autoComplete="off"
        onChange={onChange}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className={className}
      />
      {open && sugestoes.length > 0 && (
        <ul className="absolute z-30 left-0 mt-1 w-60 max-h-52 overflow-auto rounded-md border border-border bg-card shadow-lg">
          {sugestoes.map((u) => (
            <li key={u.id}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  escolher(u);
                }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-1.5"
              >
                <span className="text-accent font-semibold">@</span>
                {u.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
