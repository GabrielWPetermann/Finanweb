# Finanweb

Sistema web que simula o setor financeiro de uma empresa: recebe arquivos CSV
de Entrada (vendas/recebimentos) e Saída (despesas/pagamentos) através de uma
tela de upload, e gera dashboard de saldo, listagens filtráveis, histórico de
importações e relatórios exportáveis.

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

Os dois formatos seguem a mesma lógica: 3 tipos de linha identificados pela
primeira coluna (`tipo_registro`), sem cabeçalho de coluna nomeada, posição
fixa. O parser faz `linha.split(",")` simples, sem suporte a aspas ou
vírgula dentro de campo, já que o próprio formato assume que nomes de
cliente/fornecedor/categoria não têm vírgula.

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

### Cadastros (clientes e fornecedores)

Cliente e fornecedor não são mais texto solto: são um cadastro (`Parceiro`,
com nome, documento, e-mail e telefone), gerenciável em `/admin/cadastros`.
A forma de resolver esse cadastro depende de onde o dado entra:

- **Pelo CSV**: casa pelo campo `documento` (CNPJ/CPF), que é obrigatório em
  ambos os formatos. Se já existe um cadastro com aquele documento (para o
  tipo certo, cliente ou fornecedor), reaproveita; senão, cria um novo com o
  nome que veio no arquivo.
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
| `/integrar` | Upload de CSV (Entrada ou Saída) | autenticado |
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
- Parser de CSV não trata aspas nem vírgula dentro de campo.
- Regra D+2 não é revalidada no servidor, o sistema confia no valor que vem no arquivo.
