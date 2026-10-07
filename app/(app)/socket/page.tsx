import { listarRecebidos } from "@/lib/socket/caixa-entrada";
import { SOCKET_HOST, SOCKET_NOME, SOCKET_PORTA } from "@/lib/socket/config";
import { Conectados } from "./conectados";
import { EnviarForm } from "./enviar-form";
import { ListaRecebidos, type LinhaRecebido } from "./lista-recebidos";

function formatarTamanho(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}

export default async function SocketPage() {
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
    erroLista = "Não foi possível ler a caixa de entrada (Vercel Blob).";
  }

  return (
    <div>
      <h1>Socket</h1>
      <p className="subtitulo">
        Troca de XML de Entrada e Saída com outros sistemas pelo servidor de chat da disciplina,{" "}
        <code>
          {SOCKET_HOST}:{SOCKET_PORTA}
        </code>
        . O envio sai daqui; o recebimento fica com o ouvinte (<code>npm run socket</code>), que fica conectado
        como <code>{SOCKET_NOME}</code> e guarda os arquivos abaixo até alguém aprovar.
      </p>

      <div className="grid-2">
        <EnviarForm />

        <div className="card">
          <h2>Servidor</h2>
          <span className="card-label">
            Para receber, os outros sistemas mandam o XML para <code>#{SOCKET_NOME}</code>. O ouvinte confere o
            arquivo no XSD e responde no chat se aceitou ou por que recusou.
          </span>
          <Conectados nomeOuvinte={SOCKET_NOME} />
        </div>
      </div>

      <h2>Recebidos, aguardando aprovação</h2>
      <p className="subtitulo">
        Já passaram pelo XSD na chegada. Importar grava no sistema como na tela de Integrar e o arquivo vai para
        o Histórico.
      </p>
      {erroLista ? <p className="erro">{erroLista}</p> : <ListaRecebidos linhas={linhas} />}
    </div>
  );
}
