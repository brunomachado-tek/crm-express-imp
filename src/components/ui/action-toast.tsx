"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle, X } from "lucide-react";
import { OK_MESSAGES, ERRO_MESSAGES } from "@/lib/feedback";

// Toast global de retorno das ações. Toda action redireciona com ?ok=<código> ou
// ?erro=<código>; este componente (montado no layout do app) lê o código, mostra
// a mensagem em qualquer tela e limpa o parâmetro da URL para não repetir ao
// recarregar. Sucesso some sozinho; erro fica até fechar (dá tempo de ler).
export function ActionToast() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const ok = params.get("ok");
  const erro = params.get("erro");
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  // Telas que já têm retorno próprio, mais rico que um toast (o cadastro mostra
  // o link do cliente já existente; a página do cliente e a do projeto têm
  // banners contextuais; a equipe tem esquema próprio de convite). O toast não
  // interfere nelas e cobre todo o resto (pipeline, funil, dashboard, alertas).
  const temRetornoProprio =
    pathname.startsWith("/clientes/") ||
    pathname.startsWith("/projetos/") ||
    pathname === "/equipe";

  useEffect(() => {
    if (temRetornoProprio || (!ok && !erro)) return;
    const texto = ok
      ? OK_MESSAGES[ok] ?? "Feito."
      : ERRO_MESSAGES[erro as string] ?? "Não foi possível concluir a ação.";
    setMsg({ tipo: ok ? "ok" : "erro", texto });

    // remove ok/erro (e n, usado pela importação) da URL sem recarregar a página
    const next = new URLSearchParams(Array.from(params.entries()));
    next.delete("ok");
    next.delete("erro");
    next.delete("n");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ok, erro]);

  useEffect(() => {
    if (msg?.tipo !== "ok") return;
    const t = setTimeout(() => setMsg(null), 4000);
    return () => clearTimeout(t);
  }, [msg]);

  if (!msg) return null;

  const isOk = msg.tipo === "ok";
  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed top-4 right-4 z-50 flex items-start gap-2.5 rounded-lg border px-4 py-3 shadow-lg max-w-sm animate-in fade-in slide-in-from-top-2 duration-200 ${
        isOk
          ? "border-success/30 bg-success/10 text-success"
          : "border-destructive/30 bg-destructive/10 text-destructive"
      }`}
    >
      {isOk ? (
        <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
      ) : (
        <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
      )}
      <p className="text-sm font-medium leading-snug">{msg.texto}</p>
      <button
        type="button"
        aria-label="Fechar"
        onClick={() => setMsg(null)}
        className="ml-1 shrink-0 opacity-60 hover:opacity-100 transition-opacity"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
