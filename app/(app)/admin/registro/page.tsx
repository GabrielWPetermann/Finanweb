import { prisma } from "@/lib/db";
import { mudarSituacaoAction, removerSetorAction } from "./actions";
import { GerarChave } from "./gerar-chave";

export default async function AdminRegistroPage() {
  const [chaves, servicos] = await Promise.all([
    prisma.chaveRegistro.findMany({ orderBy: { setor: "asc" }, include: { _count: { select: { servicos: true } } } }),
    prisma.servicoRegistrado.findMany({ orderBy: [{ setor: "asc" }, { nome: "asc" }, { versao: "asc" }] }),
  ]);

  return (
    <div>
      <h1>Registry</h1>
      <p className="subtitulo">
        Chaves dos setores para publicar no registry da turma, e a situação do que foi publicado. A busca pública
        fica em <a href="/registro">/registro</a>; os serviços do Financeiro saem do catálogo de contratos.
      </p>

      <h2>Chaves dos setores</h2>
      <GerarChave />
      <table>
        <thead>
          <tr>
            <th>Setor</th>
            <th>Chave gerada em</th>
            <th>Serviços</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {chaves.map((c) => (
            <tr key={c.setor}>
              <td>{c.setor}</td>
              <td>{c.criadoEm.toLocaleString("pt-BR")}</td>
              <td>{c._count.servicos}</td>
              <td>
                <form action={removerSetorAction}>
                  <input type="hidden" name="setor" value={c.setor} />
                  <button type="submit" className="botao-perigo">
                    Remover setor e serviços
                  </button>
                </form>
              </td>
            </tr>
          ))}
          {chaves.length === 0 && (
            <tr>
              <td colSpan={4}>Nenhum setor com chave ainda.</td>
            </tr>
          )}
        </tbody>
      </table>

      <h2>Serviços publicados</h2>
      <table>
        <thead>
          <tr>
            <th>Setor</th>
            <th>Serviço</th>
            <th>Versão</th>
            <th>Protocolo</th>
            <th>Endpoint</th>
            <th>Situação</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {servicos.map((s) => (
            <tr key={s.id}>
              <td>{s.setor}</td>
              <td>{s.nome}</td>
              <td>{s.versao}</td>
              <td>{s.protocolo}</td>
              <td>
                <code>{s.endpoint}</code>
              </td>
              <td>{s.situacao}</td>
              <td>
                <form action={mudarSituacaoAction} className="linha-acoes">
                  <input type="hidden" name="id" value={s.id} />
                  <input type="hidden" name="situacao" value={s.situacao === "DESATIVADO" ? "ATIVO" : "DESATIVADO"} />
                  {s.situacao !== "DESATIVADO" ? (
                    <button type="submit" className="botao-perigo">
                      Desativar
                    </button>
                  ) : (
                    <button type="submit">Reativar</button>
                  )}
                </form>
              </td>
            </tr>
          ))}
          {servicos.length === 0 && (
            <tr>
              <td colSpan={7}>Nenhum serviço publicado pelos outros setores ainda.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
