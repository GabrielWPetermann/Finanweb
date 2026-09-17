# Finanweb

Sistema web que simula o setor financeiro de uma empresa: recebe arquivos CSV
de Entrada (vendas/recebimentos), Saída (despesas/pagamentos) e cadastro de
Clientes/Fornecedores através de uma tela de upload, e gera dashboard de
saldo, listagens filtráveis, histórico de importações e relatórios
exportáveis.

Projeto feito para a disciplina de **Interoperabilidade**. O foco é o parsing
manual do arquivo, por isso não uso nenhuma lib de CSV. Segurança não é o
objetivo do exercício.

## Stack

- **Next.js** (App Router, TypeScript)
- **Neon Postgres** (via Vercel Marketplace) + **Prisma** ORM
- **Vercel Blob** para guardar o arquivo CSV original de cada importação
- CSS puro (`app/globals.css`), sem framework de UI
- Parser de CSV **escrito à mão** (`lib/parsers/`), sem libs como `csv-parse`
  ou `papaparse`

## Autenticação

A autenticação é simples de propósito: existe uma tabela `Usuario` com
`username` + `senha`, comparados em texto puro (`===`), sem hash, sem JWT e
sem expiração de sessão. Não é pensado para produção real, é o suficiente
para o escopo da disciplina.

Usuários criados pelo seed (`npm run db:seed`):

| username | senha    | papel |
|----------|----------|-------|
| admin    | admin123 | ADMIN |
| user     | user123  | USER  |

## Formatos de arquivo

Abaixo está a estrutura exata que o sistema espera para cada tipo de
arquivo, qualquer gerador de CSV (script, planilha, outro sistema) precisa
produzir essas colunas, nessa ordem, para ser aceito no `/integrar`.

Tem dois estilos de arquivo, dependendo do que é importado:

