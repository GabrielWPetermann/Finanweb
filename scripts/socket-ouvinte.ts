// Ouvinte de socket do Finanweb: fica conectado ao servidor de chat da
// disciplina e
//   - guarda os XMLs de Entrada/Saida (v1, venda e compra v2) e de folha que
//     chegam, para alguem aprovar a importacao na tela /socket (responde ao
//     remetente se aceitou);
//   - responde na hora as consultas de inadimplencia e de pendencias com
//     fornecedor (lib/socket/consultas.ts), com um XML para quem perguntou;
//   - grava as mensagens do chat no banco e manda as que foram escritas na
//     tela /chat, que ficam numa fila no banco.
//
// Roda fora da Vercel, porque funcao serverless nao fica conectada esperando:
//   npm run socket
//
// Precisa do .env: BLOB_READ_WRITE_TOKEN (caixa de entrada) e DATABASE_URL (chat).

import net from "node:net";
import { MAX_BYTES_XML } from "@/lib/xml/validador";
import { SOCKET_HOST, SOCKET_NOME, SOCKET_PORTA } from "@/lib/socket/config";
import {
  LeitorProtocolo,
  lerListaConectados,
  linhaDeTexto,
  montarPedacos,
  type PedacoRecebido,
} from "@/lib/socket/protocolo";
import { gravarConectados } from "@/lib/socket/estado";
import { ehConsulta, responderConsulta } from "@/lib/socket/consultas";
import { receberMovimento } from "@/lib/integracao/envios";
import {
  linhaParaEnviar,
  marcarEnviada,
  pegarFila,
  registrarEnviadaPeloOuvinte,
  registrarRecebida,
} from "@/lib/socket/chat";

const ESPERA_RECONEXAO_MS = 5000;
const ESPERA_NOME_MS = 10_000;
const BATIMENTO_MS = Number(process.env.SOCKET_BATIMENTO_MS || 60_000);
const FILA_MS = 1500;

// O pedaco de tamanho 0 que marca o fim do arquivo e convencao do nosso
// cliente; o de outro grupo pode nao mandar. Sem pedaco novo por esse tempo,
// o arquivo e processado com o que chegou, em vez de ficar esperando para
// sempre sem ninguem saber.
const ESPERA_FIM_ARQUIVO_MS = Number(process.env.SOCKET_ESPERA_FIM_MS || 10_000);

interface ArquivoEmAndamento {
  partes: Buffer[];
  tamanho: number;
  timer?: NodeJS.Timeout;
}

// Rate limit do socket: arquivos (envios e consultas) por remetente a cada
// minuto. Aqui basta memoria: o ouvinte e um processo so, ao contrario da API
// na Vercel (lib/integracao/limite.ts). O chat de texto nao entra na conta.
const LIMITE_SOCKET_MINUTO = Number(process.env.SOCKET_LIMITE_MINUTO || 30);
const arquivosPorRemetente = new Map<string, { janela: number; contagem: number }>();

/** Segundos ate a proxima janela se o remetente estourou o limite; 0 se pode. */
function esperaDoLimite(remetente: string): number {
  // Pelo nome, sem o id: reconectar da outro id, mas e o mesmo sistema.
  const nome = remetente.slice(0, remetente.lastIndexOf("#")).toLowerCase() || remetente;
  const janela = Math.floor(Date.now() / 60_000);
  const atual = arquivosPorRemetente.get(nome);
  const contagem = atual && atual.janela === janela ? atual.contagem + 1 : 1;
  arquivosPorRemetente.set(nome, { janela, contagem });
  return contagem > LIMITE_SOCKET_MINUTO ? Math.ceil(((janela + 1) * 60_000 - Date.now()) / 1000) : 0;
}

function log(texto: string) {
  console.log(`${new Date().toLocaleTimeString("pt-BR")}  ${texto}`);
}

// Gravacoes no banco uma de cada vez, na ordem em que as linhas chegaram. A
// primeira consulta abre a conexao e demora mais: sem fila, uma lista de
// conectados velha terminava de gravar depois da nova e a sobrescrevia, e
// mensagens do chat podiam ficar fora de ordem.
let gravacoes: Promise<void> = Promise.resolve();
function gravarEmOrdem(descricao: string, gravar: () => Promise<void>) {
  gravacoes = gravacoes.then(gravar).catch((erro) => log(`erro ao gravar ${descricao}: ${String(erro)}`));
}

