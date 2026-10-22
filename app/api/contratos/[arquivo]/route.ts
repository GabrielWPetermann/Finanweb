// Entrega os XSDs e os XMLs de exemplo dos contratos com os outros setores.
//
// Fica em /api, fora do login (ver o matcher do middleware): os outros
// setores da turma nao tem conta no Finanweb e precisam do schema para gerar e
// validar o arquivo antes de mandar. So serve o que esta no catalogo de
// contratos, e nada aqui vem do banco.

import fs from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { CONTRATOS } from "@/lib/xml/contratos";
import { lerSchema, type SchemaXml } from "@/lib/xml/validador";

const SCHEMAS = new Set<string>(CONTRATOS.map((c) => c.schema));
const EXEMPLOS = new Set<string>(CONTRATOS.flatMap((c) => c.exemplos));

const DIRETORIO_EXEMPLOS = path.join(process.cwd(), "lib", "xml", "exemplos");

export async function GET(_request: NextRequest, { params }: { params: Promise<{ arquivo: string }> }) {
  const { arquivo } = await params;

  // O nome so e usado como caminho depois de achado no catalogo.
  let conteudo: string;
  if (SCHEMAS.has(arquivo)) {
    conteudo = lerSchema(arquivo as SchemaXml);
  } else if (EXEMPLOS.has(arquivo)) {
    conteudo = fs.readFileSync(path.join(DIRETORIO_EXEMPLOS, arquivo), "utf8");
  } else {
    return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 });
  }

  return new NextResponse(conteudo, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="${arquivo}"`,
    },
  });
}
