import { Lock, UserRound } from "lucide-react";
import { allocateConsultant } from "@/lib/actions";

export function ConsultantCard({
  projectId,
  consultants,
  currentId,
  currentName,
  canEdit,
  className = "",
}: {
  projectId: string;
  consultants: { id: string; name: string }[];
  currentId: string | null;
  currentName: string | null;
  canEdit: boolean;
  className?: string;
}) {
  return (
    <div className={`h-full rounded-lg border border-border bg-card p-4 flex items-center gap-4 ${className}`}>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <UserRound className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Consultor(a) responsável
        </p>
        {/* O nome salvo aparece sempre no box, editável ou não. */}
        <p className="font-display text-lg font-semibold leading-tight mt-0.5 flex items-center gap-2">
          {currentName ?? (
            <span className="text-muted-foreground font-normal text-base">Sem consultor alocado</span>
          )}
          {!canEdit && (
            <Lock className="h-3.5 w-3.5 text-muted-foreground/50" aria-label="Somente coordenação ou diretoria altera" />
          )}
        </p>
        {canEdit && (
          <form action={allocateConsultant} className="flex items-center gap-2 mt-2">
            <input type="hidden" name="projectId" value={projectId} />
            <select
              name="consultantId"
              defaultValue={currentId ?? ""}
              className="flex-1 h-9 min-w-0 rounded-md border border-border bg-muted/50 px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <option value="">Não alocado</option>
              {consultants.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button className="h-9 px-3 shrink-0 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary-hover">
              Salvar
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
