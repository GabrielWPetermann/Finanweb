# Finanweb

Sistema web que simula o setor financeiro de uma empresa: recebe arquivos CSV
de Entrada (vendas/recebimentos) e Saída (despesas/pagamentos) através de uma
tela de upload, e gera dashboard de saldo, listagens filtráveis, histórico de
importações e relatórios exportáveis.

Projeto feito para a disciplina de **Interoperabilidade**. O foco é o parsing
manual do arquivo — por isso não uso nenhuma lib de CSV. Segurança não é o
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
sem expiração de sessão. Não é pensado para produção real — é o suficiente
para o escopo da disciplina.

Usuários criados pelo seed (`npm run db:seed`):

| username | senha    | papel |
|----------|----------|-------|
| admin    | admin123 | ADMIN |
| user     | user123  | USER  |

## Formatos de arquivo

Abaixo está a estrutura exata que o sistema espera para cada tipo de
arquivo — qualquer gerador de CSV (script, planilha, outro sistema) precisa
produzir essas colunas, nessa ordem, para ser aceito no `/integrar`.

Os dois formatos seguem a mesma lógica: 3 tipos de linha identificados pela
primeira coluna (`tipo_registro`), sem cabeçalho de coluna nomeada — posição
fixa. O parser faz `linha.split(",")` simples, sem suporte a aspas ou
vírgula dentro de campo, já que o próprio formato assume que nomes de
cliente/fornecedor/categoria não têm vírgula.

### Entrada (vendas/recebimentos, agrupados por cliente)

```
tipo_registro,cliente,categoria,subtotal,desconto_percentual,desconto_valor,frete,valor_total,forma_pagamento,data_pedido,status
0,GEOCONSULT ENGENHARIA LTDA,12345678000199,,,,,TOTAL POR CLIENTE,20260813,GABRIEL
1,Ana Santos,Vendas,961421.78,6.80,65419.10,6162.23,902164.91,Boleto,20260811,TOTAL
9,10,10478284.62
```

- **Linha `0`** (cabeçalho): `tipo_registro,nome_empresa,cnpj,(4 campos vazios),tipo_documento,data_arquivo,usuario`
- **Linha `1`** (detalhe, uma por cliente): `tipo_registro,cliente,categoria,subtotal,desconto_percentual,desconto_valor,frete,valor_total,forma_pagamento,data_pedido,status`
- **Linha `9`** (totalizador): `tipo_registro,qtd_registros,valor_total_geral`

Linhas com `status = CANCELADO` são ignoradas na importação.

### Saída (despesas/pagamentos, agrupados por fornecedor)

```
tipo_registro,fornecedor,categoria,valor,forma_pagamento,data_pagamento,status
0,GEOCONSULT ENGENHARIA LTDA,12345678000199,,,TOTAL POR FORNECEDOR,20260813,GABRIEL
1,Distribuidora ABC Ltda,Fornecedores,45230.00,Boleto,20260811,TOTAL
9,1,45230.00
```

- **Linha `0`**: `tipo_registro,nome_empresa,cnpj,(2 campos vazios),tipo_documento,data_arquivo,usuario`
- **Linha `1`** (detalhe, uma por fornecedor): `tipo_registro,fornecedor,categoria,valor,forma_pagamento,data_pagamento,status`
- **Linha `9`**: `tipo_registro,qtd_registros,valor_total_geral`

### Categorias

Categorias são livres: se uma categoria citada no CSV ainda não existe no
banco (para aquele tipo, Entrada ou Saída), ela é criada automaticamente
durante a importação. A tela `/admin/categorias` lista as categorias de
Entrada e de Saída separadamente e permite renomear cada uma (diálogo
simples) ou cadastrar uma nova manualmente.

## Regras de negócio

- O sistema não recalcula a regra D+2 — assume que quem gerou o arquivo já
  aplicou essa regra antes de exportar o CSV. O sistema web só ingere
  `data_pedido` / `data_pagamento` como vierem no arquivo, sem validar.
- Cada novo arquivo importado soma ao histórico (não substitui) — o saldo é
  cumulativo entre importações.
- Saldo geral = soma de todas as Entradas − soma de todas as Saídas.
- `PedidoAgrupado` e `DespesaAgrupada` guardam uma linha por cliente/
  fornecedor por importação (dados já agrupados, não pedido a pedido) — a
  mesma granularidade que o CSV já traz.
- Todo campo monetário usa `Decimal(14,2)` no banco (nunca `Float`), para
  evitar erro de arredondamento.

## Telas

| Rota | Descrição | Acesso |
|---|---|---|
| `/login` | Login (username + senha) | público |
| `/` | Dashboard: saldo geral, top clientes, top fornecedores | autenticado |
| `/integrar` | Upload de CSV (Entrada ou Saída) | autenticado |
| `/recebimentos` | Linhas de Entrada importadas, filtrável por categoria/cliente/período | autenticado |
| `/pagamentos` | Linhas de Saída importadas, filtrável por categoria/fornecedor/período | autenticado |
| `/historico` | Log de arquivos importados, com link de download do CSV original | autenticado |
| `/relatorios` | Exporta CSV (Entradas / Saídas / Balanço) por período | autenticado |
| `/admin/usuarios` | Criar/desativar usuários | ADMIN |
| `/admin/categorias` | Editar nome das categorias de Entrada e Saída | ADMIN |

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

## Deploy na Vercel

1. Subir o repositório no GitHub e importar o projeto na Vercel.
2. Aba **Storage** → **Create Database** → **Neon** (injeta `DATABASE_URL`).
3. Aba **Storage** → **Create** → **Blob** (injeta `BLOB_READ_WRITE_TOKEN`).
4. Rodar `npx prisma migrate deploy` (ou `migrate dev` localmente apontando
   para a `DATABASE_URL` da Neon).
5. Rodar `npm run db:seed` uma vez para criar os usuários iniciais.
6. Deploy — o `postinstall` já roda `prisma generate` automaticamente.

## Limitações conhecidas

- Autenticação sem hash de senha e sem expiração de sessão.
- Parser de CSV não trata aspas nem vírgula dentro de campo.
- Regra D+2 não é revalidada no servidor — o sistema confia no valor que
  vem no arquivo.
