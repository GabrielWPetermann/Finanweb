// Conexao curta com o servidor de chat: abre, conversa e fecha. E o que cabe
// numa funcao serverless (Vercel), que nao pode ficar conectada esperando --
// receber arquivos fica com o ouvinte (scripts/socket-ouvinte.ts).

import net from "node:net";
import { SOCKET_HOST, SOCKET_NOME_ENVIO, SOCKET_PORTA } from "@/lib/socket/config";
import { LeitorProtocolo, montarPedacos } from "@/lib/socket/protocolo";

const TIMEOUT_CONEXAO_MS = 5000;
const TIMEOUT_RESPOSTA_MS = 3000;

class ConexaoCurta {
  private linhas: string[] = [];
  private aoChegarLinha: (() => void) | null = null;
  private encerrada = false;

  private constructor(private socket: net.Socket) {
    const leitor = new LeitorProtocolo((linha) => {
      this.linhas.push(linha);
      this.aoChegarLinha?.();
    });
    socket.on("data", (dados) => leitor.alimentar(dados));
    socket.on("close", () => {
      this.encerrada = true;
      this.aoChegarLinha?.();
    });
    socket.on("error", () => {}); // o "close" que vem em seguida encerra a espera
  }

  static abrir(): Promise<ConexaoCurta> {
    return new Promise((resolve, reject) => {
      const socket = net.connect({ host: SOCKET_HOST, port: SOCKET_PORTA });
      const timer = setTimeout(() => {
        socket.destroy();
        reject(new Error("tempo esgotado"));
      }, TIMEOUT_CONEXAO_MS);
      socket.once("connect", () => {
        clearTimeout(timer);
        resolve(new ConexaoCurta(socket));
      });
      socket.once("error", (erro: NodeJS.ErrnoException) => {
        clearTimeout(timer);
        reject(new Error(erro.code ?? erro.message));
      });
    });
  }

  /** Espera a primeira linha que passe no teste; null se nao chegar a tempo. */
  async esperarLinha(teste: (linha: string) => boolean, ms = TIMEOUT_RESPOSTA_MS): Promise<string | null> {
    const limite = Date.now() + ms;
    for (;;) {
      const indice = this.linhas.findIndex(teste);
      if (indice !== -1) return this.linhas.splice(indice, 1)[0];

      const restante = limite - Date.now();
      if (restante <= 0 || this.encerrada) return null;
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, restante);
        this.aoChegarLinha = () => {
          clearTimeout(timer);
          resolve();
        };
      });
    }
  }

  escrever(dados: string | Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket.write(dados, (erro) => (erro ? reject(erro) : resolve()));
    });
  }

  /** Encerra o envio e espera o servidor fechar, para nada ficar no meio do caminho. */
  async fechar(): Promise<void> {
    if (this.encerrada) return;
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        this.socket.destroy();
        resolve();
      }, 2000);
      this.socket.once("close", () => {
        clearTimeout(timer);
        resolve();
      });
      this.socket.end();
    });
  }
}

export type ResultadoSocket<T> = ({ ok: true } & T) | { ok: false; erro: string };

interface Sessao {
  conexao: ConexaoCurta;
  meuId: string | null;
  conectados: string[]; // "nome#id" de todos, menos esta conexao
}

function idDoRotulo(rotulo: string): string {
  return rotulo.slice(rotulo.lastIndexOf("#") + 1);
}

/** Conecta, se identifica e pergunta quem esta conectado. */
async function iniciarSessao(): Promise<Sessao> {
  const conexao = await ConexaoCurta.abrir();

  // "[servidor] bem-vindo! Você é cliente5#5. Digite /help ..."
  const boasVindas = await conexao.esperarLinha((l) => l.startsWith("[servidor] bem-vindo"));
  const meuId = boasVindas ? (/#(\d+)/.exec(boasVindas)?.[1] ?? null) : null;

  // Com nome os outros sabem de onde veio o arquivo. Se ja estiver em uso
  // (dois envios ao mesmo tempo), o servidor recusa e segue "clienteN".
  await conexao.escrever(`/nome ${SOCKET_NOME_ENVIO}\n`);
  await conexao.esperarLinha((l) => l.startsWith("[servidor] agora você é") || l.includes("nome"));

  await conexao.escrever("/lista\n");
  const lista = await conexao.esperarLinha((l) => l.startsWith("[servidor] conectados:"));
  const conectados = (lista ?? "")
    .replace("[servidor] conectados:", "")
    .split(",")
    .map((rotulo) => rotulo.trim())
    .filter((rotulo) => rotulo && idDoRotulo(rotulo) !== meuId);

  return { conexao, meuId, conectados };
}

function mensagemFalhaConexao(erro: unknown): string {
  const motivo = erro instanceof Error ? erro.message : String(erro);
  return `Não foi possível conectar ao servidor ${SOCKET_HOST}:${SOCKET_PORTA} (${motivo}). Confira se ele está no ar.`;
}

export async function listarConectados(): Promise<ResultadoSocket<{ conectados: string[] }>> {
  let sessao: Sessao;
  try {
    sessao = await iniciarSessao();
  } catch (erro) {
    return { ok: false, erro: mensagemFalhaConexao(erro) };
  }
  await sessao.conexao.fechar();
  return { ok: true, conectados: sessao.conectados };
}

/**
 * Envia um arquivo pelo servidor. destino = nome ou id de um conectado, ou
 * null para todos. Confere antes se ha alguem para receber, porque o servidor
 * so avisa "destino nao encontrado" depois do arquivo inteiro ter subido.
 */
export async function enviarArquivo(
  nomeArquivo: string,
  conteudo: Buffer,
  destino: string | null
): Promise<ResultadoSocket<{ destinatarios: string[] }>> {
  let sessao: Sessao;
  try {
    sessao = await iniciarSessao();
  } catch (erro) {
    return { ok: false, erro: mensagemFalhaConexao(erro) };
  }
  const { conexao, conectados } = sessao;

  const destinatarios = destino
    ? conectados.filter((rotulo) => {
        const nome = rotulo.slice(0, rotulo.lastIndexOf("#"));
        return idDoRotulo(rotulo) === destino || nome.toLowerCase() === destino.toLowerCase();
      })
    : conectados;

  if (destinatarios.length === 0) {
    await conexao.fechar();
    const quem = conectados.length > 0 ? conectados.join(", ") : "ninguém";
    return {
      ok: false,
      erro: destino
        ? `"${destino}" não está conectado ao servidor. Conectados agora: ${quem}.`
        : "Ninguém mais está conectado ao servidor para receber o arquivo.",
    };
  }

  try {
    for (const pedaco of montarPedacos(nomeArquivo, conteudo, destino)) {
      await conexao.escrever(pedaco);
    }
  } catch (erro) {
    await conexao.fechar();
    return { ok: false, erro: `A conexão caiu durante o envio (${String(erro)}).` };
  }

  await conexao.fechar();
  return { ok: true, destinatarios };
}
