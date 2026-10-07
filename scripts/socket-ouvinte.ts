// Ouvinte de socket do Finanweb: fica conectado ao servidor de chat da
// disciplina e guarda os XMLs de Entrada/Saida que chegam, para alguem
// aprovar a importacao na tela /socket.
//
// Roda fora da Vercel, porque funcao serverless nao fica conectada esperando:
//   npm run socket
//
// Precisa do BLOB_READ_WRITE_TOKEN do .env (e la que a caixa de entrada fica).
// Responde ao remetente no proprio chat, em privado, se o arquivo foi aceito.

import net from "node:net";
import { MAX_BYTES_XML, SCHEMA_POR_TIPO, validarContraXsd } from "@/lib/xml/validador";
import { SOCKET_HOST, SOCKET_NOME, SOCKET_PORTA } from "@/lib/socket/config";
import { LeitorProtocolo, linhaDeTexto, type PedacoRecebido } from "@/lib/socket/protocolo";
import { detectarTipoMovimento, guardarRecebido } from "@/lib/socket/caixa-entrada";

const ESPERA_RECONEXAO_MS = 5000;
const ESPERA_NOME_MS = 10_000;
const BATIMENTO_MS = Number(process.env.SOCKET_BATIMENTO_MS || 60_000);

interface ArquivoEmAndamento {
  partes: Buffer[];
  tamanho: number;
}

function log(texto: string) {
  console.log(`${new Date().toLocaleTimeString("pt-BR")}  ${texto}`);
}

function conectar() {
  const socket = net.connect({ host: SOCKET_HOST, port: SOCKET_PORTA });
  // Chave "remetente/nome": dois remetentes podem mandar arquivos ao mesmo
  // tempo, e os pedacos chegam intercalados.
  const emAndamento = new Map<string, ArquivoEmAndamento>();

  function responder(remetente: string, texto: string) {
    const id = remetente.slice(remetente.lastIndexOf("#") + 1);
    if (!socket.destroyed) socket.write(`#${id} ${linhaDeTexto(texto)}\n`);
  }

  async function processarArquivo(remetente: string, nomeArquivo: string, arquivo: ArquivoEmAndamento) {
    if (!nomeArquivo.toLowerCase().endsWith(".xml")) {
      log(`ignorado "${nomeArquivo}" de ${remetente}: não é XML`);
      responder(remetente, `"${nomeArquivo}" ignorado: o Finanweb recebe só XML de Entrada ou Saída.`);
      return;
    }
    if (arquivo.tamanho > MAX_BYTES_XML) {
      log(`recusado "${nomeArquivo}" de ${remetente}: maior que 10 MB`);
      responder(remetente, `"${nomeArquivo}" recusado: o limite é de 10 MB por XML.`);
      return;
    }

    const conteudo = Buffer.concat(arquivo.partes).toString("utf8");
    const tipo = detectarTipoMovimento(conteudo);
    if (!tipo) {
      log(`recusado "${nomeArquivo}" de ${remetente}: namespace desconhecido`);
      responder(
        remetente,
        `"${nomeArquivo}" recusado: não é um movimento do Finanweb (namespace urn:finanweb:entrada:1.0 ou urn:finanweb:saida:1.0).`
      );
      return;
    }

    // Validar ja na chegada da a resposta na hora para quem mandou, em vez de
    // o erro so aparecer quando alguem tentar aprovar.
    const erros = await validarContraXsd(conteudo, SCHEMA_POR_TIPO[tipo]);
    if (erros.length > 0) {
      log(`recusado "${nomeArquivo}" de ${remetente}: ${erros[0]}`);
      responder(remetente, `"${nomeArquivo}" recusado pelo XSD: ${erros.slice(0, 3).join(" ")}`);
      return;
    }

    try {
      await guardarRecebido({ remetente, nomeArquivo, tipo }, conteudo);
    } catch (erro) {
      log(`erro ao guardar "${nomeArquivo}": ${String(erro)}`);
      responder(remetente, `"${nomeArquivo}" não pôde ser guardado no Finanweb. Tente de novo.`);
      return;
    }
    log(`recebido "${nomeArquivo}" (${tipo}) de ${remetente}, aguardando aprovação`);
    responder(remetente, `"${nomeArquivo}" recebido (${tipo}), aguardando aprovação no Finanweb.`);
  }

  function aoReceberPedaco({ remetente, nomeArquivo, dados }: PedacoRecebido) {
    const chave = `${remetente}/${nomeArquivo}`;
    const arquivo = emAndamento.get(chave) ?? { partes: [], tamanho: 0 };
    emAndamento.set(chave, arquivo);

    if (dados.length > 0) {
      arquivo.tamanho += dados.length;
      // Passou do limite: para de acumular, so conta, e recusa no fim.
      if (arquivo.tamanho <= MAX_BYTES_XML) arquivo.partes.push(dados);
      return;
    }

    emAndamento.delete(chave);
    processarArquivo(remetente, nomeArquivo, arquivo).catch((erro) =>
      log(`erro ao processar "${nomeArquivo}": ${String(erro)}`)
    );
  }

  function aoReceberTexto(linha: string) {
    // Resposta do batimento: so prova que a conexao esta viva, nao vai pro log.
    if (linha.startsWith("[servidor] conectados:")) return;

    // Reconectou antes de o servidor notar que a conexao antiga caiu: o nome
    // ainda esta preso nela. Sem insistir, o ouvinte ficaria como "clienteN"
    // e os arquivos mandados para #finanweb nao chegariam.
    if (linha.includes(`o nome '${SOCKET_NOME}' já está em uso`)) {
      log(`nome "${SOCKET_NOME}" ainda em uso, tentando de novo em ${ESPERA_NOME_MS / 1000}s`);
      setTimeout(() => !socket.destroyed && socket.write(`/nome ${SOCKET_NOME}\n`), ESPERA_NOME_MS);
      return;
    }
    log(linha);
  }

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
