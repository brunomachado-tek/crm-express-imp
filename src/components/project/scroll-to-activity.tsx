"use client";

import { useEffect } from "react";

// Ao abrir a página do projeto vindo de uma notificação de menção (link com
// #atividade-<id>), abre o grupo (details) da atividade, rola até ela e dá um
// destaque temporário. Sem isso o link caía na lista genérica de atividades.
export function ScrollToActivity() {
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.startsWith("#atividade-")) return;
    const alvo = document.getElementById(hash.slice(1));
    if (!alvo) return;

    // abre todos os <details> ancestrais (o grupo pode estar recolhido)
    let p: HTMLElement | null = alvo.parentElement;
    while (p) {
      if (p.tagName === "DETAILS") (p as HTMLDetailsElement).open = true;
      p = p.parentElement;
    }

    // espera o layout reagir à abertura dos grupos antes de rolar
    requestAnimationFrame(() => {
      alvo.scrollIntoView({ behavior: "smooth", block: "center" });
      alvo.classList.add("ring-2", "ring-primary", "ring-offset-2");
      setTimeout(() => alvo.classList.remove("ring-2", "ring-primary", "ring-offset-2"), 2600);
    });
  }, []);

  return null;
}
