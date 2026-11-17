// Servico SOAP 1.1 do Finanweb (POST /api/soap, WSDL em /api/soap?wsdl).
//
// Estilo document/literal: o soap:Body leva o mesmo elemento que iria como
// arquivo pelo socket (movimento, folha, consultas), entao o XSD e o codigo
// sao os mesmos. A operacao e escolhida pelo elemento do Body, nao pelo
// SOAPAction. So as mensagens sem equivalente no socket (confirmacao de
// envio, consulta de avisos) tem schema proprio: servico-v1.xsd.
//
// A chave do setor vai no cabecalho HTTP Authorization, como no REST; a rota
// confere a chave e o rate limit antes, e aqui so se confere que a origem da
// mensagem e o setor da chave.
//
// soap:Header: o cliente pode mandar um <controle> (servico-v1.xsd) com o
// idMensagem dele; toda resposta volta com um <controle> com o mesmo
// idMensagem (ou um gerado), a operacao executada e a hora. Bloco de header
// com soap:mustUnderstand="1" que o servico nao conhece volta como Fault
// MustUnderstand, como manda o SOAP 1.1.

import { origemDeOutroSetor } from "@/lib/integracao/acesso";
import { carimbo, receberMovimento } from "@/lib/integracao/envios";
import { lerNamespaceRaiz } from "@/lib/socket/caixa-entrada";
import { ehConsulta, responderConsulta } from "@/lib/socket/consultas";
import { listarAvisos } from "@/lib/socket/avisos";
import { escaparXml } from "@/lib/xml/escape";
import { MAX_BYTES_XML, validarContraXsd } from "@/lib/xml/validador";

export const NS_SOAP = "http://schemas.xmlsoap.org/soap/envelope/";
export const NS_SERVICO = "urn:finanweb:servico:1.0";

export interface RespostaSoap {
  status: number;
  xml: string;
}

const DECLARACAO = '<?xml version="1.0" encoding="UTF-8"?>';

