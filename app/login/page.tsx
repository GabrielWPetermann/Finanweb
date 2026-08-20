import { loginAction } from "./actions";

interface Props {
  searchParams: Promise<{ erro?: string }>;
}

export default async function LoginPage({ searchParams }: Props) {
  const { erro } = await searchParams;

  return (
    <div className="login-page">
      <form action={loginAction} className="card login-card">
        <h1>Finanweb</h1>
        {erro && <p className="erro">Usuário ou senha inválidos.</p>}
        <label>
          Usuário
          <input type="text" name="username" required autoFocus />
        </label>
        <label>
          Senha
          <input type="password" name="senha" required />
        </label>
        <button type="submit">Entrar</button>
      </form>
    </div>
  );
}