function conectar() {
  const socket = net.connect({ host: SOCKET_HOST, port: SOCKET_PORTA });
  // Chave "remetente/nome": dois remetentes podem mandar arquivos ao mesmo
  // tempo, e os pedacos chegam intercalados.
  const emAndamento = new Map<string, ArquivoEmAndamento>();

  // So depois de o servidor confirmar o nome a fila do chat e enviada:
  // antes disso a mensagem sairia como "clienteN".
  let nomeConfirmado = false;

  function responder(remetente: string, texto: string) {
    const id = remetente.slice(remetente.lastIndexOf("#") + 1);
    if (socket.destroyed) return;
    socket.write(`#${id} ${linhaDeTexto(texto)}\n`);
    gravarEmOrdem("no chat", () => registrarEnviadaPeloOuvinte(remetente, texto));
  }

  // Consulta so le o banco, entao e respondida na hora, sem passar pela
  // aprovacao da caixa de entrada. A resposta vai como arquivo, pela mesma
  // conexao, para o id de quem perguntou.
  async function atenderConsulta(remetente: string, nomeArquivo: string, conteudo: string) {
    const resposta = await responderConsulta(conteudo);
    if (!resposta.ok) {
      log(`recusada consulta "${nomeArquivo}" de ${remetente}: ${resposta.erro}`);
      responder(remetente, `"${nomeArquivo}" recusado: ${resposta.erro}`);
      return;
    }

    const id = remetente.slice(remetente.lastIndexOf("#") + 1);
    if (socket.destroyed) return;
    // Todos os pedacos num laco so, sem await no meio: a fila do chat tambem
    // escreve arquivos nesta conexao, e um pedaco nao pode cair no meio do
    // outro.
    for (const pedaco of montarPedacos(resposta.nomeArquivo, Buffer.from(resposta.xml, "utf8"), id)) {
      socket.write(pedaco);
    }
    log(`consulta "${nomeArquivo}" de ${remetente} respondida com "${resposta.nomeArquivo}": ${resposta.resumo}`);
    gravarEmOrdem("no chat", () =>
      registrarEnviadaPeloOuvinte(remetente, `"${resposta.nomeArquivo}" enviado: ${resposta.resumo}`)
    );
  }

  async function processarArquivo(remetente: string, nomeArquivo: string, arquivo: ArquivoEmAndamento) {
    const espera = esperaDoLimite(remetente);
    if (espera > 0) {
      log(`recusado "${nomeArquivo}" de ${remetente}: passou de ${LIMITE_SOCKET_MINUTO} arquivos por minuto`);
      responder(
        remetente,
        `"${nomeArquivo}" recusado: limite de ${LIMITE_SOCKET_MINUTO} arquivos por minuto. Tente de novo em ${espera}s.`
      );
      return;
    }
    if (!nomeArquivo.toLowerCase().endsWith(".xml")) {
      log(`ignorado "${nomeArquivo}" de ${remetente}: não é XML`);
      responder(remetente, `"${nomeArquivo}" ignorado: o Finanweb recebe só arquivos .xml.`);
      return;
    }
    if (arquivo.tamanho > MAX_BYTES_XML) {
      log(`recusado "${nomeArquivo}" de ${remetente}: maior que 10 MB`);
      responder(remetente, `"${nomeArquivo}" recusado: o limite é de 10 MB por XML.`);
      return;
    }

    const conteudo = Buffer.concat(arquivo.partes).toString("utf8");
    if (ehConsulta(conteudo)) {
      await atenderConsulta(remetente, nomeArquivo, conteudo);
      return;
    }

    // Mesmo caminho do REST e do SOAP (lib/integracao/envios.ts). O socket
    // tambem aceita o v1, para reimportar o que o Finanweb exportou.
    const recebido = await receberMovimento(conteudo, { remetente, nomeArquivo, aceitaV1: true });
    if (!recebido.ok) {
      log(`recusado "${nomeArquivo}" de ${remetente}: ${recebido.erro}`);
      responder(remetente, `"${nomeArquivo}" recusado: ${recebido.erro}`);
      return;
    }
    log(`recebido "${nomeArquivo}" (${recebido.tipo}) de ${remetente}, aguardando aprovação`);
    responder(remetente, `"${nomeArquivo}" recebido (${recebido.tipo}), aguardando aprovação no Finanweb.`);
  }

  function finalizarArquivo(chave: string, remetente: string, nomeArquivo: string) {
    const arquivo = emAndamento.get(chave);
    if (!arquivo) return;
    clearTimeout(arquivo.timer);
    emAndamento.delete(chave);
    processarArquivo(remetente, nomeArquivo, arquivo).catch((erro) =>
      log(`erro ao processar "${nomeArquivo}": ${String(erro)}`)
    );
  }

  function aoReceberPedaco({ remetente, nomeArquivo, dados }: PedacoRecebido) {
    const chave = `${remetente}/${nomeArquivo}`;
    let arquivo = emAndamento.get(chave);
    if (!arquivo) {
      arquivo = { partes: [], tamanho: 0 };
      emAndamento.set(chave, arquivo);
      log(`recebendo "${nomeArquivo}" de ${remetente}...`);
    }

    if (dados.length === 0) {
      finalizarArquivo(chave, remetente, nomeArquivo);
      return;
    }

    arquivo.tamanho += dados.length;
    // Passou do limite: para de acumular, so conta, e recusa no fim.
    if (arquivo.tamanho <= MAX_BYTES_XML) arquivo.partes.push(dados);

    clearTimeout(arquivo.timer);
    arquivo.timer = setTimeout(() => {
      log(`"${nomeArquivo}" de ${remetente}: sem o pedaço final, processando os ${arquivo.tamanho} bytes recebidos`);
      finalizarArquivo(chave, remetente, nomeArquivo);
    }, ESPERA_FIM_ARQUIVO_MS);
  }

  function aoReceberTexto(linha: string) {
    // Resposta do /lista (batimento ou mudanca na sala): vira o estado que as
    // telas mostram. Nao vai pro log nem pro chat.
    const conectados = lerListaConectados(linha);
    if (conectados) {
      gravarEmOrdem("conectados", () => gravarConectados(conectados));
      return;
    }

    // Reconectou antes de o servidor notar que a conexao antiga caiu: o nome
    // ainda esta preso nela. Sem insistir, o ouvinte ficaria como "clienteN"
    // e os arquivos mandados para #finanweb nao chegariam.
    if (linha.includes(`o nome '${SOCKET_NOME}' já está em uso`)) {
      log(`nome "${SOCKET_NOME}" ainda em uso, tentando de novo em ${ESPERA_NOME_MS / 1000}s`);
      setTimeout(() => !socket.destroyed && socket.write(`/nome ${SOCKET_NOME}\n`), ESPERA_NOME_MS);
      return;
    }
    log(linha);

    // As boas-vindas e a troca de nome falam desta conexao, nao da conversa.
    if (linha.startsWith("[servidor] bem-vindo")) return;
    if (linha.startsWith(`[servidor] agora você é ${SOCKET_NOME}#`)) {
      nomeConfirmado = true;
      socket.write("/lista\n");
      return;
    }
    // Alguem entrou, saiu ou trocou de nome: atualiza a lista na hora, sem
    // esperar o proximo batimento.
    if (/^\[servidor\] .+ (entrou|saiu|agora é \S+)$/.test(linha)) socket.write("/lista\n");

    gravarEmOrdem("no chat", () => registrarRecebida(linha));
  }

  // Fila do chat: mensagens escritas na tela /chat esperando para sair.
  let enviandoFila = false;
  const fila = setInterval(async () => {
    if (!nomeConfirmado || enviandoFila || socket.destroyed) return;
    enviandoFila = true;
    try {
      for (const mensagem of await pegarFila()) {
        if (mensagem.arquivo && mensagem.arquivoNome) {
          // Destino null = envio geral do servidor, que nao devolve para quem
          // mandou: o arquivo nao volta para a nossa propria caixa de entrada.
          for (const pedaco of montarPedacos(mensagem.arquivoNome, Buffer.from(mensagem.arquivo), mensagem.destino)) {
            socket.write(pedaco);
          }
          log(`arquivo: [${mensagem.autor}] -> ${mensagem.destino ?? "todos"}: ${mensagem.arquivoNome}`);
        } else {
          socket.write(linhaParaEnviar(mensagem));
          log(`chat: [${mensagem.autor}] -> ${mensagem.destino ?? "todos"}: ${mensagem.texto}`);
        }
        await marcarEnviada(mensagem.id);
      }
    } catch (erro) {
      log(`erro na fila do chat: ${String(erro)}`);
    } finally {
      enviandoFila = false;
    }
  }, FILA_MS);

  const leitor = new LeitorProtocolo(aoReceberTexto, aoReceberPedaco);

  // Batimento: uma queda de rede sem aviso deixa o socket "aberto" sem nada
  // chegando, e o ouvinte pararia de receber em silencio. Um /lista por minuto
  // sempre tem resposta; sem resposta por 3 batimentos, derruba e reconecta.
  let ultimaResposta = Date.now();
  const batimento = setInterval(() => {
    if (Date.now() - ultimaResposta > 3 * BATIMENTO_MS) {
      log("servidor sem responder, reconectando");
      socket.destroy();
      return;
    }
    socket.write("/lista\n");
  }, BATIMENTO_MS);

  socket.on("connect", () => {
    log(`conectado em ${SOCKET_HOST}:${SOCKET_PORTA}`);
    socket.write(`/nome ${SOCKET_NOME}\n`);
  });
  socket.on("data", (dados) => {
    ultimaResposta = Date.now();
    leitor.alimentar(dados);
  });
  socket.on("error", (erro: NodeJS.ErrnoException) => log(`erro de conexão: ${erro.code ?? erro.message}`));
  socket.on("close", () => {
    clearInterval(batimento);
    clearInterval(fila);
    log(`desconectado, tentando de novo em ${ESPERA_RECONEXAO_MS / 1000}s`);
    setTimeout(conectar, ESPERA_RECONEXAO_MS);
  });
}

if (!process.env.BLOB_READ_WRITE_TOKEN) {
  console.error("BLOB_READ_WRITE_TOKEN não definido: rode pelo npm run socket, que carrega o .env.");
  process.exit(1);
}

log(`ouvinte do Finanweb como "${SOCKET_NOME}" (Ctrl+C para sair)`);
conectar();
