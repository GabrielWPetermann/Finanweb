// Contrato da API REST em OpenAPI 3.0 (GET /api/v1/openapi.json), o
// equivalente do WSDL para o SOAP. Os campos e padroes repetem os dos XSDs:
// o JSON vira o XML do contrato e passa pelo XSD, que continua sendo a
// referencia (ver lib/integracao/json.ts).

type Schema = Record<string, unknown>;

const ref = (nome: string): Schema => ({ $ref: `#/components/schemas/${nome}` });
const texto = (descricao?: string, extra: Schema = {}): Schema => ({ type: "string", ...(descricao ? { description: descricao } : {}), ...extra });
const data = texto("AAAA-MM-DD", { format: "date" });
// Envios aceitam numero ou texto ("1450.00"); respostas devolvem numero.
const valorEntrada: Schema = { oneOf: [{ type: "number", minimum: 0 }, { type: "string", pattern: "^\\d{1,12}(\\.\\d{1,2})?$" }], example: "1450.00" };
const valorSaida: Schema = { type: "number", minimum: 0, example: 1450 };
const documento = texto("CPF (11) ou CNPJ (14), só dígitos", { pattern: "^(\\d{11}|\\d{14})$" });
const cpf = texto("CPF, só dígitos", { pattern: "^\\d{11}$" });
const origem = texto("Nome do setor no servidor da turma", { pattern: "^[a-z][a-z0-9-]{1,29}$", example: "vendas" });
const referencia = texto("Identificador do registro no sistema do setor", { pattern: "^[A-Za-z0-9][A-Za-z0-9._/-]{0,59}$" });
const status = texto(undefined, { enum: ["PENDENTE", "CONFIRMADO", "CANCELADO"] });
const obj = (properties: Record<string, Schema>, required: string[] = Object.keys(properties)): Schema => ({
  type: "object",
  required,
  properties,
});