- **Entrada e Saída** (movimentação financeira): 3 tipos de linha
  identificados pela primeira coluna (`tipo_registro`), sem cabeçalho de
  coluna nomeada, posição fixa. Aceitam também **XML validado por XSD**, com
  o mesmo conteúdo — ver [Formato XML](#formato-xml-entrada-e-saída).
- **Clientes e Fornecedores** (cadastro): CSV comum, com cabeçalho de coluna
  nomeada na primeira linha e uma linha por registro — não tem totalizador
  porque não é transação, é dado mestre. Só CSV.

Em ambos os estilos, o parser faz `linha.split(",")` simples, sem suporte a
aspas ou vírgula dentro de campo, já que o próprio formato assume que nomes
de cliente/fornecedor/categoria não têm vírgula.

### Entrada (vendas/recebimentos, agrupados por cliente)

```
tipo_registro,cliente,documento,categoria,subtotal,desconto_percentual,desconto_valor,frete,valor_total,forma_pagamento,data_pedido,status
0,GEOCONSULT ENGENHARIA LTDA,12345678000199,,,,,TOTAL POR CLIENTE,20260813,GABRIEL
1,Ana Santos,11122233344,Vendas,961421.78,6.80,65419.10,6162.23,902164.91,Boleto,20260811,CONFIRMADO
9,10,10478284.62
```

- **Linha `0`** (cabeçalho): `tipo_registro,nome_empresa,cnpj,(4 campos vazios),tipo_documento,data_arquivo,usuario`
- **Linha `1`** (detalhe, uma por cliente): `tipo_registro,cliente,documento,categoria,subtotal,desconto_percentual,desconto_valor,frete,valor_total,forma_pagamento,data_pedido,status`
- **Linha `9`** (totalizador): `tipo_registro,qtd_registros,valor_total_geral`

`status` é o status do registro (ex: `CONFIRMADO`, `PENDENTE`). O único valor com efeito no sistema é `CANCELADO` - linhas com esse status são ignoradas na importação; qualquer outro texto é só armazenado.

### Saída (despesas/pagamentos, agrupados por fornecedor)

```
tipo_registro,fornecedor,documento,categoria,valor,forma_pagamento,data_pagamento,status
0,GEOCONSULT ENGENHARIA LTDA,12345678000199,,,TOTAL POR FORNECEDOR,20260813,GABRIEL
1,Distribuidora ABC Ltda,99988877000166,Fornecedores,45230.00,Boleto,20260811,CONFIRMADO
9,1,45230.00
```

- **Linha `0`**: `tipo_registro,nome_empresa,cnpj,(2 campos vazios),tipo_documento,data_arquivo,usuario`
- **Linha `1`** (detalhe, uma por fornecedor): `tipo_registro,fornecedor,documento,categoria,valor,forma_pagamento,data_pagamento,status`
- **Linha `9`**: `tipo_registro,qtd_registros,valor_total_geral`

### Clientes e Fornecedores (importação de cadastro)

Formato bem mais simples que Entrada/Saída — CSV comum, com cabeçalho:

```
nome,documento,email,telefone
Cliente Exemplo LTDA,00011122233,contato@exemplo.com,11999998888
```

- **`nome`**: obrigatório.
- **`documento`, `email`, `telefone`**: opcionais (podem ficar vazios).
- Formato idêntico pra Clientes e Fornecedores — só muda o tipo escolhido no
  `/integrar` (Clientes ou Fornecedores), que decide se os registros do
  arquivo vão pro cadastro de cliente ou de fornecedor.

Comportamento na importação, por linha:

- Se **`documento` preenchido e já existe** um cadastro com esse documento
  (do tipo certo): **atualiza** nome, e-mail e telefone (um campo vindo em
  branco no arquivo não apaga o que já estava salvo).
- Senão: **cria** um cadastro novo.

Ou seja, essa importação serve tanto pra carregar uma lista nova quanto pra
atualizar em lote os dados de contato de cadastros que já existem. Ela não
gera registro em Histórico nem some no saldo — é só cadastro, não afeta
nenhum valor financeiro.

### Formato XML (Entrada e Saída)

Entrada e Saída também entram em XML, com o mesmo conteúdo do layout texto.
A diferença que importa é o contrato: existe um **XSD** por movimento, e a
importação recusa qualquer arquivo que não o satisfaça, devolvendo a regra
violada com o número da linha.

Os schemas ficam em `lib/xml/schemas/` e são servidos para download em
`/integrar/schema?tipo=ENTRADA|SAIDA` — quem gera o arquivo do outro lado
valida antes de enviar, em vez de descobrir o erro na resposta.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<movimento xmlns="urn:finanweb:entrada:1.0" versao="1.0" tipo="ENTRADA">
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
</movimento>
```

Saída tem a mesma espinha dorsal, com `<despesas>/<despesa>`, `<fornecedor>`
e um único campo `<valor>` (sem subtotal, desconto nem frete).

O que o XSD impõe e o layout texto não impunha:

| Regra | Aceito |
|---|---|
| `documento` | só dígitos, 11 (CPF) ou 14 (CNPJ), obrigatório |
| `status` | enumeração fechada: `CONFIRMADO`, `PENDENTE`, `CANCELADO` |
| valores | `xs:decimal`, até 14 dígitos, 2 casas, não negativo |
| datas | `xs:date` (`AAAA-MM-DD`) — o `AAAAMMDD` do CSV é recusado |
| `percentual` | de 0 a 100, até 2 casas |
| estrutura | `cabecalho` → `pedidos`/`despesas` → `totalizador`, nessa ordem, com pelo menos um registro |

Como isso se encaixa no código:

- `lib/parsers/entrada-xml.ts` e `saida-xml.ts` devolvem exatamente os mesmos
  `EntradaParseResult`/`SaidaParseResult` dos parsers de CSV, então a
  gravação no banco não sabe de que formato o arquivo veio.
- `lib/xml-writer.ts` recebe essas mesmas estruturas: ler e escrever são
  inversos, e é isso que permite exportar em XML e reimportar o arquivo.
- `lib/xml/validador.ts` valida com `xmllint-wasm` (libxml2 em WebAssembly,
  sem dependência nativa). O `next.config.mjs` precisa marcar esse pacote
  como externo e incluir os `.xsd` no `outputFileTracing`, senão a validação
  quebra só no build de produção.

Exportação: `/relatorios/export?formato=xml&tipo=ENTRADAS|SAIDAS` gera o
movimento completo e **confere a própria saída contra o XSD** antes de
devolver o arquivo. Balanço não tem XML.

### Cadastros (clientes e fornecedores)

Cliente e fornecedor não são mais texto solto: são um cadastro (`Parceiro`,
com nome, documento, e-mail e telefone), gerenciável em `/admin/cadastros`.
A forma de resolver esse cadastro depende de onde o dado entra:

- **Pelo CSV de Entrada/Saída**: casa pelo campo `documento` (CNPJ/CPF), que
  é obrigatório em ambos os formatos. Se já existe um cadastro com aquele
  documento (para o tipo certo, cliente ou fornecedor), reaproveita; senão,
  cria um novo com o nome que veio no arquivo — sem preencher e-mail/
  telefone.
- **Pelo CSV dedicado de Clientes/Fornecedores** (seção acima): cria ou
  atualiza o cadastro completo, incluindo e-mail e telefone.
- **Pelas telas de Recebimentos/Pagamentos**: é obrigatório escolher um
  cadastro já existente num seletor; se ainda não existe, dá pra criar um
  novo rápido direto ali (só com o nome — documento, e-mail e telefone
  ficam em branco, editáveis depois em `/admin/cadastros`).

### Categorias

Categorias são livres: se uma categoria citada no CSV ainda não existe no
banco (para aquele tipo, Entrada ou Saída), ela é criada automaticamente
durante a importação. A tela `/admin/categorias` lista as categorias de
Entrada e de Saída separadamente e permite renomear cada uma (diálogo
simples) ou cadastrar uma nova manualmente.

## Regras de negócio

- O sistema não recalcula a regra D+2, assume que quem gerou o arquivo já
  aplicou essa regra antes de exportar o CSV. O sistema web só ingere
  `data_pedido` / `data_pagamento` como vierem no arquivo, sem validar.
- Cada novo arquivo importado soma ao histórico (não substitui), o saldo é
  cumulativo entre importações.
- Saldo geral = soma de todas as Entradas − soma de todas as Saídas.
- `PedidoAgrupado` e `DespesaAgrupada` guardam uma linha por cliente/
  fornecedor por importação (dados já agrupados, não pedido a pedido), a
  mesma granularidade que o CSV já traz.
- Todo campo monetário usa `Decimal(14,2)` no banco (nunca `Float`), para
  evitar erro de arredondamento.
- O sistema funciona sem depender de importar CSV nenhum: dá pra lançar
  recebimentos e pagamentos direto nas telas, e editar ou excluir (exclusão
  só ADMIN) qualquer registro depois, venha ele de um CSV ou lançado na mão.
  O arquivo original de uma importação (em Histórico) não muda quando os
  registros dela são editados — continua sendo o comprovante do envio.

## Telas

| Rota | Descrição | Acesso |
|---|---|---|
| `/login` | Login (username + senha) | público |
| `/` | Dashboard: saldo geral, top clientes, top fornecedores | autenticado |
| `/integrar` | Upload de CSV (Entrada, Saída, Clientes ou Fornecedores) | autenticado |
| `/recebimentos` | Recebimentos (de CSV ou lançados na mão): listar, filtrar, criar, editar; excluir é ADMIN | autenticado |
| `/pagamentos` | Pagamentos (de CSV ou lançados na mão): listar, filtrar, criar, editar; excluir é ADMIN | autenticado |
| `/historico` | Log de arquivos importados, com link de download do CSV original | autenticado |
| `/relatorios` | Exporta CSV (Entradas / Saídas / Balanço) por período | autenticado |
| `/admin/usuarios` | Criar/desativar usuários | ADMIN |
| `/admin/categorias` | Editar nome das categorias de Entrada e Saída | ADMIN |
| `/admin/cadastros` | Criar/editar clientes e fornecedores (nome, documento, e-mail, telefone) | ADMIN |

## Variáveis de ambiente

Ver [.env.example](.env.example):

```
DATABASE_URL=              # Neon Postgres, via integração Vercel Marketplace
BLOB_READ_WRITE_TOKEN=     # gerado ao instalar o addon Vercel Blob no projeto
SESSION_COOKIE_NAME=sf_sessao
```

## Rodando localmente

```bash
npm install
npx prisma migrate dev --name init
npm run db:seed
npm run dev
```

## Ferramentas EDI (fora do sistema principal)

Em `public/`, duas páginas HTML autocontidas (sem servidor, sem build, rodam
direto no navegador — ou por `/gerador-edi-orders.html` quando o app está no
ar):

- **`gerador-edi-orders.html`**: monta um pedido de compra e gera a mensagem
  EDIFACT ORDERS (D.96A) correspondente, usando só os segmentos obrigatórios
  (UNB/UNZ, UNH/UNT, BGM, DTM, NAD comprador/fornecedor, LIN+QTY por item,
  UNS). Tem botão de copiar e de baixar o `.txt`.
- **`validador-edi-orders.html`**: sobe ou cola um arquivo EDI e confere se
  ele segue essa mesma estrutura mínima, mensagem por mensagem (cada bloco
  `UNH...UNT` é validado como um pedido separado), além de mostrar uma
  leitura humana do conteúdo decodificado.

## Limitações conhecidas

- Autenticação sem hash de senha e sem expiração de sessão.
- Parser de CSV não trata aspas nem vírgula dentro de campo. (No XML isso não
  se aplica: vírgula em nome funciona normalmente.)
- Regra D+2 não é revalidada no servidor, o sistema confia no valor que vem no arquivo.
- O XSD é 1.0, que não expressa regra entre campos: `valorTotal = subtotal −
  desconto + frete` e `qtdRegistros = count(pedido)` não são verificados pelo
  schema. Precisaria de `xs:assert` (XSD 1.1), que o libxml2 não suporta.
- Importação de XML tem limite de 10 MB, porque a validação monta a árvore
  inteira em memória. CSV segue sem limite, lido linha a linha.
- Cadastro de Clientes e Fornecedores só aceita CSV — é lista plana, sem XSD.
- A importação não guarda em coluna própria o formato do arquivo; ele é
  deduzido da extensão em `nomeArquivo`. Foi uma decisão para não exigir
  migration no banco.
