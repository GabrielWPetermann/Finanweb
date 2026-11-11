-- CreateTable
CREATE TABLE "ChaveRegistro" (
    "setor" TEXT NOT NULL,
    "chaveHash" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChaveRegistro_pkey" PRIMARY KEY ("setor")
);

-- CreateTable
CREATE TABLE "ServicoRegistrado" (
    "id" TEXT NOT NULL,
    "setor" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "versao" TEXT NOT NULL,
    "protocolo" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "operacao" TEXT,
    "contrato" TEXT,
    "consumidor" TEXT,
    "descricao" TEXT NOT NULL DEFAULT '',
    "situacao" TEXT NOT NULL DEFAULT 'ATIVO',
    "publicadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServicoRegistrado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChaveRegistro_chaveHash_key" ON "ChaveRegistro"("chaveHash");

-- CreateIndex
CREATE INDEX "ServicoRegistrado_nome_idx" ON "ServicoRegistrado"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "ServicoRegistrado_setor_nome_versao_protocolo_key" ON "ServicoRegistrado"("setor", "nome", "versao", "protocolo");

-- AddForeignKey
ALTER TABLE "ServicoRegistrado" ADD CONSTRAINT "ServicoRegistrado_setor_fkey" FOREIGN KEY ("setor") REFERENCES "ChaveRegistro"("setor") ON DELETE CASCADE ON UPDATE CASCADE;
