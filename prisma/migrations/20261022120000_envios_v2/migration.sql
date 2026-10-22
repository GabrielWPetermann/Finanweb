-- AlterTable
ALTER TABLE "PedidoAgrupado" ADD COLUMN     "origem" TEXT,
ADD COLUMN     "referencia" TEXT,
ADD COLUMN     "vencimento" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "DespesaAgrupada" ADD COLUMN     "origem" TEXT,
ADD COLUMN     "referencia" TEXT,
ADD COLUMN     "vencimento" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "PedidoAgrupado_origem_referencia_key" ON "PedidoAgrupado"("origem", "referencia");

-- CreateIndex
CREATE UNIQUE INDEX "DespesaAgrupada_origem_referencia_key" ON "DespesaAgrupada"("origem", "referencia");
