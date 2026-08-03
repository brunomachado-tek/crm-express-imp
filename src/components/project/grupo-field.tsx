"use client";

import { useState } from "react";

const NOVO = "__novo__";

// Escolha do grupo (fase) ao criar uma atividade: seleciona um grupo existente,
// ou "Criar novo grupo" para digitar um nome. A action lê `grupo` e `novoGrupo`.
export function GrupoField({
  groups,
  labelClass,
  inputClass,
}: {
  groups: string[];
  labelClass: string;
  inputClass: string;
}) {
  const [sel, setSel] = useState("");

  return (
    <div className="flex-1 min-w-[220px] space-y-1">
      <label htmlFor="nova-grupo" className={labelClass}>
        Grupo
      </label>
      <select
        id="nova-grupo"
        name="grupo"
        value={sel}
        onChange={(e) => setSel(e.target.value)}
        className={inputClass}
      >
        <option value="">Sem grupo (Outras atividades)</option>
        {groups.map((g) => (
          <option key={g} value={g}>
            {g}
          </option>
        ))}
        <option value={NOVO}>＋ Criar novo grupo</option>
      </select>
      {sel === NOVO && (
        <input
          name="novoGrupo"
          required
          placeholder="Nome do novo grupo"
          autoComplete="off"
          className={`${inputClass} mt-1`}
        />
      )}
    </div>
  );
}
