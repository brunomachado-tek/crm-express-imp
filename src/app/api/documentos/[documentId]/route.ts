import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";

const UPLOAD_DIR = path.join(process.cwd(), "uploads", "contracts");

const MIME_BY_EXT: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

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

  const ext = path.extname(doc.filename).toLowerCase() || ".pdf";
  const filePath = path.join(UPLOAD_DIR, `${documentId}${ext}`);
  const mime = MIME_BY_EXT[ext];

  try {
    const data = await fs.readFile(filePath);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": mime ?? "application/octet-stream",
        // Só abre na aba o que o navegador sabe renderizar com segurança
        // (PDF e imagem). Qualquer outra coisa é baixada, nunca executada
        // no domínio do CRM. O nome vai sem aspas e sem quebra de linha para
        // não permitir a injeção de outro cabeçalho.
        "Content-Disposition": `${mime ? "inline" : "attachment"}; filename="${doc.filename.replace(/["\r\n]/g, "")}"`,
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, max-age=0, no-cache",
      },
    });
  } catch {
    return NextResponse.json({ error: "Arquivo não encontrado no servidor" }, { status: 404 });
  }
}