const SCHEMAS: Record<string, Schema> = {
  Cabecalho: obj({
    empresa: texto(undefined, { maxLength: 120 }),
    cnpj: texto(undefined, { pattern: "^\\d{14}$" }),
    origem,
    dataArquivo: data,
    usuario: texto(undefined, { maxLength: 120 }),
  }),
  Pedido: obj({
    referencia,
    status,
    cliente: obj({ nome: texto(undefined, { maxLength: 120 }), documento }),
    categoria: texto(),
    subtotal: valorEntrada,
    desconto: obj({ valor: valorEntrada, percentual: valorEntrada }),
    frete: valorEntrada,
    valorTotal: { ...valorEntrada, description: "subtotal - desconto + frete" },
    formaPagamento: texto(),
    dataPedido: data,
    vencimento: { ...data, description: "Não pode ser anterior a dataPedido" },
  }),
  Venda: obj({
    cabecalho: ref("Cabecalho"),
    pedidos: { type: "array", minItems: 1, items: ref("Pedido") },
    totalizador: obj({ qtdRegistros: { type: "integer", minimum: 1 }, valorTotalGeral: valorEntrada }),
  }),
  Despesa: obj({
    referencia,
    status,
    fornecedor: obj({ nome: texto(undefined, { maxLength: 120 }), documento }),
    categoria: texto(),
    valor: valorEntrada,
    formaPagamento: texto(),
    dataEmissao: data,
    vencimento: { ...data, description: "Não pode ser anterior a dataEmissao" },
  }),
  Compra: obj({
    cabecalho: ref("Cabecalho"),
    despesas: { type: "array", minItems: 1, items: ref("Despesa") },
    totalizador: obj({ qtdRegistros: { type: "integer", minimum: 1 }, valorTotalGeral: valorEntrada }),
  }),
  Funcionario: obj(
    {
      cpf,
      matricula: texto(undefined, { pattern: "^[A-Za-z0-9-]{1,20}$" }),
      nome: texto(undefined, { maxLength: 120 }),
      salarioBruto: valorEntrada,
      descontos: valorEntrada,
      salarioLiquido: { ...valorEntrada, description: "salarioBruto - descontos" },
    },
    ["cpf", "nome", "salarioBruto", "descontos", "salarioLiquido"]
  ),
  Folha: obj({
    referencia,
    cabecalho: ref("Cabecalho"),
    competencia: texto("AAAA-MM", { pattern: "^\\d{4}-\\d{2}$" }),
    dataPagamento: data,
    funcionarios: { type: "array", minItems: 1, items: ref("Funcionario") },
    totalizador: obj({ qtdFuncionarios: { type: "integer", minimum: 1 }, valorLiquidoTotal: valorEntrada }),
  }),
  ConfirmacaoEnvio: obj({
    ok: { type: "boolean", enum: [true] },
    situacao: texto(undefined, { enum: ["AGUARDANDO_APROVACAO"] }),
    tipo: texto(undefined, { enum: ["ENTRADA", "SAIDA", "FOLHA"] }),
    mensagem: texto(),
  }),
  Erro: obj({ ok: { type: "boolean", enum: [false] }, erro: texto("Motivo, com o campo fora do contrato") }),
  RespostaInadimplencia: obj(
    {
      id: texto(),
      dataConsulta: data,
      documento,
      situacao: texto(undefined, { enum: ["ADIMPLENTE", "INADIMPLENTE", "SEM_CADASTRO"] }),
      valorEmAtraso: valorSaida,
      titulos: {
        type: "array",
        items: obj(
          { referencia: { ...referencia, nullable: true }, valor: valorSaida, vencimento: data, diasAtraso: { type: "integer" } },
          ["valor", "vencimento", "diasAtraso"]
        ),
      },
      erro: texto("Só quando o Financeiro não conseguiu responder (HTTP 503)"),
    },
    ["id", "dataConsulta"]
  ),
  RespostaPendencias: obj(
    {
      id: texto(),
      dataConsulta: data,
      pendencias: {
        type: "array",
        items: obj({
          referencia: { ...referencia, nullable: true },
          fornecedor: obj({ nome: texto(), documento: { ...documento, nullable: true } }),
          categoria: texto(),
          valor: valorSaida,
          vencimento: data,
        }),
      },
      totalizador: obj({ qtdPendencias: { type: "integer" }, valorTotal: valorSaida }),
      erro: texto("Só quando o Financeiro não conseguiu responder (HTTP 503)"),
    },
    ["id", "dataConsulta"]
  ),
  RespostaPagamentosFolha: obj(
    {
      id: texto(),
      dataConsulta: data,
      pagamentos: {
        type: "array",
        items: obj({
          folha: referencia,
          cpf,
          nome: texto(),
          valor: valorSaida,
          situacao: texto(undefined, { enum: ["PAGO", "PENDENTE", "CANCELADO"] }),
          dataPrevista: data,
          dataPagamento: { ...data, nullable: true, description: "Só quando PAGO" },
        }),
      },
      totalizador: obj({
        qtdPagos: { type: "integer" },
        valorPago: valorSaida,
        qtdPendentes: { type: "integer" },
        valorPendente: valorSaida,
      }),
      erro: texto("Só quando o Financeiro não conseguiu responder (HTTP 503)"),
    },
    ["id", "dataConsulta"]
  ),
  AvisoPagamento: obj({
    id: texto(),
    dataAviso: data,
    origem,
    referencia,
    cpf: { ...cpf, nullable: true, description: "Só nos salários da folha" },
    situacao: texto(undefined, { enum: ["PAGO", "CANCELADO"] }),
    favorecido: obj({ nome: texto(), documento: { ...documento, nullable: true } }),
    valor: valorSaida,
    dataPagamento: { ...data, nullable: true, description: "Só quando PAGO" },
    geradoEm: texto("Use o do último como `desde` na próxima busca", { format: "date-time" }),
  }),
  Servico: obj({
    setor: origem,
    nome: texto(),
    versao: texto(undefined, { example: "1.0" }),
    protocolo: texto(undefined, { enum: ["SOCKET", "REST", "SOAP"] }),
    endpoint: texto("URL; no SOCKET, o destino no servidor da turma"),
    operacao: { ...texto("Método HTTP ou operação SOAP"), nullable: true },
    contrato: { ...texto("URL do XSD, WSDL ou documentação"), nullable: true },
    consumidor: { ...texto(), nullable: true },
    descricao: texto(),
    situacao: texto(undefined, { enum: ["ATIVO", "DEPRECIADO", "DESATIVADO"] }),
    publicadoEm: { ...texto(undefined, { format: "date-time" }), nullable: true },
    atualizadoEm: { ...texto(undefined, { format: "date-time" }), nullable: true },
  }),
  PublicacaoServico: obj(
    {
      nome: texto(undefined, { maxLength: 120 }),
      versao: texto(undefined, { pattern: "^\\d{1,3}(\\.\\d{1,3}){0,2}$" }),
      protocolo: texto(undefined, { enum: ["SOCKET", "REST", "SOAP"] }),
      endpoint: texto(undefined, { maxLength: 300 }),
      operacao: texto(undefined, { maxLength: 120 }),
      contrato: texto(undefined, { format: "uri", maxLength: 300 }),
      consumidor: texto(undefined, { maxLength: 120 }),
      descricao: texto(undefined, { maxLength: 1000 }),
      situacao: texto(undefined, { enum: ["ATIVO", "DEPRECIADO", "DESATIVADO"], default: "ATIVO" }),
    },
    ["nome", "versao", "protocolo", "endpoint"]
  ),
};

