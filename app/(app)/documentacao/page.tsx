export default function DocumentacaoPage() {
  return (
    <div>
      <h1>Documentação</h1>
      <p className="subtitulo">
        Como montar os arquivos de Entrada e Saída aceitos pelo sistema. Entrada e Saída vêm em dois formatos:
        o <strong>CSV</strong> descrito abaixo e o <strong>XML validado por XSD</strong> (veja{" "}
        <a href="#xml">Formato XML</a>) — os dois carregam exatamente a mesma informação, escolha o que for
        mais fácil de gerar do seu lado. Se preferir começar de um arquivo pronto, tem modelo dos dois pra
        baixar na tela de <a href="/integrar">Integrar</a>. E se não quiser mexer com arquivo nenhum, dá pra
        lançar tudo direto pelas telas de <a href="/recebimentos">Recebimentos</a> e{" "}
        <a href="/pagamentos">Pagamentos</a> — o arquivo é um atalho pra lançar em lote, não uma obrigação.
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

      <h2>Importação de Clientes e Fornecedores (cadastro)</h2>
      <p className="subtitulo">
        Um formato bem mais simples — é cadastro (dado mestre), não movimentação financeira, então não usa a
        lógica de <code>tipo_registro</code> nem tem totalizador.
      </p>
      <pre>{`nome,documento,email,telefone
Cliente Exemplo LTDA,00011122233,contato@exemplo.com,11999998888`}</pre>
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
            <td>nome</td>
            <td>texto, sem vírgula</td>
            <td>sim</td>
            <td>-</td>
          </tr>
          <tr>
            <td>2</td>
            <td>documento</td>
            <td>texto (CNPJ/CPF)</td>
            <td>não</td>
            <td>se preenchido e já existir, a linha atualiza aquele cadastro em vez de criar um novo</td>
          </tr>
          <tr>
            <td>3</td>
            <td>email</td>
            <td>texto</td>
            <td>não</td>
            <td>-</td>
          </tr>
          <tr>
            <td>4</td>
            <td>telefone</td>
            <td>texto</td>
            <td>não</td>
            <td>-</td>
          </tr>
        </tbody>
      </table>
      <p className="subtitulo">
        A primeira linha é mesmo um cabeçalho de coluna nomeada, precisa ser exatamente{" "}
        <code>nome,documento,email,telefone</code> — esse formato é o único do sistema que funciona assim (os
        de Entrada e Saída não têm cabeçalho, ver seção acima). O tipo (Clientes ou Fornecedores) é escolhido
        no <a href="/integrar">Integrar</a>, não vem dentro do arquivo — o mesmo formato serve pros dois.
      </p>
      <p className="subtitulo">
        Regra de importação, linha por linha: se <code>documento</code> veio preenchido e já existe um
        cadastro com esse documento (do tipo certo), a linha <strong>atualiza</strong> nome/e-mail/telefone
        daquele cadastro — um campo vazio no arquivo não apaga o que já estava salvo. Caso contrário,{" "}
        <strong>cria</strong> um cadastro novo. Não gera registro em Histórico nem afeta saldo.
      </p>

      <h2>Cadastro de cliente e fornecedor</h2>
      <p>
        Cliente e fornecedor não são texto solto: são um cadastro (nome, documento, e-mail, telefone),
        gerenciável em <a href="/admin/cadastros">Admin → Cadastros</a>. A forma de resolver esse cadastro
        muda dependendo de onde o dado entra:
      </p>
      <ul>
        <li>
          <strong>Pelo CSV de Entrada/Saída</strong>: casa pelo campo <code>documento</code> — se já existe um
          cadastro com aquele documento (do tipo certo, cliente ou fornecedor), reaproveita; senão, cria um
          novo com o nome que veio no arquivo, sem e-mail/telefone.
        </li>
        <li>
          <strong>Pelo CSV dedicado de Clientes/Fornecedores</strong> (seção acima): cria ou atualiza o
          cadastro completo, incluindo e-mail e telefone.
        </li>
        <li>
          <strong>Pelas telas de Recebimentos/Pagamentos</strong>: é preciso escolher um cadastro já existente
          num seletor. Se ainda não existe, dá pra criar rápido ali mesmo (opção &quot;+ Criar novo...&quot;),
          só com o nome — documento, e-mail e telefone ficam em branco, editáveis depois em Cadastros.
        </li>
      </ul>

      <h2 id="xml">Formato XML</h2>
      <p>
        Entrada e Saída também podem ser enviadas em XML. É a mesma informação do CSV, com uma diferença que
        muda tudo na prática: existe um <strong>schema formal (XSD)</strong> que descreve o arquivo, e o
        sistema <strong>recusa qualquer XML que não siga esse schema</strong>, apontando a regra violada e a
        linha. Cadastro de Clientes e Fornecedores continua só em CSV — é uma lista plana, sem cabeçalho nem
        totalizador, e não tem contrato de intercâmbio que justifique um schema.
      </p>
      <p className="subtitulo">
        Baixe o schema na tela de Integrar (<a href="/integrar/schema?tipo=ENTRADA">XSD de Entrada</a> e{" "}
        <a href="/integrar/schema?tipo=SAIDA">XSD de Saída</a>) e valide o arquivo aí no seu sistema antes de
        enviar. Assim você descobre o erro na sua máquina, e não na resposta da importação.
      </p>

      <h3>Estrutura</h3>
      <p>
        No CSV, o significado de um campo vem da <em>posição</em> dele na linha: o 5º campo é o subtotal
        porque é o 5º. No XML, vem do <em>nome</em> da tag. O arquivo é aninhado, e a ordem dos elementos
        dentro de cada bloco é obrigatória.
      </p>

      <div className="grid-2">
        <section>
          <h3>Entrada</h3>
          <pre>{`<?xml version="1.0" encoding="UTF-8"?>
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
</movimento>`}</pre>
          <p className="subtitulo">
            O <code>&lt;cabecalho&gt;</code> equivale à linha 0, cada <code>&lt;pedido&gt;</code> a uma linha
            1, e o <code>&lt;totalizador&gt;</code> à linha 9.
          </p>
        </section>

        <section>
          <h3>Saída</h3>
          <pre>{`<?xml version="1.0" encoding="UTF-8"?>
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
</movimento>`}</pre>
          <p className="subtitulo">
            Saída tem um único campo de valor: não existe subtotal, desconto nem frete.
          </p>
        </section>
      </div>

      <h3>O que o schema verifica</h3>
      <table>
        <thead>
          <tr>
            <th>Regra</th>
            <th>O que é aceito</th>
            <th>Exemplo recusado</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Documento do cliente/fornecedor</td>
            <td>Só dígitos, 11 (CPF) ou 14 (CNPJ). Obrigatório.</td>
            <td>
              <code>0001112223</code> (10 dígitos)
            </td>
          </tr>
          <tr>
            <td>Status</td>
            <td>
              <code>CONFIRMADO</code>, <code>PENDENTE</code> ou <code>CANCELADO</code> — lista fechada
            </td>
            <td>
              <code>APROVADO</code>
            </td>
          </tr>
          <tr>
            <td>Valores</td>
            <td>Até 14 dígitos, exatamente 2 casas decimais com ponto, nunca negativo</td>
            <td>
              <code>-10.00</code>, <code>1000,00</code>
            </td>
          </tr>
          <tr>
            <td>Datas</td>
            <td>
              <code>AAAA-MM-DD</code>, com hífen
            </td>
            <td>
              <code>20260101</code> (o formato do CSV)
            </td>
          </tr>
          <tr>
            <td>Percentual de desconto</td>
            <td>De 0 a 100, com até 2 casas</td>
            <td>
              <code>150.00</code>
            </td>
          </tr>
          <tr>
            <td>Estrutura</td>
            <td>
              <code>cabecalho</code> → <code>pedidos</code>/<code>despesas</code> →{" "}
              <code>totalizador</code>, nessa ordem, com pelo menos um registro. Textos não podem ser vazios
              nem ter espaço nas pontas.
            </td>
            <td>Totalizador antes dos pedidos; arquivo sem nenhum registro</td>
          </tr>
        </tbody>
      </table>

      <h3>Diferenças em relação ao CSV</h3>
      <ul>
        <li>
          <strong>Datas com hífen</strong>: no XML é <code>2026-08-13</code>, no CSV é <code>20260813</code>.
          É o formato de data padrão do XML (<code>xs:date</code>), o mesmo usado por qualquer ferramenta que
          leia XML.
        </li>
        <li>
          <strong>Status é lista fechada</strong>: no CSV você pode escrever o que quiser no status, e o
          sistema só trata <code>CANCELADO</code> de forma especial. No XML só os três valores da tabela
          acima são aceitos — o schema recusa o resto.
        </li>
        <li>
          <strong>Documento tem tamanho conferido</strong>: o CSV aceita qualquer coisa no campo; o XML exige
          11 ou 14 dígitos.
        </li>
        <li>
          <strong>Vírgula nos nomes pode</strong>: a limitação do CSV (nomes não podem conter vírgula, porque
          é ela que separa os campos) não existe no XML. Caracteres especiais como <code>&amp;</code>,{" "}
          <code>&lt;</code> e <code>&gt;</code> precisam ser escapados (<code>&amp;amp;</code>,{" "}
          <code>&amp;lt;</code>, <code>&amp;gt;</code>), que é o que qualquer biblioteca de XML já faz
          sozinha.
        </li>
        <li>
          <strong>Arquivo maior</strong>: as tags repetidas em cada registro fazem o XML ocupar cerca de três
          vezes o tamanho do CSV equivalente. Em troca, ele se descreve sozinho e é validável antes do envio.
          O limite de envio para XML é de 10 MB.
        </li>
      </ul>
      <p className="subtitulo">
        Uma coisa que o schema <em>não</em> consegue verificar: contas entre campos, como{" "}
        <code>valorTotal = subtotal − desconto + frete</code>, ou se o <code>qtdRegistros</code> bate com a
        quantidade de pedidos no arquivo. Isso é limitação do XSD 1.0 e vale igual para o CSV — o sistema
        confia no valor que vem no arquivo, como já fazia antes.
      </p>

      <h3>Exportar em XML</h3>
      <p>
        O caminho inverso também funciona: em <a href="/relatorios">Relatórios</a>, escolhendo o formato XML,
        o sistema gera um arquivo no mesmo formato descrito aqui, com o movimento completo. Dá para exportar
        e reimportar sem conversão nenhuma no meio. Balanço só sai em CSV, por ser um agregado de três linhas.
      </p>

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
          <strong>Status</strong>: no CSV, use o que fizer sentido pro seu processo (<code>CONFIRMADO</code>,{" "}
          <code>PENDENTE</code>, etc.). O único valor que o sistema trata de forma especial é{" "}
          <code>CANCELADO</code>: registros com esse status são ignorados na importação (não entram no saldo).
          Qualquer outro texto é só guardado, sem efeito no cálculo. <strong>No XML é diferente</strong>: o
          schema aceita só <code>CONFIRMADO</code>, <code>PENDENTE</code> e <code>CANCELADO</code>.
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
