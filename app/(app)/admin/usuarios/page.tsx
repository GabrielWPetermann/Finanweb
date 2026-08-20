import { prisma } from "@/lib/db";
import { criarUsuarioAction, alternarAtivoAction } from "./actions";

export default async function UsuariosPage() {
  const usuarios = await prisma.usuario.findMany({ orderBy: { criadoEm: "asc" } });

  return (
    <div>
      <h1>Usuários</h1>

      <table>
        <thead>
          <tr>
            <th>Usuário</th>
            <th>Equipe</th>
            <th>Papel</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {usuarios.map((u) => (
            <tr key={u.id}>
              <td>{u.username}</td>
              <td>{u.nomeEquipe}</td>
              <td>{u.role === "ADMIN" ? "Administrador" : "Usuário"}</td>
              <td>{u.ativo ? "Ativo" : "Inativo"}</td>
              <td>
                <form action={alternarAtivoAction}>
                  <input type="hidden" name="id" value={u.id} />
                  <button type="submit">{u.ativo ? "Desativar" : "Ativar"}</button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Novo usuário</h2>
      <form action={criarUsuarioAction} className="card">
        <label>
          Usuário
          <input type="text" name="username" required />
        </label>
        <label>
          Senha
          <input type="text" name="senha" required />
        </label>
        <label>
          Equipe
          <input type="text" name="nomeEquipe" required />
        </label>
        <label>
          Papel
          <select name="role" defaultValue="USER">
            <option value="USER">Usuário</option>
            <option value="ADMIN">Administrador</option>
          </select>
        </label>
        <button type="submit">Criar</button>
      </form>
    </div>
  );
}
