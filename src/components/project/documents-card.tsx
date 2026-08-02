import { ExternalLink, FileText, Paperclip } from "lucide-react";
import { uploadDocument } from "@/lib/actions";
import { FileUploadField } from "@/components/project/file-upload-field";
import { DeleteDocumentButton } from "@/components/project/delete-document-button";
import { fmtDate } from "@/lib/format";
import type { ProjectDocument } from "@prisma/client";

export function DocumentsCard({
  projectId,
  documents,
  canUpload,
}: {
  projectId: string;
  documents: ProjectDocument[];
  canUpload: boolean;
}) {
  return (
    <section className="h-full bg-card border border-border rounded-lg p-5 flex flex-col">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="text-sm font-semibold inline-flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" /> Documentos e anexos
        </h2>
        {canUpload && documents.length > 0 && (
          <form action={uploadDocument} className="shrink-0">
            <input type="hidden" name="projectId" value={projectId} />
            <FileUploadField label="Adicionar arquivo" />
          </form>
        )}
      </div>

      {documents.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-6 text-center">
          <Paperclip className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Nenhum documento anexado ainda.</p>
          {canUpload && (
            <form action={uploadDocument} className="mt-1">
              <input type="hidden" name="projectId" value={projectId} />
              <FileUploadField label="Enviar arquivo" />
            </form>
          )}
        </div>
      ) : (
        <ul className="space-y-1.5">
          {documents.map((doc) => (
            <li key={doc.id} className="flex items-center gap-2 rounded-md bg-muted/50 pl-3 pr-1.5 py-1.5">
              <a
                href={`/api/documentos/${doc.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-0 flex-1 inline-flex items-center gap-1.5 text-xs font-medium text-success hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{doc.filename}</span>
              </a>
              <span className="text-[11px] text-muted-foreground shrink-0">{fmtDate(doc.uploadedAt)}</span>
              {canUpload && <DeleteDocumentButton documentId={doc.id} />}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
