import { prisma } from "@/lib/db";

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarData(data: Date | null) {
  if (!data) return "-";
  return data.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

export default async function HistoricoPage() {
  const importacoes = await prisma.importacao.findMany({
    orderBy: { criadoEm: "desc" },
    include: { usuario: true },
  });

  return (
    <div>
      <h1>Histórico de importações</h1>
      <table>
        <thead>
          <tr>
            <th>Tipo</th>
            <th>Arquivo</th>
            <th>Enviado por</th>
            <th>Data de envio</th>
            <th>Data do arquivo</th>
            <th>Registros</th>
            <th>Valor total</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {importacoes.map((imp) => (
            <tr key={imp.id}>
              <td>{imp.tipo === "ENTRADA" ? "Entrada" : "Saída"}</td>
              <td>{imp.nomeArquivo}</td>
              <td>{imp.usuario.username}</td>
              <td>{imp.criadoEm.toLocaleString("pt-BR")}</td>
              <td>{formatarData(imp.dataArquivoOriginal)}</td>
              <td>{imp.qtdRegistros}</td>
              <td>{formatarMoeda(Number(imp.valorTotal))}</td>
              <td>
                <a href={`/historico/download?id=${imp.id}`}>Baixar</a>
              </td>
            </tr>
          ))}
          {importacoes.length === 0 && (
            <tr>
              <td colSpan={8}>Nenhuma importação ainda.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
