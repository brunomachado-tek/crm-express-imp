import { AlertTriangle, Lock } from "lucide-react";
import { justifyDelay } from "@/lib/actions";
import { DeleteDelayButton } from "@/components/project/delete-delay-button";
import { fmtDate } from "@/lib/format";
import type { DelayCategory, DelayJustification, PipelineStage, User } from "@prisma/client";

type Atraso = DelayJustification & {
  category: DelayCategory;
  byUser: User | null;
  stage: PipelineStage;
};

export function DelayCard({
  projectId,
  canDelay,
  categorias,
  atrasos,
}: {
  projectId: string;
  canDelay: boolean;
  categorias: DelayCategory[];
  atrasos: Atraso[];
}) {
  const campo =
    "w-full h-9 rounded-md border border-border bg-muted/50 px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40";

  return (
    <section className="h-full bg-card border border-border rounded-lg p-5 flex flex-col">
      <h2 className="text-sm font-semibold inline-flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-warning" /> Justificar atraso
      </h2>
      <p className="text-xs text-muted-foreground mt-1 mb-3">
        Obrigatório quando a etapa estoura o prazo ideal. A métrica usa a categoria.
      </p>

      {canDelay ? (
        <form action={justifyDelay} className="space-y-2">
          <input type="hidden" name="projectId" value={projectId} />
          <select name="categoryId" required className={campo}>
            <option value="">Categoria…</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
          <textarea
            name="detalhe"
            rows={2}
            placeholder="Detalhes (opcional)"
            className="w-full rounded-md border border-border bg-muted/50 px-2.5 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          />
          <button className="w-full h-9 rounded-md border border-border text-sm font-medium hover:bg-muted transition-colors">
            Registrar justificativa
          </button>
        </form>
      ) : (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5" /> Somente quem toca a implantação registra justificativa.
        </p>
      )}

      {/* Justificativas já registradas ficam logo abaixo do box de criar */}
      <div className="mt-4 flex-1 min-h-0">
        {atrasos.length === 0 ? (
          <p className="text-xs text-muted-foreground/70">Nenhuma justificativa registrada.</p>
        ) : (
          <ul className="space-y-2 border-t border-border pt-3">
            {atrasos.map((d) => (
              <li key={d.id} className="rounded-md border border-border bg-muted/30 px-3 py-2">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium min-w-0">{d.category.nome}</span>
                  <span className="flex items-center gap-1 shrink-0">
                    <span className="text-[11px] text-muted-foreground">{fmtDate(d.at)}</span>
                    {canDelay && <DeleteDelayButton justificativaId={d.id} />}
                  </span>
                </div>
                {d.detalhe && <p className="text-xs text-muted-foreground mt-0.5">{d.detalhe}</p>}
                <p className="text-[11px] text-muted-foreground mt-1">
                  {d.stage.nome}
                  {d.byUser ? ` · ${d.byUser.name}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
