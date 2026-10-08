-- CreateEnum
CREATE TYPE "DirecaoMensagem" AS ENUM ('RECEBIDA', 'ENVIADA');

-- CreateTable
CREATE TABLE "MensagemChat" (
    "id" TEXT NOT NULL,
    "direcao" "DirecaoMensagem" NOT NULL,
    "autor" TEXT NOT NULL,
    "destino" TEXT,
    "privada" BOOLEAN NOT NULL DEFAULT false,
    "aviso" BOOLEAN NOT NULL DEFAULT false,
    "texto" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enviadaEm" TIMESTAMP(3),

    CONSTRAINT "MensagemChat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MensagemChat_criadoEm_idx" ON "MensagemChat"("criadoEm");

-- CreateIndex
CREATE INDEX "MensagemChat_direcao_enviadaEm_idx" ON "MensagemChat"("direcao", "enviadaEm");

