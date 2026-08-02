import { Check, CheckCircle2, ListChecks } from "lucide-react";
import { toggleChecklist } from "@/lib/actions";
import { fmtDate } from "@/lib/format";
import type { ProjectChecklistItem, User } from "@prisma/client";

type Item = ProjectChecklistItem & { doneBy: User | null };

export function ChecklistCard({
  stageNome,
  items,
  canEdit,
}: {
  stageNome: string;
  items: Item[];
  canEdit: boolean;
}) {
  const done = items.filter((i) => i.done).length;
  const allDone = items.length > 0 && done === items.length;
  const pct = items.length === 0 ? 100 : Math.round((done / items.length) * 100);

  return (
    <section className="h-full bg-card border border-border rounded-lg p-5 flex flex-col">
      <div className="flex items-center justify-between gap-3 mb-1.5">
        <h2 className="text-sm font-semibold inline-flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-primary" />
          Checklist da etapa
          <span className="text-muted-foreground font-normal">· {stageNome}</span>
        </h2>
        <span
          className={`text-xs font-semibold rounded-full px-2 py-0.5 ${
            allDone ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
          }`}
        >
          {done}/{items.length}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden mb-4">
        <div
          className={`h-full rounded-full transition-all ${allDone ? "bg-success" : "bg-primary"}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sem itens para esta etapa.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((c) => (
            <li key={c.id}>
              {/* Quem não toca a implantação lê o checklist, mas não marca:
                  o item vira texto em vez de botão. */}
              <form action={toggleChecklist}>
                <input type="hidden" name="itemId" value={c.id} />
                <button
                  type="submit"
                  disabled={!canEdit}
                  className={`flex items-start gap-3 w-full text-left rounded-lg border px-3 py-2.5 transition-colors ${
                    c.done
                      ? "border-success/25 bg-success/[0.04]"
                      : "border-border"
                  } ${
                    canEdit
                      ? c.done
                        ? "hover:bg-success/[0.08]"
                        : "hover:border-primary/40 hover:bg-muted/40"
                      : "cursor-default"
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
                      c.done ? "border-success bg-success text-white" : "border-border bg-card"
                    }`}
                  >
                    {c.done && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                  </span>
                  <span className="min-w-0">
                    <span
                      className={`block text-sm ${
                        c.done ? "text-muted-foreground line-through" : "font-medium"
                      }`}
                    >
                      {c.titulo}
                    </span>
                    {c.done && (c.doneBy || c.doneAt) && (
                      <span className="block text-xs text-muted-foreground mt-0.5">
                        {c.doneBy?.name}
                        {c.doneAt ? ` · ${fmtDate(c.doneAt)}` : ""}
                      </span>
                    )}
                  </span>
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      {allDone && (
        <p className="mt-3 flex items-center gap-2 rounded-md bg-success/10 px-3 py-2 text-xs font-medium text-success">
          <CheckCircle2 className="h-4 w-4" /> Checklist completo. O card pode avançar de etapa.
        </p>
      )}
    </section>
  );
}
