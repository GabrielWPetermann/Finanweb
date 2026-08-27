/*
  Warnings:

  - You are about to drop the column `fornecedor` on the `DespesaAgrupada` table. All the data in the column will be lost.
  - You are about to drop the column `cliente` on the `PedidoAgrupado` table. All the data in the column will be lost.
  - Added the required column `fornecedorId` to the `DespesaAgrupada` table without a default value. This is not possible if the table is not empty.
  - Added the required column `clienteId` to the `PedidoAgrupado` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "TipoParceiro" AS ENUM ('CLIENTE', 'FORNECEDOR');

-- DropIndex
DROP INDEX "DespesaAgrupada_fornecedor_idx";

-- DropIndex
DROP INDEX "PedidoAgrupado_cliente_idx";

-- AlterTable
ALTER TABLE "DespesaAgrupada" DROP COLUMN "fornecedor",
ADD COLUMN     "fornecedorId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "PedidoAgrupado" DROP COLUMN "cliente",
ADD COLUMN     "clienteId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "Parceiro" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "documento" TEXT,
    "email" TEXT,
    "telefone" TEXT,
    "tipo" "TipoParceiro" NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Parceiro_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Parceiro_tipo_idx" ON "Parceiro"("tipo");

-- CreateIndex
CREATE INDEX "Parceiro_nome_idx" ON "Parceiro"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Parceiro_documento_tipo_key" ON "Parceiro"("documento", "tipo");

-- CreateIndex
CREATE INDEX "DespesaAgrupada_fornecedorId_idx" ON "DespesaAgrupada"("fornecedorId");

-- CreateIndex
CREATE INDEX "PedidoAgrupado_clienteId_idx" ON "PedidoAgrupado"("clienteId");

-- AddForeignKey
ALTER TABLE "PedidoAgrupado" ADD CONSTRAINT "PedidoAgrupado_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Parceiro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DespesaAgrupada" ADD CONSTRAINT "DespesaAgrupada_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Parceiro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
