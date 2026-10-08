import { NextResponse } from "next/server";
import { getUsuarioAtual } from "@/lib/auth";
import { ultimasMensagens } from "@/lib/socket/chat";
import { lerConectados } from "@/lib/socket/estado";

// Consultada pelo painel a cada poucos segundos. Devolve sempre as ultimas
// mensagens inteiras (e nao so as novas) porque uma mensagem ja exibida pode
// mudar de "na fila" para "enviada".
export async function GET() {
  const usuario = await getUsuarioAtual();
  if (!usuario) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const [mensagens, estado] = await Promise.all([ultimasMensagens(), lerConectados()]);
  return NextResponse.json({ mensagens, estado }, {
    headers: { "Cache-Control": "no-store" },
  });
}
