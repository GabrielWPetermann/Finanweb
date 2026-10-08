import { redirect } from "next/navigation";
import Link from "next/link";
import { getUsuarioAtual } from "@/lib/auth";
import { logoutAction } from "./logout-action";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const usuario = await getUsuarioAtual();
  if (!usuario) {
    redirect("/login");
  }

  return (
    <div className="layout">
      <header className="topbar">
        <div className="topbar-brand">Finanweb</div>
        <nav className="topbar-nav">
          <Link href="/">Dashboard</Link>
          <Link href="/integrar">Integrar</Link>
          <Link href="/socket">Socket</Link>
          <Link href="/chat">Chat</Link>
          <Link href="/documentacao">Documentação</Link>
          <Link href="/recebimentos">Recebimentos</Link>
          <Link href="/pagamentos">Pagamentos</Link>
          <Link href="/historico">Histórico</Link>
          <Link href="/relatorios">Relatórios</Link>
          {usuario.role === "ADMIN" && (
            <>
              <Link href="/admin/usuarios">Usuários</Link>
              <Link href="/admin/categorias">Categorias</Link>
              <Link href="/admin/cadastros">Cadastros</Link>
            </>
          )}
        </nav>
        <div className="topbar-user">
          <span>
            {usuario.username} · {usuario.nomeEquipe}
          </span>
          <form action={logoutAction}>
            <button type="submit" className="link-button">
              Sair
            </button>
          </form>
        </div>
      </header>
      <main className="content">{children}</main>
    </div>
  );
}
