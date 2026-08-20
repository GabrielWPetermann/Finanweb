import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Finanweb",
  description: "Integração de arquivos financeiros via CSV",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <div className="app-shell">{children}</div>
        <div className="bloqueio-mobile">
          <span className="bloqueio-mobile-carinha">:(</span>
          <p>
            Não temos visualização mobile.
            <br />
            Abra o sistema no seu computador.
          </p>
        </div>
      </body>
    </html>
  );
}
