"use client";

import { useEffect, useRef, useState } from "react";
import { GripVertical } from "lucide-react";
import { reorderActivities } from "@/lib/actions";

// Reordena as atividades de um grupo por arrastar (alça de 3 tracinhos). A ordem
// muda na hora (otimista) e é persistida por `reorderActivities`. Só quem pode
// gerenciar (consultor alocado, coordenação, diretoria) vê a alça; os demais
// veem a lista normal.
export function SortableActivities({
  projectId,
  canManage,
  items,
}: {
  projectId: string;
  canManage: boolean;
  items: { id: string; node: React.ReactNode }[];
}) {
  const idsKey = items.map((i) => i.id).join(",");
  const [order, setOrder] = useState<string[]>(() => items.map((i) => i.id));
  const dragId = useRef<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const nodeById = new Map(items.map((i) => [i.id, i.node]));

  // ressincroniza quando o servidor devolve nova ordem/lista (add, remove, etc.)
  useEffect(() => {
    setOrder(items.map((i) => i.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  if (!canManage) {
    return (
      <ol className="space-y-3 p-4 pt-4 border-t border-border">
        {items.map((i) => (
          <li key={i.id} className="flex gap-4">
            {i.node}
          </li>
        ))}
      </ol>
    );
  }

  function soltar(alvo: string) {
    const src = dragId.current;
    dragId.current = null;
    setOverId(null);
    if (!src || src === alvo) return;
    const de = order.indexOf(src);
    const para = order.indexOf(alvo);
    if (de < 0 || para < 0) return;
    const nova = [...order];
    const [m] = nova.splice(de, 1);
    nova.splice(para, 0, m);
    setOrder(nova);
    // deixa o input controlado atualizar antes de enviar
    requestAnimationFrame(() => formRef.current?.requestSubmit());
  }

  return (
    <>
      <ol className="space-y-3 p-4 pt-4 border-t border-border">
        {order
          .filter((id) => nodeById.has(id))
          .map((id) => (
            <li
              key={id}
              onDragOver={(e) => {
                e.preventDefault();
                setOverId(id);
              }}
              onDragLeave={() => setOverId((o) => (o === id ? null : o))}
              onDrop={() => soltar(id)}
              className={`flex gap-2 items-start rounded-lg transition-shadow ${
                overId === id ? "ring-2 ring-primary/30" : ""
              }`}
            >
              <span
                draggable
                onDragStart={() => {
                  dragId.current = id;
                }}
                onDragEnd={() => {
                  dragId.current = null;
                  setOverId(null);
                }}
                title="Arraste para reordenar"
                className="mt-1 shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground"
              >
                <GripVertical className="h-4 w-4" />
              </span>
              <div className="flex-1 min-w-0 flex gap-4">{nodeById.get(id)}</div>
            </li>
          ))}
      </ol>
      <form ref={formRef} action={reorderActivities} className="hidden">
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="ordem" value={order.join(",")} />
      </form>
    </>
  );
}
