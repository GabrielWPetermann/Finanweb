// Protocolo do servidor de chat da disciplina (socket TCP, texto UTF-8, uma
// mensagem por linha). O que interessa ao Finanweb:
//
//   envio de arquivo, um pedaco por vez:
//     [#destino ]/arquivo <tamanho> <nome>\n  seguido de <tamanho> bytes
//     pedaco de tamanho 0 = fim do arquivo
//   recebimento, o servidor acrescenta quem mandou:
//     /arquivo <remetente> <tamanho> <nome>\n  seguido de <tamanho> bytes
//   texto: qualquer outra linha ("nome#id: texto", "[servidor] aviso"...)

export const TAMANHO_PEDACO = 4096;

export interface PedacoRecebido {
  remetente: string; // "nome#id"
  nomeArquivo: string;
  dados: Buffer; // vazio = fim do arquivo
}

const CABECALHO_PEDACO = /^\/arquivo (\S+) (\d+) (.+)$/;

/**
 * Separa o fluxo de bytes do socket em mensagens de texto e pedacos de
 * arquivo. O TCP nao respeita fronteira de mensagem: um "data" pode trazer
 * meia linha ou tres pedacos juntos, por isso tudo passa por um buffer.
 */
export class LeitorProtocolo {
  private buffer = Buffer.alloc(0);
  private pedacoPendente: { remetente: string; nomeArquivo: string; tamanho: number } | null = null;

  constructor(
    private aoReceberTexto: (linha: string) => void,
    private aoReceberPedaco: (pedaco: PedacoRecebido) => void = () => {}
  ) {}

  alimentar(dados: Buffer) {
    this.buffer = Buffer.concat([this.buffer, dados]);

    for (;;) {
      if (this.pedacoPendente) {
        const { remetente, nomeArquivo, tamanho } = this.pedacoPendente;
        if (this.buffer.length < tamanho) return; // espera o resto dos bytes
        const pedaco = Buffer.from(this.buffer.subarray(0, tamanho));
        this.buffer = this.buffer.subarray(tamanho);
        this.pedacoPendente = null;
        this.aoReceberPedaco({ remetente, nomeArquivo, dados: pedaco });
        continue;
      }

      const fimDaLinha = this.buffer.indexOf(0x0a);
      if (fimDaLinha === -1) return; // linha ainda incompleta
      const linha = this.buffer.subarray(0, fimDaLinha).toString("utf8").replace(/\r$/, "");
      this.buffer = this.buffer.subarray(fimDaLinha + 1);

      const cabecalho = CABECALHO_PEDACO.exec(linha);
      if (cabecalho) {
        this.pedacoPendente = {
          remetente: cabecalho[1],
          tamanho: Number(cabecalho[2]),
          nomeArquivo: cabecalho[3],
        };
      } else {
        this.aoReceberTexto(linha);
      }
    }
  }
}

/**
 * Quebra um arquivo nos pedacos do protocolo, ja com o cabecalho de cada um
 * e o pedaco vazio de fim. destino null = todos os conectados.
 */
export function montarPedacos(nomeArquivo: string, conteudo: Buffer, destino: string | null): Buffer[] {
  // O nome vai numa linha de texto: quebra de linha nele corromperia o fluxo.
  const nome = nomeArquivo.replace(/[\r\n]/g, " ").trim() || "arquivo.xml";
  const prefixo = destino ? `#${destino} ` : "";
  const pedacos: Buffer[] = [];

  for (let inicio = 0; ; inicio += TAMANHO_PEDACO) {
    const dados = conteudo.subarray(inicio, inicio + TAMANHO_PEDACO);
    pedacos.push(Buffer.concat([Buffer.from(`${prefixo}/arquivo ${dados.length} ${nome}\n`, "utf8"), dados]));
    if (dados.length === 0) return pedacos;
  }
}

/** "[servidor] conectados: ana#1, bob#2" -> ["ana#1", "bob#2"]; null se for outra linha. */
export function lerListaConectados(linha: string): string[] | null {
  const prefixo = "[servidor] conectados:";
  if (!linha.startsWith(prefixo)) return null;
  return linha
    .slice(prefixo.length)
    .split(",")
    .map((rotulo) => rotulo.trim())
    .filter(Boolean);
}

/** Texto de uma unica linha, pronto para mandar como mensagem. */
export function linhaDeTexto(texto: string): string {
  return texto.replace(/[\r\n]+/g, " ").trim();
}
