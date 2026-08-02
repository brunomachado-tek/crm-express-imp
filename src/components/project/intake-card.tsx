import Link from "next/link";
import { createIntakeLink } from "@/lib/actions";
import { CopyLinkButton } from "@/components/team/copy-link-button";
import { TOTAL_ETAPAS } from "@/lib/intake";
import { fmtDate } from "@/lib/format";
import type { ClientIntake } from "@prisma/client";
import { ClipboardList, Link2, Plus } from "lucide-react";

// Card do repasse comercial → implantação na página do projeto.
// Substitui a reunião de repasse: gera um link público para o comercial
// preencher e mostra o andamento até a chegada das respostas.
export function IntakeCard({
  projectId,
  intake,
  canManage,
}: {
  projectId: string;
  intake: ClientIntake | null;
  canManage: boolean;
}) {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  const url = intake ? `${base}/repasse/${intake.token}` : null;
  const enviado = intake?.status === "ENVIADO";
  const pct = intake ? Math.round((Math.min(intake.etapaAtual, TOTAL_ETAPAS) / TOTAL_ETAPAS) * 100) : 0;

  return (
    <section className="h-full bg-card border border-border rounded-lg p-5 flex flex-col">
      <div className="flex items-center justify-between gap-3 mb-1.5">
        <h2 className="text-sm font-semibold inline-flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-primary" /> Repasse do comercial
        </h2>
        {intake && (
          <span
            className={`text-xs font-semibold rounded-full px-2 py-0.5 ${
              enviado ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
            }`}
          >
            {enviado ? "Recebido" : "Aguardando"}
          </span>
        )}
      </div>

      {!intake ? (
        <>
          <p className="text-sm text-muted-foreground">
            Gere um formulário para o comercial enviar os dados do fechamento sem precisar de
            reunião. O link é público e não exige login.
          </p>
          {canManage ? (
            <form action={createIntakeLink} className="mt-4">
              <input type="hidden" name="projectId" value={projectId} />
              <button className="h-9 px-4 inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary-hover transition-colors">
                <Plus className="h-4 w-4" /> Gerar formulário de repasse
              </button>
            </form>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">
              Somente a coordenação, a diretoria ou o consultor alocado geram o formulário.
            </p>
          )}
        </>
      ) : enviado ? (
        <>
          <p className="text-sm text-muted-foreground">
            Recebido em {fmtDate(intake.submittedAt)}
            {intake.preenchidoPor ? `, preenchido por ${intake.preenchidoPor}` : ""}.
          </p>
          <Link
            href={`/projetos/${projectId}/repasse`}
            className="mt-4 h-9 px-4 inline-flex items-center gap-1.5 rounded-md border border-border text-sm font-medium hover:bg-muted transition-colors"
          >
            Ver respostas
          </Link>
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Envie o link para o comercial. As respostas ficam salvas a cada etapa.
          </p>
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span>
                Etapa {Math.min(intake.etapaAtual, TOTAL_ETAPAS)} de {TOTAL_ETAPAS}
              </span>
              <span>{pct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-md bg-muted/50 border border-border px-3 py-2">
            <Link2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{url}</span>
            {url && <CopyLinkButton text={url} />}
          </div>
          <Link
            href={`/projetos/${projectId}/repasse`}
            className="mt-3 inline-block text-xs text-accent hover:underline"
          >
            Ver o que já foi preenchido
          </Link>
        </>
      )}
    </section>
  );
}
