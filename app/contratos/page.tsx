// Pagina publica (fora do login, ver o matcher do middleware) com os
// contratos do Financeiro. E o endereco que os outros setores da turma
// recebem: eles nao tem conta no Finanweb, e daqui baixam o XSD e os exemplos
// de cada mensagem pela rota /api/contratos. O texto e escrito para eles.
//
// Cada mensagem passa por tres caminhos (socket, REST e SOAP), todos com o
// mesmo contrato: o catalogo em lib/xml/contratos.ts diz o de cada uma.

import type { Metadata } from "next";
import { headers } from "next/headers";
import { SOCKET_HOST, SOCKET_NOME, SOCKET_PORTA } from "@/lib/socket/config";
import { CONTRATOS, type Contrato } from "@/lib/xml/contratos";

export const metadata: Metadata = {
  title: "Contratos de integração · Finanweb",
};

// Onde o combinado difere do diagrama da turma.
const OBSERVACOES: Record<string, string> = {
  Vendas: "O “quem vendeu” do diagrama não é enviado: o Financeiro não usa essa informação.",
  Compras: "No diagrama aparece “valor e cliente”; do lado de Compras, quem aparece é o fornecedor.",
  RH: "No diagrama, a seta da folha aparece do Financeiro para o RH; o certo é o RH enviar a folha, e o Financeiro responder quem já foi pago.",
};

const SETORES = [...new Set(CONTRATOS.map((c) => c.setor))];

const TIPO: Record<Contrato["sentido"], string> = {
  recebe: "envio",
  responde: "consulta",
  envia: "aviso do Financeiro",
};

function rotuloExemplo(arquivo: string): string {
  const formato = arquivo.endsWith(".json") ? "JSON" : "XML";
  if (arquivo.includes("-consulta.")) return `consulta ${formato}`;
  if (arquivo.includes("-resposta.") || arquivo.startsWith("avisos-")) return `resposta ${formato}`;
  return `exemplo ${formato}`;
}

const ENVELOPE_EXEMPLO = `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <consultaInadimplencia xmlns="urn:finanweb:inadimplencia:1.0" versao="1.0" id="vendas-000981">
      <origem>vendas</origem>
      <documento>12345678909</documento>
    </consultaInadimplencia>
  </soap:Body>
</soap:Envelope>`;

