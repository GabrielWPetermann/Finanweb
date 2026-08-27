import { prisma } from "@/lib/db";
import { criarUsuarioAction, alternarAtivoAction, aprovarUsuarioAction } from "./actions";
import { BotaoRecusar } from "./botao-recusar";

export default async function UsuariosPage() {
  const [pendentes, usuarios] = await Promise.all([
    prisma.usuario.findMany({ where: { aprovado: false }, orderBy: { criadoEm: "asc" } }),
    prisma.usuario.findMany({ where: { aprovado: true }, orderBy: { criadoEm: "asc" } }),
  ]);

  return (
    <div>
      <h1>Usuários</h1>

      {pendentes.length > 0 && (
        <>
          <h2>Solicitações pendentes</h2>
          <p className="subtitulo">Pessoas que pediram cadastro pela tela de login, aguardando aprovação.</p>
          <table>
            <thead>
              <tr>
                <th>E-mail</th>
                <th>WhatsApp</th>
                <th>Solicitado em</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pendentes.map((p) => (
                <tr key={p.id}>
                  <td>{p.username}</td>
                  <td>{p.whatsapp}</td>
                  <td>{p.criadoEm.toLocaleString("pt-BR")}</td>
                  <td>
                    <div className="linha-acoes">
                      <form action={aprovarUsuarioAction}>
                        <input type="hidden" name="id" value={p.id} />
                        <button type="submit">Aprovar</button>
                      </form>
                      <BotaoRecusar id={p.id} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <h2>Usuários</h2>
      <table>
        <thead>
          <tr>
            <th>Usuário</th>
            <th>WhatsApp</th>
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
              <td>{u.whatsapp || "-"}</td>
              <td>{u.nomeEquipe || "-"}</td>
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
