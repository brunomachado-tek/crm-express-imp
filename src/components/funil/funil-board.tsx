"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { moveStage, toggleChecklist } from "@/lib/actions";
import { SlaChip, StatusBadge, AditivoBadge } from "@/components/badges";
import { brl } from "@/lib/format";
import type { SlaInfo } from "@/lib/sla";
import type { ProjectStatus } from "@prisma/client";
import { AlertTriangle, ArrowRight, Check, GripVertical, Lock, MapPin, UserRound, X } from "lucide-react";

export type EtapaBoard = { id: string; nome: string; ordem: number };
export type ItemChecklist = { id: string; titulo: string; done: boolean };
export type CardBoard = {
  id: string;
  stageId: string;
  cliente: string;
  cidade: string | null;
  uf: string | null;
  valorMensal: number | null;
  consultor: string | null;
  status: ProjectStatus;
  sla: SlaInfo;
  temAditivo: boolean;
  podeMover: boolean;
  checklist: ItemChecklist[];
};

export function FunilBoard({
  etapas,
  cards,
  accent,
  voltarPara,
}: {
  etapas: EtapaBoard[];
  cards: CardBoard[];
  accent: string;
  voltarPara: string;
}) {
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [alvo, setAlvo] = useState<string | null>(null);
  const [mover, setMover] = useState<{ card: CardBoard; destino: EtapaBoard } | null>(null);

  // O modal precisa acompanhar os dados novos depois que um item do checklist
  // é marcado (a action revalida e este componente recebe props atualizadas).
  const cardAtual = mover ? cards.find((c) => c.id === mover.card.id) ?? mover.card : null;

  useEffect(() => {
    if (!mover) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMover(null);
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [mover]);

  // O id vem do próprio evento (dataTransfer), com o estado apenas como reserva:
  // não depender do estado torna o solte confiável em qualquer navegador.
  function soltar(projectId: string, stageId: string) {
    const card = cards.find((c) => c.id === projectId);
    setArrastando(null);
    setAlvo(null);
    if (!card || !card.podeMover || card.stageId === stageId) return;
    const destino = etapas.find((e) => e.id === stageId);
    if (destino) setMover({ card, destino });
  }

  const origem = cardAtual ? etapas.find((e) => e.id === cardAtual.stageId) : null;
  const avancando = !!(origem && mover && mover.destino.ordem > origem.ordem);
  const pendentes = cardAtual ? cardAtual.checklist.filter((i) => !i.done) : [];
  const bloqueado = avancando && pendentes.length > 0;

  return (
    <>
      <div className="flex-1 overflow-x-auto pb-2">
        <div className="flex gap-3 min-h-[60vh]">
          {etapas.map((etapa) => {
            const daEtapa = cards.filter((c) => c.stageId === etapa.id);
            const destacado = alvo === etapa.id && arrastando;
            return (
              <div
                key={etapa.id}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (alvo !== etapa.id) setAlvo(etapa.id);
                }}
                onDragLeave={() => setAlvo((a) => (a === etapa.id ? null : a))}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = e.dataTransfer.getData("text/plain") || arrastando || "";
                  soltar(id, etapa.id);
                }}
                className={`w-64 shrink-0 rounded-lg border border-t-2 ${accent} flex flex-col transition-colors ${
                  destacado ? "bg-primary/[0.06] border-primary/40" : "bg-muted/60 border-border"
                }`}
              >
                <div className="px-3 py-2.5 flex items-center justify-between">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground/70">
                    {etapa.nome}
                  </h2>
                  <span className="text-xs text-muted-foreground font-medium">{daEtapa.length}</span>
                </div>
                <div className="flex-1 px-2 pb-2 space-y-2">
                  {daEtapa.map((p) => (
                    <div
                      key={p.id}
                      draggable={p.podeMover}
                      onDragStart={(e) => {
                        if (!p.podeMover) return;
                        e.dataTransfer.setData("text/plain", p.id);
                        e.dataTransfer.effectAllowed = "move";
                        setArrastando(p.id);
                      }}
                      onDragEnd={() => {
                        setArrastando(null);
                        setAlvo(null);
                      }}
                      className={`group rounded-lg bg-card border border-border p-3 transition-all hover:border-primary/40 hover:shadow-sm ${
                        arrastando === p.id ? "opacity-40" : ""
                      }`}
                    >
                      <div className="flex items-start gap-1.5">
                        {/* Sem permissão de mover, o card continua legível e
                            clicável, mas não oferece a alça de arraste. */}
                        {p.podeMover ? (
                          <GripVertical
                            className="h-4 w-4 shrink-0 text-muted-foreground/40 cursor-grab active:cursor-grabbing mt-0.5"
                            aria-hidden
                          />
                        ) : (
                          <span className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <Link
                              href={`/projetos/${p.id}`}
                              className="text-sm font-medium leading-snug hover:text-primary"
                            >
                              {p.cliente}
                            </Link>
                            <StatusBadge status={p.status} />
                          </div>
                          <div className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            {p.cidade ?? "sem cidade"}
                            {p.uf ? `/${p.uf}` : ""}
                            {p.valorMensal ? (
                              <span className="ml-auto font-medium text-foreground/70">
                                {brl(p.valorMensal)}/mês
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                            <SlaChip sla={p.sla} />
                            {p.temAditivo && <AditivoBadge />}
                          </div>
                          <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                            <UserRound className="h-3 w-3" />
                            {p.consultor ?? "Sem consultor"}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {daEtapa.length === 0 && (
                    <p className="text-xs text-muted-foreground/60 text-center py-4">
                      {destacado ? "Solte aqui" : "vazio"}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal de transferência: mostra o checklist obrigatório da etapa atual */}
      {/* `mover` só é preenchido ao soltar um card, então o portal nunca
          existe na renderização do servidor. */}
      {mover &&
        cardAtual &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setMover(null);
            }}
          >
            <div className="w-full max-w-sm rounded-lg border border-border bg-card p-4 shadow-lg space-y-3 max-h-[80vh] overflow-y-auto">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">Mover {cardAtual.cliente}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 inline-flex items-center gap-1.5 flex-wrap">
                    {origem?.nome}
                    <ArrowRight className="h-3 w-3" />
                    <strong className="text-foreground">{mover.destino.nome}</strong>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setMover(null)}
                  className="h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted transition-colors shrink-0"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {avancando ? (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Checklist de {origem?.nome}
                  </p>
                  {cardAtual.checklist.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Esta etapa não tem checklist obrigatório.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {cardAtual.checklist.map((item) => (
                        <li key={item.id}>
                          <form action={toggleChecklist}>
                            <input type="hidden" name="itemId" value={item.id} />
                            <button
                              type="submit"
                              className={`flex items-start gap-3 w-full text-left rounded-lg border px-3 py-2.5 transition-colors ${
                                item.done
                                  ? "border-success/25 bg-success/[0.04] hover:bg-success/[0.08]"
                                  : "border-border hover:border-primary/40 hover:bg-muted/40"
                              }`}
                            >
                              <span
                                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
                                  item.done ? "border-success bg-success text-white" : "border-border bg-card"
                                }`}
                              >
                                {item.done && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                              </span>
                              <span
                                className={`text-sm ${item.done ? "text-muted-foreground line-through" : "font-medium"}`}
                              >
                                {item.titulo}
                              </span>
                            </button>
                          </form>
                        </li>
                      ))}
                    </ul>
                  )}

                  {bloqueado && (
                    <p className="flex items-center gap-2 rounded-md bg-warning/10 px-3 py-2 text-xs font-medium text-warning">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      {pendentes.length === 1
                        ? "Falta 1 item para poder avançar."
                        : `Faltam ${pendentes.length} itens para poder avançar.`}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Voltar etapa não exige checklist. A movimentação fica registrada na timeline do
                  projeto.
                </p>
              )}

              <div className="flex items-center justify-end gap-2 pt-1 border-t border-border">
                <button
                  type="button"
                  onClick={() => setMover(null)}
                  className="h-9 px-3 rounded-md text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
                >
                  Cancelar
                </button>
                <form action={moveStage}>
                  <input type="hidden" name="projectId" value={cardAtual.id} />
                  <input type="hidden" name="toStageId" value={mover.destino.id} />
                  <input type="hidden" name="redirectTo" value={voltarPara} />
                  <button
                    type="submit"
                    disabled={bloqueado}
                    className={`h-9 px-4 inline-flex items-center gap-1.5 rounded-md text-sm font-medium transition-colors ${
                      bloqueado
                        ? "bg-muted text-muted-foreground cursor-not-allowed"
                        : "bg-primary text-primary-foreground hover:bg-primary-hover"
                    }`}
                  >
                    {bloqueado && <Lock className="h-3.5 w-3.5" />}
                    Mover para {mover.destino.nome}
                  </button>
                </form>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
