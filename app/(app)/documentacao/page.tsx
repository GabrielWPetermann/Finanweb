import { SOCKET_HOST, SOCKET_NOME, SOCKET_PORTA } from "@/lib/socket/config";

interface Campo {
  posicao?: string;
  campo: string;
  formato: string;
  obrigatorio: string;
  observacao: string;
}

function TabelaCampos({ campos }: { campos: Campo[] }) {
  return (
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Campo</th>
          <th>Formato</th>
          <th>Obrigatório</th>
          <th>Observação</th>
        </tr>
      </thead>
      <tbody>
        {campos.map((c, indice) => (
          <tr key={c.campo}>
            <td>{c.posicao ?? indice + 1}</td>
            <td>{c.campo}</td>
            <td>{c.formato}</td>
            <td>{c.obrigatorio}</td>
            <td>{c.observacao}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const SO_INFORMATIVO = "informativo, não é gravado";

function cabecalhoCsv(reservados: { posicao: string; quantidade: number }, deslocamento: number): Campo[] {
  const p = (n: number) => String(n + deslocamento);
  return [
    { campo: "tipo_registro", formato: 'fixo "0"', obrigatorio: "sim", observacao: "identifica o cabeçalho" },
    { campo: "nome_empresa", formato: "texto", obrigatorio: "sim", observacao: SO_INFORMATIVO },
    { campo: "cnpj", formato: "texto", obrigatorio: "sim", observacao: SO_INFORMATIVO },
    {
      posicao: reservados.posicao,
      campo: "(reservados)",
      formato: "vazio",
      obrigatorio: "sim",
      observacao: `${reservados.quantidade} campos vazios; mantenha as vírgulas`,
    },
    { posicao: p(4), campo: "tipo_documento", formato: "texto", obrigatorio: "sim", observacao: SO_INFORMATIVO },
    { posicao: p(5), campo: "data_arquivo", formato: "AAAAMMDD", obrigatorio: "sim", observacao: "data do arquivo no Histórico" },
    { posicao: p(6), campo: "usuario", formato: "texto", obrigatorio: "sim", observacao: SO_INFORMATIVO },
  ];
}

const TOTALIZADOR_CSV: Campo[] = [
  { campo: "tipo_registro", formato: 'fixo "9"', obrigatorio: "sim", observacao: "identifica o totalizador" },
  { campo: "qtd_registros", formato: "inteiro", obrigatorio: "sim", observacao: "não é conferido com a contagem real" },
  { campo: "valor_total_geral", formato: "decimal", obrigatorio: "sim", observacao: "não é conferido com a soma real" },
];

const DETALHE_ENTRADA: Campo[] = [
  { campo: "tipo_registro", formato: 'fixo "1"', obrigatorio: "sim", observacao: "identifica o detalhe" },
  { campo: "cliente", formato: "texto, sem vírgula", obrigatorio: "sim", observacao: "nome do cliente" },
  { campo: "documento", formato: "CNPJ/CPF", obrigatorio: "sim", observacao: "identifica o cadastro do cliente" },
  { campo: "categoria", formato: "texto, sem vírgula", obrigatorio: "sim", observacao: "criada se não existir" },
  { campo: "subtotal", formato: "decimal (1000.00)", obrigatorio: "sim", observacao: "antes de desconto e frete" },
  { campo: "desconto_percentual", formato: "decimal", obrigatorio: "sim (pode ser 0)", observacao: "" },
  { campo: "desconto_valor", formato: "decimal", obrigatorio: "sim (pode ser 0)", observacao: "em reais" },
  { campo: "frete", formato: "decimal", obrigatorio: "sim (pode ser 0)", observacao: "" },
  { campo: "valor_total", formato: "decimal", obrigatorio: "sim", observacao: "valor que entra no saldo" },
  { campo: "forma_pagamento", formato: "texto", obrigatorio: "sim", observacao: "livre (Pix, Boleto, Cartão...)" },
  { campo: "data_pedido", formato: "AAAAMMDD", obrigatorio: "sim", observacao: "" },
  { campo: "status", formato: "texto", obrigatorio: "sim", observacao: "CANCELADO ignora a linha" },
];

const DETALHE_SAIDA: Campo[] = [
  { campo: "tipo_registro", formato: 'fixo "1"', obrigatorio: "sim", observacao: "identifica o detalhe" },
  { campo: "fornecedor", formato: "texto, sem vírgula", obrigatorio: "sim", observacao: "nome do fornecedor" },
  { campo: "documento", formato: "CNPJ/CPF", obrigatorio: "sim", observacao: "identifica o cadastro do fornecedor" },
  { campo: "categoria", formato: "texto, sem vírgula", obrigatorio: "sim", observacao: "criada se não existir" },
  { campo: "valor", formato: "decimal (1000.00)", obrigatorio: "sim", observacao: "valor que entra no saldo" },
  { campo: "forma_pagamento", formato: "texto", obrigatorio: "sim", observacao: "livre (Pix, Boleto, Cartão...)" },
  { campo: "data_pagamento", formato: "AAAAMMDD", obrigatorio: "sim", observacao: "" },
  { campo: "status", formato: "texto", obrigatorio: "sim", observacao: "CANCELADO ignora a linha" },
];

const CADASTRO: Campo[] = [
  { campo: "nome", formato: "texto, sem vírgula", obrigatorio: "sim", observacao: "" },
  { campo: "documento", formato: "CNPJ/CPF", obrigatorio: "não", observacao: "se já existir, atualiza o cadastro" },
  { campo: "email", formato: "texto", obrigatorio: "não", observacao: "" },
  { campo: "telefone", formato: "texto", obrigatorio: "não", observacao: "" },
];

const XML_ENTRADA = `<?xml version="1.0" encoding="UTF-8"?>
<movimento xmlns="urn:finanweb:entrada:1.0"
           versao="1.0" tipo="ENTRADA">
  <cabecalho>
    <empresa>Nome da Empresa LTDA</empresa>
    <cnpj>00000000000000</cnpj>
    <tipoDocumento>ENTRADA</tipoDocumento>
    <dataArquivo>2026-01-01</dataArquivo>
    <usuario>usuario</usuario>
  </cabecalho>
  <pedidos>
    <pedido status="CONFIRMADO">
      <cliente documento="00011122233">Nome do Cliente</cliente>
      <categoria>Categoria Exemplo</categoria>
      <subtotal>1000.00</subtotal>
      <desconto percentual="0.00">0.00</desconto>
      <frete>0.00</frete>
      <valorTotal>1000.00</valorTotal>
      <formaPagamento>Boleto</formaPagamento>
      <dataPedido>2026-01-01</dataPedido>
    </pedido>
  </pedidos>
  <totalizador>
    <qtdRegistros>1</qtdRegistros>
    <valorTotalGeral>1000.00</valorTotalGeral>
  </totalizador>
</movimento>`;

const XML_SAIDA = `<?xml version="1.0" encoding="UTF-8"?>
<movimento xmlns="urn:finanweb:saida:1.0"
           versao="1.0" tipo="SAIDA">
  <cabecalho>
    <empresa>Nome da Empresa LTDA</empresa>
    <cnpj>00000000000000</cnpj>
    <tipoDocumento>SAIDA</tipoDocumento>
    <dataArquivo>2026-01-01</dataArquivo>
    <usuario>usuario</usuario>
  </cabecalho>
  <despesas>
    <despesa status="CONFIRMADO">
      <fornecedor documento="00099988877000">Nome do Fornecedor</fornecedor>
      <categoria>Categoria Exemplo</categoria>
      <valor>500.00</valor>
      <formaPagamento>Boleto</formaPagamento>
      <dataPagamento>2026-01-01</dataPagamento>
    </despesa>
  </despesas>
  <totalizador>
    <qtdRegistros>1</qtdRegistros>
    <valorTotalGeral>500.00</valorTotalGeral>
  </totalizador>
</movimento>`;

export default function DocumentacaoPage() {
  return (
    <div>
      <h1>Documentação</h1>
      <p className="subtitulo">
        <a href="#entrada-de-dados">Entrada de dados</a> · <a href="#csv">CSV</a> · <a href="#xml">XML</a> ·{" "}
        <a href="#cadastro">Clientes e Fornecedores</a> · <a href="#socket">Socket</a> · <a href="#chat">Chat</a>{" "}
        · <a href="#particularidades">Particularidades</a>
      </p>

      <h2 id="entrada-de-dados">Entrada de dados</h2>
      <ul>
        <li>
          <strong>Manual</strong>: em <a href="/recebimentos">Recebimentos</a> e <a href="/pagamentos">Pagamentos</a>.
        </li>
        <li>
          <strong>Arquivo</strong>: em <a href="/integrar">Integrar</a>. Entrada e Saída em CSV ou XML; Clientes e
          Fornecedores em CSV.
        </li>
        <li>
          <strong>Socket</strong>: XML de Entrada ou Saída recebido de outro sistema pelo servidor da turma,
          importado após aprovação em <a href="/socket">Socket</a>.
        </li>
      </ul>
      <p>
        Cada importação soma ao que já existe; nada é substituído. Registros importados podem ser editados
        depois, e o arquivo original continua disponível no <a href="/historico">Histórico</a>.
      </p>

      <h2 id="csv">CSV de Entrada e Saída</h2>
      <p>
        O arquivo não tem linha de títulos: todas as linhas são dados. O primeiro campo de cada linha, o{" "}
        <code>tipo_registro</code>, indica o que ela representa.
      </p>
      <table>
        <thead>
          <tr>
            <th>tipo_registro</th>
            <th>Linha</th>
            <th>Ocorrências</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>0</td>
            <td>Cabeçalho: dados da empresa e do arquivo</td>
            <td>uma, no início</td>
          </tr>
          <tr>
            <td>1</td>
            <td>Detalhe: um cliente (Entrada) ou fornecedor (Saída)</td>
            <td>uma por registro</td>
          </tr>
          <tr>
            <td>9</td>
            <td>Totalizador: quantidade de registros e soma do valor</td>
            <td>uma, no final</td>
          </tr>
        </tbody>
      </table>
      <pre>{`0,Empresa LTDA,12345678000199,,,,,TOTAL POR CLIENTE,20260813,usuario
1,Ana Santos,11122233344,Vendas,1000.00,0.00,0.00,0.00,1000.00,Boleto,20260811,CONFIRMADO
9,1,1000.00`}</pre>
      <p className="subtitulo">
        Linhas com outro <code>tipo_registro</code> são ignoradas. Uma linha com quantidade errada de campos
        rejeita o arquivo inteiro.
      </p>

      <h3>Entrada: vendas e recebimentos, por cliente</h3>
      <h4>Linha 0 (10 campos)</h4>
      <TabelaCampos campos={cabecalhoCsv({ posicao: "4 a 7", quantidade: 4 }, 4)} />
      <h4>Linha 1 (12 campos)</h4>
      <TabelaCampos campos={DETALHE_ENTRADA} />
      <h4>Linha 9 (3 campos)</h4>
      <TabelaCampos campos={TOTALIZADOR_CSV} />

      <h3>Saída: despesas e pagamentos, por fornecedor</h3>
      <h4>Linha 0 (8 campos)</h4>
      <TabelaCampos campos={cabecalhoCsv({ posicao: "4 e 5", quantidade: 2 }, 2)} />
      <h4>Linha 1 (8 campos)</h4>
      <TabelaCampos campos={DETALHE_SAIDA} />
      <h4>Linha 9 (3 campos)</h4>
      <TabelaCampos campos={TOTALIZADOR_CSV} />

      <h2 id="xml">XML de Entrada e Saída</h2>
      <p>
        Mesmo conteúdo do CSV, validado por um schema (XSD). Um arquivo fora do schema é recusado, com a regra
        violada e a linha. Schemas: <a href="/integrar/schema?tipo=ENTRADA">Entrada</a> e{" "}
        <a href="/integrar/schema?tipo=SAIDA">Saída</a>.
      </p>

      <div className="grid-2">
        <section>
          <h3>Entrada</h3>
          <pre>{XML_ENTRADA}</pre>
        </section>
        <section>
          <h3>Saída</h3>
          <pre>{XML_SAIDA}</pre>
          <p className="subtitulo">Saída tem um único campo de valor, sem subtotal, desconto ou frete.</p>
        </section>
      </div>

      <h3>Regras do schema</h3>
      <table>
        <thead>
          <tr>
            <th>Regra</th>
            <th>Aceito</th>
            <th>Exemplo recusado</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Documento</td>
            <td>Só dígitos, 11 (CPF) ou 14 (CNPJ). Obrigatório.</td>
            <td>
              <code>0001112223</code>
            </td>
          </tr>
          <tr>
            <td>Status</td>
            <td>
              <code>CONFIRMADO</code>, <code>PENDENTE</code> ou <code>CANCELADO</code>
            </td>
            <td>
              <code>PAGO</code>
            </td>
          </tr>
          <tr>
            <td>Valores</td>
            <td>Até 14 dígitos, 2 casas decimais com ponto, não negativo</td>
            <td>
              <code>-10.00</code>, <code>1000,00</code>
            </td>
          </tr>
          <tr>
            <td>Datas</td>
            <td>
              <code>AAAA-MM-DD</code>
            </td>
            <td>
              <code>20260101</code>
            </td>
          </tr>
          <tr>
            <td>Percentual de desconto</td>
            <td>De 0 a 100, até 2 casas</td>
            <td>
              <code>150.00</code>
            </td>
          </tr>
          <tr>
            <td>Estrutura</td>
            <td>
              <code>cabecalho</code>, <code>pedidos</code>/<code>despesas</code> e <code>totalizador</code>, nessa
              ordem, com pelo menos um registro. Textos sem espaço nas pontas.
            </td>
            <td>Arquivo sem registros</td>
          </tr>
        </tbody>
      </table>
      <ul>
        <li>
          Nomes podem conter vírgula. <code>&amp;</code>, <code>&lt;</code> e <code>&gt;</code> devem ser escapados.
        </li>
        <li>Limite de 10 MB por arquivo.</li>
        <li>
          Contas entre campos (<code>valorTotal = subtotal − desconto + frete</code>) e a quantidade do totalizador
          não são conferidas.
        </li>
        <li>
          Em <a href="/relatorios">Relatórios</a>, Entradas e Saídas podem ser exportadas neste mesmo formato e
          reimportadas sem conversão. Registros sem documento ou com status fora da lista impedem a exportação.
        </li>
      </ul>

      <h2 id="cadastro">Clientes e Fornecedores</h2>
      <p>
        CSV comum, com a linha de títulos <code>nome,documento,email,telefone</code>. O tipo (Clientes ou
        Fornecedores) é escolhido em <a href="/integrar">Integrar</a>.
      </p>
      <pre>{`nome,documento,email,telefone
Cliente Exemplo LTDA,00011122233,contato@exemplo.com,11999998888`}</pre>
      <TabelaCampos campos={CADASTRO} />
      <p className="subtitulo">
        Com documento já cadastrado, a linha atualiza nome, e-mail e telefone (campo vazio não apaga o valor
        salvo); sem documento ou com documento novo, cria um cadastro. Não afeta saldo nem Histórico.
      </p>
      <p>
        Nas importações de Entrada e Saída (CSV, XML ou socket), o cliente ou fornecedor é localizado pelo
        documento; se não existir, é criado só com o nome. Nas telas de lançamento manual, escolha um cadastro
        existente ou use &quot;+ Criar novo...&quot;. Todos ficam editáveis em{" "}
        <a href="/admin/cadastros">Cadastros</a>.
      </p>

      <h2 id="socket">Socket</h2>
      <p>
        O Finanweb troca XML de Entrada e Saída com outros sistemas pelo servidor da turma,{" "}
        <code>
          {SOCKET_HOST}:{SOCKET_PORTA}
        </code>
        , onde aparece como <code>{SOCKET_NOME}</code>.
      </p>

      <h3>Enviar</h3>
      <p>
        Em <a href="/socket">Socket</a>, escolha o movimento de um período ou um arquivo XML e o destino (nome ou
        id de um conectado; vazio envia para todos). O envio é recusado se o destino não estiver conectado.
      </p>

      <h3>Receber</h3>
      <ol>
        <li>
          O outro sistema envia o XML para <code>#{SOCKET_NOME}</code>.
        </li>
        <li>
          O arquivo é validado no schema na chegada, e quem enviou recebe a resposta no chat: aceito, ou o motivo
          da recusa.
        </li>
        <li>
          Os aceitos aparecem em <a href="/socket">Socket</a>, em Recebidos, para importar ou descartar. A
          importação entra no Histórico em nome de quem a aprovou.
        </li>
      </ol>
      <p>
        O recebimento depende do serviço <code>npm run socket</code> estar em execução: o servidor não guarda
        mensagens para quem está desconectado. Quando ele está parado, as telas de Socket e Chat mostram
        &quot;Desconectado do servidor&quot;.
      </p>

      <h3>Protocolo de envio de arquivo</h3>
      <p>
        Texto UTF-8, um comando por linha. O arquivo vai em pedaços: cada um é uma linha de cabeçalho seguida
        exatamente pela quantidade de bytes indicada. Um pedaço de tamanho 0 marca o fim.
      </p>
      <pre>{`#${SOCKET_NOME} /arquivo 4096 entradas.xml\\n   + 4096 bytes
#${SOCKET_NOME} /arquivo 1808 entradas.xml\\n   + 1808 bytes
#${SOCKET_NOME} /arquivo 0 entradas.xml\\n      (fim)`}</pre>
      <p className="subtitulo">Resposta, em privado:</p>
      <pre>{`(privado) ${SOCKET_NOME}#5: "entradas.xml" recebido (ENTRADA), aguardando aprovação no Finanweb.`}</pre>

      <h2 id="chat">Chat</h2>
      <p>
        Em <a href="/chat">Chat</a> ficam as mensagens trocadas no servidor da turma: públicas, privadas para o
        Finanweb e avisos de entrada e saída. Destino vazio envia para todos; com nome ou id, em privado.
      </p>
      <p>
        Todos os usuários do Finanweb escrevem pela mesma conexão, então as mensagens chegam aos outros sistemas
        com o usuário na frente: <code>{SOCKET_NOME}#5: [ana] bom dia</code>. Enquanto o serviço estiver
        desconectado, a mensagem fica marcada como pendente e é enviada quando a conexão voltar.
      </p>

      <h2 id="particularidades">Particularidades</h2>
      <ul>
        <li>
          <strong>Datas</strong>: <code>AAAAMMDD</code> no CSV (<code>20260813</code>) e <code>AAAA-MM-DD</code> no
          XML (<code>2026-08-13</code>).
        </li>
        <li>
          <strong>Decimais</strong>: com ponto nos arquivos (<code>1000.00</code>). Nas telas, ponto ou vírgula.
        </li>
        <li>
          <strong>Categorias</strong>: criadas automaticamente na importação; renomeadas em{" "}
          <a href="/admin/categorias">Categorias</a>.
        </li>
        <li>
          <strong>Status</strong>: no CSV é livre, e só <code>CANCELADO</code> tem efeito (a linha é ignorada). No
          XML, apenas <code>CONFIRMADO</code>, <code>PENDENTE</code> e <code>CANCELADO</code>.
        </li>
        <li>
          <strong>Vírgula em nomes</strong>: não é aceita no CSV.
        </li>
        <li>
          <strong>Regra D+2</strong>: não é recalculada; vale a data que vem no arquivo.
        </li>
        <li>
          <strong>Exclusão</strong>: restrita a administradores.
        </li>
      </ul>
    </div>
  );
}