/** Declaracoes xmlns de uma tag: prefixo ("" = padrao) -> namespace. */
function declaracoes(atributos: string): Map<string, string> {
  const mapa = new Map<string, string>();
  for (const [, prefixo = "", , uri] of atributos.matchAll(/\bxmlns(?::([\w.-]+))?\s*=\s*(["'])(.*?)\2/g)) {
    mapa.set(prefixo, uri);
  }
  return mapa;
}

function escaparRegex(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Tira o elemento de dentro do soap:Body como um documento XML proprio, no
 * formato dos contratos: namespace padrao e sem prefixo. Ferramentas como o
 * SoapUI declaram o namespace do contrato no Envelope e prefixam cada
 * elemento (<ven:movimento>); sem a normalizacao, o XSD e os parsers do
 * Finanweb nao reconheceriam o documento.
 */
export interface CabecalhoSoap {
  // idMensagem do <controle> do cliente, se veio.
  idMensagem?: string;
  // Nome do primeiro bloco com mustUnderstand="1" que o servico nao entende.
  naoEntendido?: string;
}

const REGEX_ID_MENSAGEM = /^[A-Za-z0-9._:-]{1,64}$/;

/** Le o soap:Header: o <controle> do Finanweb e os blocos obrigatorios. */
function lerCabecalho(texto: string, prefixoSoap: string, nsEnvelope: Map<string, string>): CabecalhoSoap {
  const header = new RegExp(`<${prefixoSoap}Header\\b([^>]*?)(?:/>|>([\\s\\S]*?)</${prefixoSoap}Header\\s*>)`).exec(texto);
  if (!header?.[2]) return {};
  const herdadas = new Map([...nsEnvelope, ...declaracoes(header[1])]);
  const cabecalho: CabecalhoSoap = {};
  for (const [, prefixo = "", nome, atributos] of header[2].matchAll(/<(?:([\w.-]+):)?([\w.-]+)\b([^>]*?)\/?>/g)) {
    const namespace = declaracoes(atributos).get(prefixo) ?? herdadas.get(prefixo);
    const doFinanweb = namespace === NS_SERVICO && nome === "controle";
    if (!doFinanweb && /\bmustUnderstand\s*=\s*["'](1|true)["']/.test(atributos) && !cabecalho.naoEntendido) {
      cabecalho.naoEntendido = `${prefixo ? `${prefixo}:` : ""}${nome}`;
    }
  }
  const id = /<(?:[\w.-]+:)?idMensagem>\s*([^<]*?)\s*<\/(?:[\w.-]+:)?idMensagem>/.exec(header[2])?.[1];
  if (id !== undefined) cabecalho.idMensagem = id;
  return cabecalho;
}

export function extrairCorpo(
  envelope: string
): { ok: true; xml: string; cabecalho: CabecalhoSoap } | { ok: false; erro: string } {
  const texto = envelope.replace(/<\?xml[^>]*\?>/, "").replace(/<!--[\s\S]*?-->/g, "");

  const abertura = /<(?:([\w.-]+):)?Envelope\b([^>]*)>/.exec(texto);
  const nsEnvelope = abertura ? declaracoes(abertura[2]) : new Map<string, string>();
  if (!abertura || nsEnvelope.get(abertura[1] ?? "") !== NS_SOAP) {
    return { ok: false, erro: `não é um envelope SOAP 1.1 (soap:Envelope no namespace ${NS_SOAP}).` };
  }

  const prefixoSoap = abertura[1] ? `${escaparRegex(abertura[1])}:` : "";
  const body = new RegExp(`<${prefixoSoap}Body\\b([^>]*)>([\\s\\S]*)</${prefixoSoap}Body\\s*>`).exec(texto);
  if (!body) return { ok: false, erro: "o envelope não tem soap:Body." };

  const herdadas = new Map([...nsEnvelope, ...declaracoes(body[1])]);
  const conteudo = body[2].trim();
  const filho = /^<(?:([\w.-]+):)?([\w.-]+)\b([^>]*?)(\/?)>/.exec(conteudo);
  if (!filho) return { ok: false, erro: "o soap:Body está vazio." };

  const [, prefixo = "", nome, atributos, fechada] = filho;
  const proprias = declaracoes(atributos);
  const namespace = proprias.get(prefixo) ?? herdadas.get(prefixo);
  if (!namespace || namespace === NS_SOAP) {
    return { ok: false, erro: `o elemento <${nome}> do soap:Body não está no namespace de um contrato do Finanweb.` };
  }

  // Sem o prefixo do contrato no elemento e nos filhos: os contratos usam
  // namespace padrao.
  let fragmento = prefixo
    ? conteudo.replace(new RegExp(`(</?)${escaparRegex(prefixo)}:`, "g"), "$1")
    : conteudo;

  // A abertura e remontada com o namespace do contrato e as outras
  // declaracoes herdadas do Envelope (xsi, por exemplo), que o fragmento
  // perderia ao sair dele.
  const outras = [...herdadas]
    .filter(([p, uri]) => p !== "" && p !== prefixo && uri !== NS_SOAP && !proprias.has(p))
    .map(([p, uri]) => ` xmlns:${p}="${uri}"`)
    .join("");
  const atributosSemNs = atributos.replace(/\s+xmlns(?::[\w.-]+)?\s*=\s*(["']).*?\1/g, "");
  const novaAbertura = `<${nome} xmlns="${namespace}"${outras}${atributosSemNs}${fechada}>`;
  fragmento = novaAbertura + fragmento.slice(fragmento.indexOf(">") + 1);

  return { ok: true, xml: `${DECLARACAO}\n${fragmento}\n`, cabecalho: lerCabecalho(texto, prefixoSoap, nsEnvelope) };
}

export function semDeclaracao(xml: string): string {
  return xml.replace(/^\s*<\?xml[^>]*\?>\s*/, "").trim();
}

export function envelope(corpo: string): string {
  return `${DECLARACAO}
<soap:Envelope xmlns:soap="${NS_SOAP}">
  <soap:Body>
${corpo}
  </soap:Body>
</soap:Envelope>
`;
}

/** Poe o soap:Header de controle numa resposta ja montada por envelope(). */
export function comCabecalho(resposta: RespostaSoap, idMensagem: string, operacao?: string): RespostaSoap {
  const controle = `  <soap:Header>
    <controle xmlns="${NS_SERVICO}">
      <idMensagem>${escaparXml(idMensagem)}</idMensagem>${operacao ? `\n      <operacao>${operacao}</operacao>` : ""}
      <dataHora>${new Date().toISOString()}</dataHora>
    </controle>
  </soap:Header>
  <soap:Body>`;
  return { ...resposta, xml: resposta.xml.replace("  <soap:Body>", controle) };
}

/** idMensagem para quem nao mandou o seu. */
export function gerarIdMensagem(): string {
  return `fin-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// Operacao do WSDL pelo elemento do Body (namespace + nome da raiz).
const OPERACAO_POR_NAMESPACE: Record<string, string> = {
  "urn:finanweb:entrada:2.0": "EnviarVenda",
  "urn:finanweb:saida:2.0": "EnviarCompra",
  "urn:finanweb:folha:1.0": "EnviarFolha",
  "urn:finanweb:inadimplencia:1.0": "ConsultarInadimplencia",
  "urn:finanweb:pendencias-fornecedor:1.0": "ConsultarPendencias",
  "urn:finanweb:pagamentos-folha:1.0": "ConsultarPagamentosFolha",
};

function operacaoDoCorpo(xml: string): string | undefined {
  const namespace = lerNamespaceRaiz(xml) ?? "";
  if (namespace === NS_SERVICO) {
    const tipo = /^<consultaAvisos(Pagamento|Recebimento)\b/m.exec(semDeclaracao(xml))?.[1];
    return tipo ? `ConsultarAvisos${tipo}` : undefined;
  }
  return OPERACAO_POR_NAMESPACE[namespace];
}

// SOAP 1.1: falha volta com HTTP 500. Client = o pedido tem problema;
// Server = problema do nosso lado, vale tentar de novo. Chave e rate limit
// usam o status HTTP proprio (401, 403, 429), que os clientes tratam antes de
// ler o envelope.
export function falha(codigo: "Client" | "Server" | "MustUnderstand", mensagem: string, status = 500): RespostaSoap {
  return {
    status,
    xml: envelope(`<soap:Fault>
  <faultcode>soap:${codigo}</faultcode>
  <faultstring>${escaparXml(mensagem)}</faultstring>
</soap:Fault>`),
  };
}

// Nome do arquivo na caixa de entrada, pelo namespace do movimento.
const NOMES_ENVIO: Record<string, string> = {
  "urn:finanweb:entrada:2.0": "venda",
  "urn:finanweb:saida:2.0": "compra",
  "urn:finanweb:folha:1.0": "folha",
};

async function consultarAvisos(xml: string, setor: string): Promise<RespostaSoap> {
  const erros = await validarContraXsd(xml, "servico-v1.xsd");
  if (erros.length > 0) return falha("Client", `não passou no XSD: ${erros.slice(0, 3).join(" ")}`);
  // consultaAvisosPagamento ou consultaAvisosRecebimento: o resto e igual.
  const tipo = /^<consultaAvisos(Pagamento|Recebimento)\b/m.exec(semDeclaracao(xml))?.[1];
  if (!tipo) return falha("Client", "esperado <consultaAvisosPagamento> ou <consultaAvisosRecebimento> no soap:Body.");

  const desdeTexto = /<desde>([^<]+)<\/desde>/.exec(xml)?.[1];
  try {
    const desde = desdeTexto ? new Date(desdeTexto) : undefined;
    const avisos = await listarAvisos(tipo === "Pagamento" ? "pagamento" : "recebimento", setor, desde);
    const itens = avisos.map((a) => `<aviso geradoEm="${a.geradoEm.toISOString()}">\n${semDeclaracao(a.xml)}\n</aviso>`);
    const raiz = `respostaAvisos${tipo}`;
    return { status: 200, xml: envelope(`<${raiz} xmlns="${NS_SERVICO}">\n${itens.join("\n")}\n</${raiz}>`) };
  } catch (erro) {
    console.error(erro);
    return falha("Server", "Não foi possível consultar o Financeiro agora. Tente de novo em alguns minutos.");
  }
}

/**
 * Atende um POST em /api/soap: escolhe a operacao pelo elemento do Body.
 * setor: dono da chave, ja conferida pela rota.
 */
export async function atenderSoap(requisicao: string, setor: string): Promise<RespostaSoap> {
  if (Buffer.byteLength(requisicao, "utf8") > MAX_BYTES_XML) {
    return comCabecalho(falha("Client", "o limite é de 10 MB por requisição."), gerarIdMensagem());
  }
  const corpo = extrairCorpo(requisicao);
  if (!corpo.ok) return comCabecalho(falha("Client", corpo.erro), gerarIdMensagem());

  const { idMensagem, naoEntendido } = corpo.cabecalho;
  if (idMensagem !== undefined && !REGEX_ID_MENSAGEM.test(idMensagem)) {
    return comCabecalho(
      falha("Client", "idMensagem do <controle>: de 1 a 64 letras, dígitos, ponto, hífen, sublinhado ou dois-pontos."),
      gerarIdMensagem()
    );
  }
  const id = idMensagem ?? gerarIdMensagem();
  if (naoEntendido) {
    return comCabecalho(
      falha("MustUnderstand", `o bloco de header ${naoEntendido} tem mustUnderstand="1", mas o serviço não o conhece.`),
      id
    );
  }
  return comCabecalho(await responder(corpo.xml, setor), id, operacaoDoCorpo(corpo.xml));
}

/** Escolhe e executa a operacao pelo elemento do Body. */
async function responder(xml: string, setor: string): Promise<RespostaSoap> {
  const corpo = { xml };

  // Todas as mensagens tem <origem> (no cabecalho dos envios, na raiz das
  // consultas). Ausente, o XSD aponta; de outro setor, para aqui.
  const origem = /<origem>\s*([^<\s]+)\s*<\/origem>/.exec(corpo.xml)?.[1] ?? "";
  const outroSetor = origemDeOutroSetor(origem, setor);
  if (outroSetor) return falha("Client", outroSetor, 403);

  // Consultas: a resposta do contrato vai direto no Body, como no socket.
  if (ehConsulta(corpo.xml)) {
    const resposta = await responderConsulta(corpo.xml);
    if (!resposta.ok) return falha("Client", resposta.erro);
    return { status: 200, xml: envelope(semDeclaracao(resposta.xml)) };
  }

  const namespace = lerNamespaceRaiz(corpo.xml) ?? "";
  if (namespace === NS_SERVICO) return consultarAvisos(corpo.xml, setor);

  // Envios: mesma caixa de entrada do socket e do REST.
  const recebido = await receberMovimento(corpo.xml, {
    remetente: `${setor} (SOAP)`,
    nomeArquivo: `${NOMES_ENVIO[namespace] ?? "movimento"}-${setor}-${carimbo()}.xml`,
  });
  if (!recebido.ok) return falha(recebido.motivo === "FALHA" ? "Server" : "Client", recebido.erro);

  return {
    status: 200,
    xml: envelope(`<confirmacaoEnvio xmlns="${NS_SERVICO}">
  <situacao>AGUARDANDO_APROVACAO</situacao>
  <tipo>${recebido.tipo}</tipo>
  <mensagem>Recebido. O lançamento acontece quando o Financeiro aprovar a importação.</mensagem>
</confirmacaoEnvio>`),
  };
}
