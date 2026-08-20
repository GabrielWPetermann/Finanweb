-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "TipoImportacao" AS ENUM ('ENTRADA', 'SAIDA');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "senha" TEXT NOT NULL,
    "nomeEquipe" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Categoria" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "TipoImportacao" NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Categoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Importacao" (
    "id" TEXT NOT NULL,
    "tipo" "TipoImportacao" NOT NULL,
    "nomeArquivo" TEXT NOT NULL,
    "blobUrl" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "dataArquivoOriginal" TIMESTAMP(3),
    "qtdRegistros" INTEGER NOT NULL,
    "valorTotal" DECIMAL(14,2) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Importacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PedidoAgrupado" (
    "id" TEXT NOT NULL,
    "importacaoId" TEXT NOT NULL,
    "cliente" TEXT NOT NULL,
    "categoriaId" TEXT NOT NULL,
    "subtotal" DECIMAL(14,2) NOT NULL,
    "descontoPercentual" DECIMAL(6,2) NOT NULL,
    "descontoValor" DECIMAL(14,2) NOT NULL,
    "frete" DECIMAL(14,2) NOT NULL,
    "valorTotal" DECIMAL(14,2) NOT NULL,
    "formaPagamento" TEXT NOT NULL,
    "dataPedido" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,

    CONSTRAINT "PedidoAgrupado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DespesaAgrupada" (
    "id" TEXT NOT NULL,
    "importacaoId" TEXT NOT NULL,
    "fornecedor" TEXT NOT NULL,
    "categoriaId" TEXT NOT NULL,
    "valor" DECIMAL(14,2) NOT NULL,
    "formaPagamento" TEXT NOT NULL,
    "dataPagamento" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,

    CONSTRAINT "DespesaAgrupada_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_username_key" ON "Usuario"("username");

-- CreateIndex
CREATE INDEX "Categoria_tipo_idx" ON "Categoria"("tipo");

-- CreateIndex
CREATE UNIQUE INDEX "Categoria_nome_tipo_key" ON "Categoria"("nome", "tipo");

-- CreateIndex
CREATE INDEX "PedidoAgrupado_cliente_idx" ON "PedidoAgrupado"("cliente");

-- CreateIndex
CREATE INDEX "PedidoAgrupado_dataPedido_idx" ON "PedidoAgrupado"("dataPedido");

-- CreateIndex
CREATE INDEX "PedidoAgrupado_categoriaId_idx" ON "PedidoAgrupado"("categoriaId");

-- CreateIndex
CREATE INDEX "DespesaAgrupada_fornecedor_idx" ON "DespesaAgrupada"("fornecedor");

-- CreateIndex
CREATE INDEX "DespesaAgrupada_dataPagamento_idx" ON "DespesaAgrupada"("dataPagamento");

-- CreateIndex
CREATE INDEX "DespesaAgrupada_categoriaId_idx" ON "DespesaAgrupada"("categoriaId");

-- AddForeignKey
ALTER TABLE "Importacao" ADD CONSTRAINT "Importacao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoAgrupado" ADD CONSTRAINT "PedidoAgrupado_importacaoId_fkey" FOREIGN KEY ("importacaoId") REFERENCES "Importacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoAgrupado" ADD CONSTRAINT "PedidoAgrupado_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DespesaAgrupada" ADD CONSTRAINT "DespesaAgrupada_importacaoId_fkey" FOREIGN KEY ("importacaoId") REFERENCES "Importacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DespesaAgrupada" ADD CONSTRAINT "DespesaAgrupada_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
