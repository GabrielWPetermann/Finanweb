export default function DocumentacaoPage() {
  return (
    <div>
      <h1>Documentação</h1>
      <p className="subtitulo">
        Como montar os arquivos CSV de Entrada e Saída aceitos pelo sistema. Se preferir começar de um arquivo
        pronto, tem modelo pra baixar na tela de{" "}
        <a href="/integrar">Integrar</a>.
      </p>

      <h2>Isso não é um CSV &quot;com cabeçalho&quot; comum</h2>
      <p>
        Se você já mexeu com CSV ou planilha, o normal é esperar que a primeira linha traga os nomes das
        colunas (tipo <code>cliente,valor</code>) e cada linha seguinte seja um dado correspondente a esses
        nomes, na mesma posição. <strong>Este arquivo não funciona assim.</strong> Nenhuma linha é um título de
        coluna, todas as linhas, incluindo a primeira, já são dados de verdade.
      </p>

      <div className="grid-2">
        <section>
          <h3>CSV comum (não é o nosso caso)</h3>
          <pre>{`cliente,valor
Ana,1000
Bruno,2000`}</pre>
          <p className="subtitulo">A 1ª linha é o nome das colunas. As de baixo são os dados, na mesma ordem.</p>
        </section>

        <section>
          <h3>Formato deste sistema</h3>
          <pre>{`0,Empresa LTDA,12345678000199,...
1,Ana,Vendas,1000.00,...
1,Bruno,Vendas,2000.00,...
9,2,3000.00`}</pre>
          <p className="subtitulo">
            Não tem linha de título. Toda linha é dado,  o primeiro valor de cada uma diz o tipo dela (0, 1 ou
            9), não a posição no arquivo.
          </p>
        </section>
      </div>

      <h2>A lógica das linhas</h2>
      <p>
        O arquivo não tem cabeçalho de coluna nomeada, cada linha começa com um número, o{" "}
        <code>tipo_registro</code>, que diz o que aquela linha representa. A posição da linha no arquivo não
        importa, só o valor desse primeiro campo:
      </p>
      <table>
        <thead>
          <tr>
            <th>tipo_registro</th>
            <th>O que é</th>
            <th>Quantas vezes aparece</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>0</td>
            <td>Cabeçalho dados da empresa e do arquivo</td>
            <td>Uma vez, no início</td>
          </tr>
          <tr>
            <td>1</td>
            <td>Detalhe - uma linha por cliente (Entrada) ou por fornecedor (Saída)</td>
            <td>Uma por registro</td>
          </tr>
          <tr>
            <td>9</td>
            <td>Totalizador - quantidade de registros e a soma do valor total</td>
            <td>Uma vez, no final</td>
          </tr>
        </tbody>
      </table>
      <p className="subtitulo">
        Exemplo: <code>9,1,1000.00</code> quer dizer &quot;1 registro no total, somando R$ 1000,00&quot;. O
        parser ignora qualquer linha cujo <code>tipo_registro</code> não seja 0, 1 ou 9.
      </p>

      <h2>Formato de Entrada</h2>
      <p className="subtitulo">Vendas/recebimentos, agrupados por cliente.</p>
      <table>
        <thead>
          <tr>
            <th>Linha</th>
            <th>Colunas, na ordem</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>0</td>
            <td>
              tipo_registro, nome_empresa, cnpj, (4 campos vazios), tipo_documento, data_arquivo, usuario
            </td>
          </tr>
          <tr>
            <td>1</td>
            <td>
              tipo_registro, cliente, categoria, subtotal, desconto_percentual, desconto_valor, frete,
              valor_total, forma_pagamento, data_pedido, status
            </td>
          </tr>
          <tr>
            <td>9</td>
            <td>tipo_registro, qtd_registros, valor_total_geral</td>
          </tr>
        </tbody>
      </table>

      <h2>Formato de Saída</h2>
      <p className="subtitulo">Despesas/pagamentos, agrupados por fornecedor.</p>
      <table>
        <thead>
          <tr>
            <th>Linha</th>
            <th>Colunas, na ordem</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>0</td>
            <td>tipo_registro, nome_empresa, cnpj, (2 campos vazios), tipo_documento, data_arquivo, usuario</td>
          </tr>
          <tr>
            <td>1</td>
            <td>tipo_registro, fornecedor, categoria, valor, forma_pagamento, data_pagamento, status</td>
          </tr>
          <tr>
            <td>9</td>
            <td>tipo_registro, qtd_registros, valor_total_geral</td>
          </tr>
        </tbody>
      </table>

      <h2>Particularidades</h2>
      <ul>
        <li>
          <strong>Datas</strong> vão no formato <code>AAAAMMDD</code>, sem separador (ex: 13/08/2026 vira{" "}
          <code>20260813</code>).
        </li>
        <li>
          <strong>Categoria</strong> é livre, se o nome citado no arquivo ainda não existe no sistema (para
          aquele tipo, Entrada ou Saída), ela é criada automaticamente na hora da importação. Pra renomear uma
          categoria depois, solicite a um administrador.
        </li>
        <li>
          <strong>Status</strong>: o último campo da linha tipo 1 é o status do registro, use o que fizer
          sentido pro seu processo (<code>CONFIRMADO</code>, <code>PENDENTE</code>, etc.). O único valor que o
          sistema trata de forma especial é <code>CANCELADO</code>: registros com esse status são ignorados na
          importação (não entram no saldo). Qualquer outro texto é só guardado, sem efeito no cálculo.
        </li>
        <li>
          <strong>Sem vírgula nos nomes</strong>: o parser separa os campos por vírgula simples, então nomes de
          cliente, fornecedor ou categoria não podem conter vírgula.
        </li>
        <li>
          <strong>Regra D+2</strong>: o sistema não recalcula essa regra, ele confia que a data que vem no
          arquivo (<code>data_pedido</code>/<code>data_pagamento</code>) já é a data correta, calculada por
          quem gerou o CSV.
        </li>
        <li>
          <strong>Importações são cumulativas</strong>: cada arquivo novo soma ao histórico, não substitui o
          que já foi importado antes.
        </li>
        <li>
          <strong>Como apagar registros</strong>: o sistema não possui uma funcionalidade para apagar registros 
          existentes. Solicite para um administrador para que ele faça isso manualmente no banco de dados, caso 
          seja necessário.
        </li>
      </ul>
    </div>
  );
}
