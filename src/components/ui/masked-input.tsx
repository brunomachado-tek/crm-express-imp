"use client";

import { useState } from "react";

// Máscaras de preenchimento. O valor é formatado enquanto a pessoa digita, e
// o servidor guarda o texto já formatado (a comparação de CNPJ e telefone em
// src/lib/identity.ts ignora a formatação, então isso não atrapalha).

export type Mascara = "cnpj" | "cpf" | "cep" | "telefone" | "cnpjCpf";

function digitos(v: string) {
  return v.replace(/\D/g, "");
}

function aplica(mascara: Mascara, valor: string): string {
  const d = digitos(valor);

  switch (mascara) {
    case "cnpj":
      return d
        .slice(0, 14)
        .replace(/^(\d{2})(\d)/, "$1.$2")
        .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
        .replace(/\.(\d{3})(\d)/, ".$1/$2")
        .replace(/(\d{4})(\d)/, "$1-$2");
    case "cpf":
      return d
        .slice(0, 11)
        .replace(/^(\d{3})(\d)/, "$1.$2")
        .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
        .replace(/\.(\d{3})(\d)/, ".$1-$2");
    case "cnpjCpf":
      return d.length > 11 ? aplica("cnpj", d) : aplica("cpf", d);
    case "cep":
      return d.slice(0, 8).replace(/^(\d{5})(\d)/, "$1-$2");
    case "telefone": {
      const n = d.slice(0, 11);
      if (n.length <= 2) return n.replace(/^(\d{0,2})/, "($1");
      if (n.length <= 6) return n.replace(/^(\d{2})(\d{0,4})/, "($1) $2");
      if (n.length <= 10) return n.replace(/^(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3");
      return n.replace(/^(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3");
    }
    default:
      return valor;
  }
}

export function MaskedInput({
  id,
  name,
  mascara,
  defaultValue,
  placeholder,
  required = false,
  className,
}: {
  id?: string;
  name: string;
  mascara: Mascara;
  defaultValue?: string | null;
  placeholder?: string;
  required?: boolean;
  className?: string;
}) {
  const [valor, setValor] = useState(() => aplica(mascara, defaultValue ?? ""));

  return (
    <input
      id={id}
      name={name}
      required={required}
      value={valor}
      inputMode="numeric"
      placeholder={placeholder}
      onChange={(e) => setValor(aplica(mascara, e.currentTarget.value))}
      className={className}
    />
  );
}
