import { get } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUsuarioAtual } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const usuario = await getUsuarioAtual();
  if (!usuario) {
    return new NextResponse("Não autenticado", { status: 401 });
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Parâmetro id ausente" }, { status: 400 });
  }

  const importacao = await prisma.importacao.findUnique({ where: { id } });
  if (!importacao) {
    return new NextResponse("Importação não encontrada", { status: 404 });
  }

  const resultado = await get(importacao.blobUrl, { access: "private" });
  if (!resultado || resultado.stream === null) {
    return new NextResponse("Arquivo não encontrado", { status: 404 });
  }

  return new NextResponse(resultado.stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${importacao.nomeArquivo}"`,
      "Cache-Control": "private, no-cache",
    },
  });
}