const json = (schema: Schema, descricao: string) => ({ description: descricao, content: { "application/json": { schema } } });
const erro = (descricao: string) => json(ref("Erro"), descricao);

// Todo servico de negocio pede a chave do setor e conta no rate limit dele.
const CHAVE = [{ chaveSetor: [] }];
const RESPOSTAS_ACESSO = {
  "401": erro("Sem chave ou chave inválida"),
  "403": erro("A origem não é o setor da chave"),
  "429": erro("Limite de requisições por minuto atingido; veja Retry-After"),
};
const parametro = (nome: string, obrigatorio: boolean, schema: Schema, descricao?: string) => ({
  name: nome,
  in: "query",
  required: obrigatorio,
  schema,
  ...(descricao ? { description: descricao } : {}),
});
const idConsulta = parametro("id", false, texto(undefined, { pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$" }), "Volta na resposta; sem ele, um é gerado");

function envio(resumo: string, schema: string, tag: string) {
  return {
    post: {
      tags: [tag],
      summary: resumo,
      description:
        "Vai para a caixa de entrada do Financeiro; o lançamento acontece quando ele aprova. A origem do cabeçalho tem que ser o setor da chave.",
      security: CHAVE,
      requestBody: { required: true, content: { "application/json": { schema: ref(schema) } } },
      responses: {
        "202": json(ref("ConfirmacaoEnvio"), "Recebido, aguardando aprovação"),
        "400": erro("Corpo não é um objeto JSON"),
        ...RESPOSTAS_ACESSO,
        "422": erro("Fora do contrato (XSD ou regra entre campos)"),
        "503": erro("Falha do lado do Financeiro; tente de novo"),
      },
    },
  };
}

function consulta(resumo: string, schema: string, tag: string, parametros: unknown[]) {
  return {
    get: {
      tags: [tag],
      summary: resumo,
      security: CHAVE,
      parameters: [...parametros, idConsulta],
      responses: {
        "200": json(ref(schema), "Resposta"),
        "400": erro("Consulta inválida (parâmetro fora do contrato)"),
        ...RESPOSTAS_ACESSO,
        "503": json(ref(schema), "O Financeiro não conseguiu responder: só id, dataConsulta e erro"),
      },
    },
  };
}

/** base: origem publica do Finanweb, ex. https://finanwebsistema.vercel.app */
export function montarOpenApi(base: string): Schema {
  return {
    openapi: "3.0.3",
    info: {
      title: "Finanweb · API do Financeiro",
      version: "1.0.0",
      description:
        "Mesmas mensagens do socket e do SOAP, em JSON. O XSD de cada mensagem continua sendo a referência: " +
        `${base}/contratos. Cada setor se identifica com a chave dele (Authorization: Bearer), pedida ao Financeiro, ` +
        "e só envia e consulta em nome próprio. Rate limit por minuto: 60 por setor, 120 por IP na busca do registry, " +
        "20 por IP em tentativas sem chave; as respostas trazem X-RateLimit-Limit, X-RateLimit-Remaining e " +
        "X-RateLimit-Reset, e o 429 traz Retry-After. CORS liberado.",
    },
    servers: [{ url: base }],
    tags: [
      { name: "Vendas" },
      { name: "Compras" },
      { name: "RH" },
      { name: "Registry", description: "Publish-find-bind dos serviços da turma" },
    ],
    paths: {
      "/api/v1/vendas": envio("Envia vendas (contas a receber)", "Venda", "Vendas"),
      "/api/v1/inadimplencia": consulta("Situação de inadimplência de um cliente", "RespostaInadimplencia", "Vendas", [
        parametro("origem", false, origem, "Sem ela, o setor da chave"),
        parametro("documento", true, documento),
      ]),
      "/api/v1/compras": envio("Envia compras (contas a pagar)", "Compra", "Compras"),
      "/api/v1/pendencias": consulta("Contas em aberto com fornecedores", "RespostaPendencias", "Compras", [
        parametro("origem", false, origem, "Sem ela, o setor da chave"),
        parametro("documento", false, documento, "Sem ele, todos os fornecedores"),
      ]),
      "/api/v1/folhas": envio("Envia a folha de pagamento", "Folha", "RH"),
      "/api/v1/pagamentos-folha": consulta("Quem das folhas enviadas já foi pago", "RespostaPagamentosFolha", "RH", [
        parametro("origem", false, origem, "A mesma da folha enviada; sem ela, o setor da chave"),
        parametro("referencia", false, referencia, "Referência da folha; sem ela, todas"),
        parametro("cpf", false, cpf),
      ]),
      "/api/v1/avisos-pagamento": {
        get: {
          tags: ["Compras", "RH"],
          summary: "Avisos de pagamento gerados para o setor da chave",
          security: CHAVE,
          parameters: [
            parametro("origem", false, origem, "Sem ela, o setor da chave"),
            parametro("desde", false, texto("Exclusivo; use o geradoEm do último aviso lido", { format: "date-time" })),
          ],
          responses: {
            "200": json(obj({ origem, avisos: { type: "array", items: ref("AvisoPagamento") } }), "Avisos, do mais antigo ao mais novo"),
            "400": erro("desde inválido"),
            ...RESPOSTAS_ACESSO,
            "503": erro("Falha do lado do Financeiro"),
          },
        },
      },
      "/api/registro": {
        get: {
          tags: ["Registry"],
          summary: "Find: busca serviços de todos os setores",
          parameters: [
            parametro("setor", false, origem),
            parametro("nome", false, texto("Parte do nome, sem diferenciar maiúsculas")),
            parametro("protocolo", false, texto(undefined, { enum: ["SOCKET", "REST", "SOAP"] })),
            parametro("consumidor", false, texto()),
            parametro("situacao", false, texto("Sem ele, os DESATIVADOS ficam de fora", { enum: ["ATIVO", "DEPRECIADO", "DESATIVADO"] })),
          ],
          responses: {
            "200": json(obj({ total: { type: "integer" }, servicos: { type: "array", items: ref("Servico") } }), "Serviços encontrados"),
            "429": erro("Limite de requisições por minuto do IP atingido"),
          },
        },
        post: {
          tags: ["Registry"],
          summary: "Publish: publica ou atualiza um serviço do setor da chave",
          security: [{ chaveSetor: [] }],
          requestBody: { required: true, content: { "application/json": { schema: ref("PublicacaoServico") } } },
          responses: {
            "200": json(obj({ ok: { type: "boolean" }, servico: ref("Servico") }), "Atualizado"),
            "201": json(obj({ ok: { type: "boolean" }, servico: ref("Servico") }), "Publicado"),
            "401": erro("Sem chave ou chave inválida"),
            "422": json(obj({ ok: { type: "boolean" }, erros: { type: "array", items: texto() } }), "Campos inválidos"),
            "429": erro("Limite de requisições por minuto atingido"),
          },
        },
        delete: {
          tags: ["Registry"],
          summary: "Remove um serviço do setor da chave",
          security: [{ chaveSetor: [] }],
          parameters: [
            parametro("nome", true, texto()),
            parametro("versao", true, texto()),
            parametro("protocolo", true, texto(undefined, { enum: ["SOCKET", "REST", "SOAP"] })),
          ],
          responses: {
            "200": json(obj({ ok: { type: "boolean" } }), "Removido"),
            "401": erro("Sem chave ou chave inválida"),
            "404": erro("O setor não publicou esse serviço"),
            "429": erro("Limite de requisições por minuto atingido"),
          },
        },
      },
    },
    components: {
      schemas: SCHEMAS,
      securitySchemes: {
        chaveSetor: { type: "http", scheme: "bearer", description: "Chave do setor, gerada pelo Financeiro em /admin/registro" },
      },
    },
  };
}
