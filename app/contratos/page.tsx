// Pagina publica (fora do login, ver o matcher do middleware) com os
// contratos XML do Financeiro. E o endereco que os outros setores da turma
// recebem: eles nao tem conta no Finanweb, e daqui baixam o XSD e o exemplo
// de cada mensagem pela rota /api/contratos. O texto e escrito para eles.

import type { Metadata } from "next";
import { SOCKET_HOST, SOCKET_NOME, SOCKET_PORTA } from "@/lib/socket/config";
import { CONTRATOS } from "@/lib/xml/contratos";

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

function rotuloExemplo(arquivo: string): string {
  if (arquivo.endsWith("-consulta.xml")) return "exemplo de consulta";
  if (arquivo.endsWith("-resposta.xml")) return "exemplo de resposta";
  return "exemplo";
}

export default function ContratosPage() {
  return (
    <main className="content">
      <h1>Contratos de integração</h1>
      <p className="subtitulo">
        Formatos XML que o Financeiro (Finanweb) troca com os outros setores da turma, definidos a partir do
        diagrama de interoperabilidade. Cada mensagem tem um schema (XSD) e um XML de exemplo. Esta página não
        precisa de login. <a href="/login">Entrar no Finanweb</a>
      </p>

      <h2>O que cada setor troca com o Financeiro</h2>
      <div className="cards">
        {SETORES.map((setor) => (
          <section className="card" key={setor}>
            <h3>{setor}</h3>
            {CONTRATOS.filter((c) => c.setor === setor).map((c) => (
              <div key={c.namespace}>
                <p>
                  <strong>{c.mensagem}</strong> ({c.sentido === "recebe" ? "envio" : "consulta"}). {c.descricao}
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

      <h2>Como enviar</h2>
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
          <code>resposta-pagamentos-folha-&lt;id&gt;.xml</code>.
          Consulta inválida volta em texto no chat, com o motivo.
        </li>
        <li>
          O servidor não guarda mensagens para quem está desconectado: se a resposta de uma consulta não chegar,
          tente de novo depois.
        </li>
      </ol>

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
          <strong>Origem</strong>: nos envios, o nome do setor no servidor da turma, em minúsculas (
          <code>vendas</code>, <code>compras</code>, <code>rh</code>).
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
          <code>id</code>. Se o Financeiro não conseguir responder, a resposta traz <code>&lt;erro&gt;</code> no
          lugar do resultado.
        </li>
        <li>
          <strong>Inadimplente</strong>: cliente com conta a receber em aberto e vencimento anterior à data da
          consulta.
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
          Depois de combinado, um formato só muda com versão nova (outro número no namespace), e a versão anterior
          continua aceita.
        </li>
        <li>
          Dúvidas e sugestões: mensagem privada para <code>#{SOCKET_NOME}</code> no servidor da turma. Ela chega ao
          chat do Finanweb.
        </li>
      </ul>

      <h2>Referência rápida</h2>
      <table>
        <thead>
          <tr>
            <th>Mensagem</th>
            <th>Setor</th>
            <th>Tipo</th>
            <th>Namespace do elemento raiz</th>
          </tr>
        </thead>
        <tbody>
          {CONTRATOS.map((c) => (
            <tr key={c.namespace}>
              <td>{c.mensagem}</td>
              <td>{c.setor}</td>
              <td>{c.sentido === "recebe" ? "envio" : "consulta"}</td>
              <td>
                <code>{c.namespace}</code>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
