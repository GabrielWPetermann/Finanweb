import { solicitarCadastroAction } from "./actions";

interface Props {
  searchParams: Promise<{ erro?: string }>;
}

export default async function SolicitarCadastroPage({ searchParams }: Props) {
  const { erro } = await searchParams;

  return (
    <div className="login-page">
      <form action={solicitarCadastroAction} className="card login-card">
        <h1>Solicitar cadastro</h1>
        <p className="subtitulo">
          Preencha os dados abaixo. Um administrador vai avaliar e liberar seu acesso em breve.
        </p>
        {erro && <p className="erro">{erro}</p>}
        <label>
          Usuário
          <input type="text" name="username" required autoFocus />
        </label>
        <label>
          Senha
          <input type="password" name="senha" required minLength={6} />
        </label>
        <label>
          WhatsApp
          <input type="text" name="whatsapp" placeholder="(11) 99999-9999" required />
        </label>
        <button type="submit">Enviar solicitação</button>
        <a href="/login" className="link-button login-rodape">
          Voltar pro login
        </a>
      </form>
    </div>
  );
}