export default async function ContratosPage() {
  // Endereco deste site, para os exemplos de chamada saírem prontos para usar.
  const host = (await headers()).get("host") ?? "finanwebsistema.vercel.app";
  const base = `${host.startsWith("localhost") ? "http" : "https"}://${host}`;

  return (
    <main className="content">
      <h1>Contratos de integração</h1>
      <p className="subtitulo">
        Mensagens que o Financeiro (Finanweb) troca com os outros setores da turma, definidas a partir do diagrama
        de interoperabilidade. Cada mensagem tem um schema (XSD) e exemplos, e pode ir por três caminhos: socket,
        REST (JSON) ou SOAP. O conteúdo e as regras são os mesmos nos três. Os serviços de todos os setores
        estão no <a href="/registro">Registry</a>. Esta página não precisa de login.{" "}
        <a href="/login">Entrar no Finanweb</a>
      </p>

      <h2>O que cada setor troca com o Financeiro</h2>
      <div className="cards">
        {SETORES.map((setor) => (
          <section className="card" key={setor}>
            <h3>{setor}</h3>
            {CONTRATOS.filter((c) => c.setor === setor).map((c) => (
              <div key={c.namespace}>
                <p>
                  <strong>{c.mensagem}</strong> ({TIPO[c.sentido]}). {c.descricao}
                </p>
                <p className="subtitulo">
                  REST: <code>{c.rest}</code>
                  <br />
                  SOAP: <code>{c.soap}</code>
                </p>
                <div className="linha-botoes">
                  <a href={`/api/contratos/${c.schema}`} className="botao-download">
                    {c.schema}
                  </a>
                  {c.exemplos.map((exemplo) => (
                    <a key={exemplo} href={`/api/contratos/${exemplo}`} className="botao-download">
                      {rotuloExemplo(exemplo)}
                    </a>
                  ))}
                </div>
              </div>
            ))}
            {OBSERVACOES[setor] && <p className="subtitulo">{OBSERVACOES[setor]}</p>}
          </section>
        ))}
      </div>

      <h2>Como integrar</h2>
      <p>
        Escolham o caminho que for mais fácil para o sistema de vocês. Envios (venda, compra, folha) entram numa
        caixa de entrada e só viram lançamento quando alguém do Financeiro aprova. Consultas respondem na hora.
      </p>

      <h3>Socket</h3>
      <ol>
        <li>Gere o XML seguindo o exemplo da mensagem.</li>
        <li>
          Valide contra o XSD antes de enviar. Com o xmllint, por exemplo:
          <pre>xmllint --noout --schema entrada-v2.xsd vendas.xml</pre>
        </li>
        <li>
          Envie como arquivo pelo servidor de socket da turma,{" "}
          <code>
            {SOCKET_HOST}:{SOCKET_PORTA}
          </code>
          , para <code>#{SOCKET_NOME}</code>, com extensão <code>.xml</code>. Termine com o pedaço de tamanho 0
          que marca o fim do arquivo: sem ele, o Finanweb espera 10 segundos antes de processar.
        </li>
        <li>
          A resposta volta em privado para quem enviou. Nos envios, uma mensagem no chat dizendo se o arquivo foi
          aceito ou o motivo da recusa. Nas consultas, um arquivo com o mesmo <code>id</code>:{" "}
          <code>resposta-inadimplencia-&lt;id&gt;.xml</code>, <code>resposta-pendencias-&lt;id&gt;.xml</code> ou{" "}
          <code>resposta-pagamentos-folha-&lt;id&gt;.xml</code>. Consulta inválida volta em texto no chat, com o
          motivo.
        </li>
        <li>
          O servidor não guarda mensagens para quem está desconectado: se a resposta de uma consulta ou um aviso
          não chegar, consultem de novo depois (ou pela API).
        </li>
      </ol>

      <h3>REST (JSON)</h3>
      <ul>
        <li>
          Endereço: <code>{base}/api/v1</code>. Um <code>GET</code> nele lista as rotas, e o contrato completo
          está em OpenAPI 3: <a href={`${base}/api/v1/openapi.json`}>{`${base}/api/v1/openapi.json`}</a>. Aceita
          chamada direto do navegador (CORS liberado).
        </li>
        <li>
          <strong>Chave</strong>: toda chamada leva a chave do setor no cabeçalho{" "}
          <code>Authorization: Bearer &lt;chave&gt;</code>. Peçam a chave ao Financeiro (mensagem privada para{" "}
          <code>#{SOCKET_NOME}</code>); é a mesma do <a href="/registro">Registry</a>. Cada setor envia e consulta
          só em nome próprio: a <code>origem</code> tem que ser o setor da chave (nas consultas ela pode ser
          omitida). Sem chave, <code>401</code>; origem de outro setor, <code>403</code>.
        </li>
        <li>
          <strong>Limite</strong>: 60 chamadas por minuto por setor. Acima disso, <code>429</code> com{" "}
          <code>Retry-After</code> (segundos para tentar de novo). Toda resposta traz{" "}
          <code>X-RateLimit-Remaining</code>.
        </li>
        <li>
          <strong>Envios</strong>: <code>POST</code> com o corpo em JSON (<code>Content-Type: application/json</code>
          ). Os campos têm os nomes do XSD; elemento com atributo vira objeto (
          <code>{`"cliente": { "nome": "...", "documento": "..." }`}</code>,{" "}
          <code>{`"desconto": { "valor": "75.00", "percentual": "5.00" }`}</code>), atributos de registro viram
          campos (<code>referencia</code>, <code>status</code>), e listas viram arrays (<code>pedidos</code>,{" "}
          <code>despesas</code>, <code>funcionarios</code>). Valores podem ir como número ou texto. Veja o exemplo
          JSON de cada envio acima. Resposta <code>202</code> com{" "}
          <code>{`{ "ok": true, "situacao": "AGUARDANDO_APROVACAO" }`}</code>, ou <code>422</code> com{" "}
          <code>{`{ "ok": false, "erro": "..." }`}</code> dizendo o campo fora do contrato.
        </li>
        <li>
          <strong>Consultas</strong>: <code>GET</code> com os campos da consulta na URL (<code>origem</code>,{" "}
          <code>documento</code>, <code>referencia</code>, <code>cpf</code>, e <code>id</code> se quiserem
          escolher). A resposta tem os campos do XSD em JSON, com valores como número. Consulta inválida volta{" "}
          <code>400</code>; resposta com <code>erro</code> (Financeiro sem conseguir consultar) volta{" "}
          <code>503</code>.
        </li>
        <li>
          <strong>Avisos de pagamento</strong>: pela API não há como o Financeiro chamar vocês, então vocês buscam:{" "}
          <code>GET /api/v1/avisos-pagamento?desde=...</code>. Cada aviso traz{" "}
          <code>geradoEm</code>; use o do último como <code>desde</code> na próxima vez.
        </li>
      </ul>
      <pre>{`curl -X POST ${base}/api/v1/vendas -H "Authorization: Bearer <chave>" -H "Content-Type: application/json" -d @entrada-v2.json
curl -H "Authorization: Bearer <chave>" "${base}/api/v1/inadimplencia?documento=12345678909"`}</pre>

      <h3>SOAP</h3>
      <ul>
        <li>
          WSDL: <a href={`${base}/api/soap?wsdl`}>{`${base}/api/soap?wsdl`}</a>. Endereço do serviço:{" "}
          <code>{base}/api/soap</code>, SOAP 1.1, document/literal.
        </li>
        <li>
          O <code>soap:Body</code> leva o mesmo XML que iria pelo socket (o <code>&lt;movimento&gt;</code>, a{" "}
          <code>&lt;folha&gt;</code> ou a consulta), e a operação é escolhida por ele. Nas consultas, o Body da
          resposta é a resposta do contrato. Nos envios, é um <code>&lt;confirmacaoEnvio&gt;</code> (
          <a href="/api/contratos/servico-v1.xsd">servico-v1.xsd</a>).
        </li>
        <li>
          A chave do setor vai no cabeçalho HTTP <code>Authorization: Bearer &lt;chave&gt;</code>, como no REST, com
          o mesmo limite de 60 chamadas por minuto. Sem chave, origem de outro setor e limite atingido voltam como{" "}
          <code>soap:Fault</code> com HTTP 401, 403 e 429.
        </li>
        <li>
          Envio ou consulta recusados voltam como <code>soap:Fault</code> (HTTP 500) com o motivo em{" "}
          <code>faultstring</code>. Avisos de pagamento: operação <code>ConsultarAvisosPagamento</code>, com{" "}
          <code>origem</code> e <code>desde</code>.
        </li>
      </ul>
      <pre>{ENVELOPE_EXEMPLO}</pre>

      <h2>Regras comuns</h2>
      <ul>
        <li>
          <strong>Identificação</strong>: cliente e fornecedor por CPF ou CNPJ, funcionário por CPF, sempre só
          dígitos (<code>12345678909</code>, não <code>123.456.789-09</code>).
        </li>
        <li>
          <strong>Valores e datas</strong>: valores com ponto e duas casas (<code>1450.00</code>); datas no formato{" "}
          <code>AAAA-MM-DD</code> (<code>2026-10-21</code>).
        </li>
        <li>
          <strong>Origem</strong>: nos envios e consultas, o nome do setor no servidor da turma, em minúsculas (
          <code>vendas</code>, <code>compras</code>, <code>rh</code>). Vale o mesmo nome no REST e no SOAP.
        </li>
        <li>
          <strong>Referência</strong>: o identificador do registro no sistema de vocês. O par origem + referência
          identifica o lançamento, então reenviar o mesmo arquivo não duplica nada. Para avisar que uma venda foi
          recebida, uma compra foi paga ou um dos dois foi cancelado, reenvie o registro com a mesma referência e o
          status novo (<code>CONFIRMADO</code> ou <code>CANCELADO</code>): o lançamento em aberto é atualizado.
        </li>
        <li>
          <strong>Status nos envios</strong>: <code>PENDENTE</code> = ainda não recebido ou pago,{" "}
          <code>CONFIRMADO</code> = já recebido ou pago, <code>CANCELADO</code> = ignorado pelo Financeiro.
        </li>
        <li>
          <strong>Consultas</strong>: vocês escolhem o <code>id</code> da consulta, e a resposta volta com o mesmo{" "}
          <code>id</code> (no REST ele é opcional). Se o Financeiro não conseguir responder, a resposta traz{" "}
          <code>erro</code> no lugar do resultado.
        </li>
        <li>
          <strong>Inadimplente</strong>: cliente com conta a receber em aberto e vencimento anterior à data da
          consulta.
        </li>
        <li>
          <strong>Aviso de pagamento</strong>: quando o Financeiro paga ou cancela uma compra ou um salário que
          vocês mandaram, o aviso vai como arquivo pelo socket para o nome de vocês no servidor (a{" "}
          <code>origem</code> do envio), e fica disponível para busca no REST e no SOAP, com a chave do setor. Pelo
          socket, só chega se estiverem conectados. Não precisa responder.
        </li>
        <li>
          <strong>Pagamentos da folha</strong>: a <code>origem</code> da consulta tem que ser a mesma da folha
          enviada, e a <code>referencia</code> é a da folha. Lista vazia quer dizer que a folha ainda não foi lançada
          no Financeiro.
        </li>
      </ul>

      <h2>Mudanças e dúvidas</h2>
      <ul>
        <li>
          Os formatos são definidos pelo Financeiro, que é quem recebe ou responde cada mensagem, como numa API.
        </li>
        <li>
          Depois de combinado, um formato só muda com versão nova (outro número no namespace, ou{" "}
          <code>/api/v2</code> no REST), e a versão anterior continua aceita.
        </li>
        <li>
          Dúvidas, sugestões e pedido de chave: mensagem privada para <code>#{SOCKET_NOME}</code> no servidor da
          turma. Ela chega ao chat do Finanweb.
        </li>
        <li>
          Pelo socket, cada sistema pode mandar até 30 arquivos (envios e consultas) por minuto.
        </li>
      </ul>

      <h2>Referência rápida</h2>
      <table>
        <thead>
          <tr>
            <th>Mensagem</th>
            <th>Setor</th>
            <th>Tipo</th>
            <th>Namespace (socket)</th>
            <th>REST</th>
            <th>SOAP</th>
          </tr>
        </thead>
        <tbody>
          {CONTRATOS.map((c) => (
            <tr key={`${c.setor}-${c.namespace}`}>
              <td>{c.mensagem}</td>
              <td>{c.setor}</td>
              <td>{TIPO[c.sentido]}</td>
              <td>
                <code>{c.namespace}</code>
              </td>
              <td>
                <code>{c.rest.split("?")[0]}</code>
              </td>
              <td>
                <code>{c.soap}</code>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
