import { listarRecebidos } from "@/lib/socket/caixa-entrada";
import { SOCKET_HOST, SOCKET_NOME, SOCKET_PORTA } from "@/lib/socket/config";
import { lerConectados } from "@/lib/socket/estado";
import { Conectados } from "./conectados";
import { EnviarForm } from "./enviar-form";
import { ListaRecebidos, type LinhaRecebido } from "./lista-recebidos";

function formatarTamanho(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}

export default async function SocketPage() {
  const estado = await lerConectados();
  let linhas: LinhaRecebido[] = [];
  let erroLista: string | null = null;
  try {
    linhas = (await listarRecebidos()).map((arquivo) => ({
      pathname: arquivo.pathname,
      recebidoEm: arquivo.recebidoEm.toLocaleString("pt-BR"),
      remetente: arquivo.remetente,
      nomeArquivo: arquivo.nomeArquivo,
      tipo: arquivo.tipo,
      tamanho: formatarTamanho(arquivo.tamanho),
    }));
  } catch (erro) {
    console.error(erro);
    erroLista = "Não foi possível carregar os arquivos recebidos.";
  }

  return (
    <div>
      <h1>Socket</h1>
      <p className="subtitulo">
        Envio e recebimento de XML de Entrada e Saída pelo servidor da turma.{" "}
        <a href="/documentacao#socket">Como funciona</a>
      </p>

      <div className="grid-2">
        <EnviarForm />

        <div className="card">
          <h2>Servidor</h2>
          <span className="card-label">
            <code>
              {SOCKET_HOST}:{SOCKET_PORTA}
            </code>{" "}
            · recebe em <code>#{SOCKET_NOME}</code>
          </span>
          <Conectados inicial={estado} nomeOuvinte={SOCKET_NOME} />
        </div>
      </div>

      <h2>Recebidos</h2>
      <p className="subtitulo">Arquivos aguardando importação.</p>
      {erroLista ? <p className="erro">{erroLista}</p> : <ListaRecebidos linhas={linhas} />}
    </div>
  );
}
