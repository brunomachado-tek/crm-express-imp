import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { documentId } = await params;
  const doc = await db.projectDocument.findUnique({ where: { id: documentId } });
  if (!doc) {
    return NextResponse.json({ error: "Documento não encontrado" }, { status: 404 });
  }

  // O arquivo vem do próprio banco (bytes), não mais do disco.
  const mime = doc.mimeType || "application/octet-stream";
  const podeAbrir = mime === "application/pdf" || mime.startsWith("image/");

  return new NextResponse(new Uint8Array(doc.data), {
    headers: {
      "Content-Type": mime,
      // Só abre na aba o que o navegador sabe renderizar com segurança (PDF e
      // imagem). Qualquer outra coisa é baixada, nunca executada no domínio do
      // CRM. O nome vai sem aspas e sem quebra de linha para não permitir a
      // injeção de outro cabeçalho.
      "Content-Disposition": `${podeAbrir ? "inline" : "attachment"}; filename="${doc.filename.replace(/["\r\n]/g, "")}"`,
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=0, no-cache",
    },
  });
}
