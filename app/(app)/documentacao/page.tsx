export default function DocumentacaoPage() {
  return (
    <div>
      <h1>Documentação</h1>
      <p className="subtitulo">
        Como montar os arquivos CSV de Entrada e Saída aceitos pelo sistema. Se preferir começar de um arquivo
        pronto, tem modelo pra baixar na tela de <a href="/integrar">Integrar</a>. E se não quiser mexer com
        CSV nenhum, dá pra lançar tudo direto pelas telas de <a href="/recebimentos">Recebimentos</a> e{" "}
        <a href="/pagamentos">Pagamentos</a> — o CSV é um atalho pra lançar em lote, não uma obrigação.
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
            Não tem linha de título. Toda linha é dado, o primeiro valor de cada uma diz o tipo dela (0, 1 ou
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
            <td>Cabeçalho, dados da empresa e do arquivo</td>
            <td>Uma vez, no início</td>
          </tr>
          <tr>
            <td>1</td>
            <td>Detalhe, uma linha por cliente (Entrada) ou por fornecedor (Saída)</td>
            <td>Uma por registro</td>
          </tr>
          <tr>
            <td>9</td>
            <td>Totalizador, quantidade de registros e a soma do valor total</td>
            <td>Uma vez, no final</td>
          </tr>
        </tbody>
      </table>
      <p className="subtitulo">
        Exemplo: <code>9,1,1000.00</code> quer dizer &quot;1 registro no total, somando R$ 1000,00&quot;. O
        parser ignora qualquer linha cujo <code>tipo_registro</code> não seja 0, 1 ou 9, e rejeita o arquivo se
        alguma linha tiver a quantidade errada de campos.
      </p>

      <h2>Formato de Entrada</h2>
      <p className="subtitulo">Vendas/recebimentos, agrupados por cliente.</p>

      <h3>Linha 0, cabeçalho (10 campos)</h3>
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
          <tr>
            <td>1</td>
            <td>tipo_registro</td>
            <td>fixo &quot;0&quot;</td>
            <td>sim</td>
            <td>identifica a linha como cabeçalho</td>
          </tr>
          <tr>
            <td>2</td>
            <td>nome_empresa</td>
            <td>texto</td>
            <td>sim</td>
            <td>não é gravado no banco, só informativo</td>
          </tr>
          <tr>
            <td>3</td>
            <td>cnpj</td>
            <td>texto/número</td>
            <td>sim</td>
            <td>não é validado, não é gravado no banco</td>
          </tr>
          <tr>
            <td>4 a 7</td>
            <td>(reservados)</td>
            <td>vazio</td>
            <td>sim (vazios)</td>
            <td>4 campos vazios, mantenha as vírgulas</td>
          </tr>
          <tr>
            <td>8</td>
            <td>tipo_documento</td>
            <td>texto</td>
            <td>sim</td>
            <td>não é gravado no banco, só informativo</td>
          </tr>
          <tr>
            <td>9</td>
            <td>data_arquivo</td>
            <td>AAAAMMDD</td>
            <td>sim</td>
            <td>vira a &quot;data do arquivo&quot; exibida em Histórico</td>
          </tr>
          <tr>
            <td>10</td>
            <td>usuario</td>
            <td>texto</td>
            <td>sim</td>
            <td>não é gravado no banco, só informativo</td>
          </tr>
        </tbody>
      </table>

      <h3>Linha 1, detalhe por cliente (12 campos)</h3>
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
          <tr>
            <td>1</td>
            <td>tipo_registro</td>
            <td>fixo &quot;1&quot;</td>
            <td>sim</td>
            <td>identifica a linha como detalhe</td>
          </tr>
          <tr>
            <td>2</td>
            <td>cliente</td>
            <td>texto, sem vírgula</td>
            <td>sim</td>
            <td>nome do cliente</td>
          </tr>
          <tr>
            <td>3</td>
            <td>documento</td>
            <td>texto (CNPJ/CPF)</td>
            <td>sim</td>
            <td>identifica o cadastro do cliente — casa com um já existente ou cria um novo</td>
          </tr>
          <tr>
            <td>4</td>
            <td>categoria</td>
            <td>texto, sem vírgula</td>
            <td>sim</td>
            <td>criada automaticamente se ainda não existir</td>
          </tr>
          <tr>
            <td>5</td>
            <td>subtotal</td>
            <td>número decimal (ex: 1000.00)</td>
            <td>sim</td>
            <td>valor antes de desconto e frete</td>
          </tr>
          <tr>
            <td>6</td>
            <td>desconto_percentual</td>
            <td>número decimal</td>
            <td>sim (pode ser 0)</td>
            <td>percentual de desconto</td>
          </tr>
          <tr>
            <td>7</td>
            <td>desconto_valor</td>
            <td>número decimal</td>
            <td>sim (pode ser 0)</td>
            <td>desconto em reais</td>
          </tr>
          <tr>
            <td>8</td>
            <td>frete</td>
            <td>número decimal</td>
            <td>sim (pode ser 0)</td>
            <td>valor do frete</td>
          </tr>
          <tr>
            <td>9</td>
            <td>valor_total</td>
            <td>número decimal</td>
            <td>sim</td>
            <td>valor que efetivamente entra no saldo</td>
          </tr>
          <tr>
            <td>10</td>
            <td>forma_pagamento</td>
            <td>texto</td>
            <td>sim</td>
            <td>livre (Pix, Boleto, Cartão...)</td>
          </tr>
          <tr>
            <td>11</td>
            <td>data_pedido</td>
            <td>AAAAMMDD</td>
            <td>sim</td>
            <td>8 dígitos, sem separador</td>
          </tr>
          <tr>
            <td>12</td>
            <td>status</td>
            <td>texto</td>
            <td>sim</td>
            <td>
              livre, exceto <code>CANCELADO</code> (ignora a linha)
            </td>
          </tr>
        </tbody>
      </table>

      <h3>Linha 9, totalizador (3 campos)</h3>
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
          <tr>
            <td>1</td>
            <td>tipo_registro</td>
            <td>fixo &quot;9&quot;</td>
            <td>sim</td>
            <td>identifica a linha como totalizador</td>
          </tr>
          <tr>
            <td>2</td>
            <td>qtd_registros</td>
            <td>número inteiro</td>
            <td>sim</td>
            <td>não é conferido contra a contagem real de linhas</td>
          </tr>
          <tr>
            <td>3</td>
            <td>valor_total_geral</td>
            <td>número decimal</td>
            <td>sim</td>
            <td>não é conferido contra a soma real</td>
          </tr>
        </tbody>
      </table>

      <h2>Formato de Saída</h2>
      <p className="subtitulo">Despesas/pagamentos, agrupados por fornecedor.</p>

      <h3>Linha 0, cabeçalho (8 campos)</h3>
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
          <tr>
            <td>1</td>
            <td>tipo_registro</td>
            <td>fixo &quot;0&quot;</td>
            <td>sim</td>
            <td>identifica a linha como cabeçalho</td>
          </tr>
          <tr>
            <td>2</td>
            <td>nome_empresa</td>
            <td>texto</td>
            <td>sim</td>
            <td>não é gravado no banco, só informativo</td>
          </tr>
          <tr>
            <td>3</td>
            <td>cnpj</td>
            <td>texto/número</td>
            <td>sim</td>
            <td>não é validado, não é gravado no banco</td>
          </tr>
          <tr>
            <td>4 e 5</td>
            <td>(reservados)</td>
            <td>vazio</td>
            <td>sim (vazios)</td>
            <td>2 campos vazios, mantenha as vírgulas</td>
          </tr>
          <tr>
            <td>6</td>
            <td>tipo_documento</td>
            <td>texto</td>
            <td>sim</td>
            <td>não é gravado no banco, só informativo</td>
          </tr>
          <tr>
            <td>7</td>
            <td>data_arquivo</td>
            <td>AAAAMMDD</td>
            <td>sim</td>
            <td>vira a &quot;data do arquivo&quot; exibida em Histórico</td>
          </tr>
          <tr>
            <td>8</td>
            <td>usuario</td>
            <td>texto</td>
            <td>sim</td>
            <td>não é gravado no banco, só informativo</td>
          </tr>
        </tbody>
      </table>

      <h3>Linha 1, detalhe por fornecedor (8 campos)</h3>
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
          <tr>
            <td>1</td>
            <td>tipo_registro</td>
            <td>fixo &quot;1&quot;</td>
            <td>sim</td>
            <td>identifica a linha como detalhe</td>
          </tr>
          <tr>
            <td>2</td>
            <td>fornecedor</td>
            <td>texto, sem vírgula</td>
            <td>sim</td>
            <td>nome do fornecedor</td>
          </tr>
          <tr>
            <td>3</td>
            <td>documento</td>
            <td>texto (CNPJ/CPF)</td>
            <td>sim</td>
            <td>identifica o cadastro do fornecedor — casa com um já existente ou cria um novo</td>
          </tr>
          <tr>
            <td>4</td>
            <td>categoria</td>
            <td>texto, sem vírgula</td>
            <td>sim</td>
            <td>criada automaticamente se ainda não existir</td>
          </tr>
          <tr>
            <td>5</td>
            <td>valor</td>
            <td>número decimal</td>
            <td>sim</td>
            <td>valor que efetivamente entra no saldo</td>
          </tr>
          <tr>
            <td>6</td>
            <td>forma_pagamento</td>
            <td>texto</td>
            <td>sim</td>
            <td>livre (Pix, Boleto, Cartão...)</td>
          </tr>
          <tr>
            <td>7</td>
            <td>data_pagamento</td>
            <td>AAAAMMDD</td>
            <td>sim</td>
            <td>8 dígitos, sem separador</td>
          </tr>
          <tr>
            <td>8</td>
            <td>status</td>
            <td>texto</td>
            <td>sim</td>
            <td>
              livre, exceto <code>CANCELADO</code> (ignora a linha)
            </td>
          </tr>
        </tbody>
      </table>

      <h3>Linha 9, totalizador (3 campos)</h3>
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
          <tr>
            <td>1</td>
            <td>tipo_registro</td>
            <td>fixo &quot;9&quot;</td>
            <td>sim</td>
            <td>identifica a linha como totalizador</td>
          </tr>
          <tr>
            <td>2</td>
            <td>qtd_registros</td>
            <td>número inteiro</td>
            <td>sim</td>
            <td>não é conferido contra a contagem real de linhas</td>
          </tr>
          <tr>
            <td>3</td>
            <td>valor_total_geral</td>
            <td>número decimal</td>
            <td>sim</td>
            <td>não é conferido contra a soma real</td>
          </tr>
        </tbody>
      </table>

      <h2>Cadastro de cliente e fornecedor</h2>
      <p>
        Cliente e fornecedor não são texto solto: são um cadastro (nome, documento, e-mail, telefone),
        gerenciável em <a href="/admin/cadastros">Admin → Cadastros</a>. A forma de resolver esse cadastro
        muda dependendo de onde o dado entra:
      </p>
      <ul>
        <li>
          <strong>Pelo CSV</strong>: casa pelo campo <code>documento</code> — se já existe um cadastro com
          aquele documento (do tipo certo, cliente ou fornecedor), reaproveita; senão, cria um novo com o nome
          que veio no arquivo.
        </li>
        <li>
          <strong>Pelas telas de Recebimentos/Pagamentos</strong>: é preciso escolher um cadastro já existente
          num seletor. Se ainda não existe, dá pra criar rápido ali mesmo (opção &quot;+ Criar novo...&quot;),
          só com o nome — documento, e-mail e telefone ficam em branco, editáveis depois em Cadastros.
        </li>
      </ul>

      <h2>Particularidades</h2>
      <ul>
        <li>
          <strong>Datas</strong> vão no formato <code>AAAAMMDD</code>, sem separador (ex: 13/08/2026 vira{" "}
          <code>20260813</code>). Qualquer outro formato é rejeitado na importação.
        </li>
        <li>
          <strong>Números decimais</strong> usam ponto, não vírgula (ex: <code>1000.00</code>, não{" "}
          <code>1000,00</code>). Nas telas de Recebimentos e Pagamentos, tanto ponto quanto vírgula funcionam.
        </li>
        <li>
          <strong>Categoria</strong> é livre, se o nome citado ainda não existe no sistema (para aquele tipo,
          Entrada ou Saída), ela é criada automaticamente. Pra renomear uma categoria depois, é em Admin →
          Categorias.
        </li>
        <li>
          <strong>Status</strong>: use o que fizer sentido pro seu processo (<code>CONFIRMADO</code>,{" "}
          <code>PENDENTE</code>, etc.). O único valor que o sistema trata de forma especial é{" "}
          <code>CANCELADO</code>: registros com esse status são ignorados na importação (não entram no saldo).
          Qualquer outro texto é só guardado, sem efeito no cálculo.
        </li>
        <li>
          <strong>Sem vírgula nos nomes</strong>: o parser separa os campos por vírgula simples, então nomes de
          cliente, fornecedor ou categoria não podem conter vírgula.
        </li>
        <li>
          <strong>Número de campos errado</strong>: se uma linha tiver mais ou menos campos do que o esperado
          para o tipo dela (por exemplo, subir um arquivo de Saída marcado como Entrada), a importação inteira é
          rejeitada com uma mensagem apontando a linha.
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
          <strong>Editar e excluir</strong>: em Recebimentos e Pagamentos dá pra editar qualquer registro
          (venha de um CSV ou lançado na mão) direto na tabela. Excluir é restrito a administradores. O arquivo
          original de uma importação, em Histórico, não muda quando você edita os registros dela, ele continua
          sendo o comprovante do que foi enviado originalmente.
        </li>
      </ul>
    </div>
  );
}
