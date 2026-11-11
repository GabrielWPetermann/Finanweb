-- CreateTable
CREATE TABLE "LimiteRequisicao" (
    "chave" TEXT NOT NULL,
    "janela" TIMESTAMP(3) NOT NULL,
    "contagem" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "LimiteRequisicao_pkey" PRIMARY KEY ("chave","janela")
);

-- CreateIndex
CREATE INDEX "LimiteRequisicao_janela_idx" ON "LimiteRequisicao"("janela");
