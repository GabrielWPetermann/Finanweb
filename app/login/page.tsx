import { loginAction } from "./actions";

interface Props {
  searchParams: Promise<{ erro?: string; solicitado?: string }>;
}

const MENSAGENS_ERRO: Record<string, string> = {
  credenciais: "Usuário ou senha inválidos.",
  pendente: "Seu cadastro ainda está aguardando aprovação de um administrador.",
  inativo: "Este usuário está desativado. Fale com um administrador.",
};

export default async function LoginPage({ searchParams }: Props) {
  const { erro, solicitado } = await searchParams;
  const mensagemErro = erro ? MENSAGENS_ERRO[erro] : undefined;

  return (
    <div className="login-page">
      <form action={loginAction} className="card login-card">
        <h1>Finanweb</h1>
        {mensagemErro && <p className="erro">{mensagemErro}</p>}
        {solicitado && (
          <p className="sucesso">Cadastro enviado! Um administrador vai liberar seu acesso em breve.</p>
        )}
        <label>
          Usuário
          <input type="text" name="username" required autoFocus />
        </label>
        <label>
          Senha
          <input type="password" name="senha" required />
        </label>
        <button type="submit">Entrar</button>
        <a href="/solicitar-cadastro" className="link-button login-rodape">
          Solicitar cadastro
        </a>
      </form>
    </div>
  );
}
