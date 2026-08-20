import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = process.env.SESSION_COOKIE_NAME ?? "sf_sessao";

// Middleware roda no Edge runtime, entao so checa a presenca do cookie de
// sessao (sem consultar o banco). A validacao completa (usuario ativo, role)
// acontece nos layouts de servidor via getUsuarioAtual().
export function middleware(request: NextRequest) {
  const sessao = request.cookies.get(COOKIE_NAME);

  if (!sessao) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!login|api|_next/static|_next/image|favicon.ico).*)"],
};
