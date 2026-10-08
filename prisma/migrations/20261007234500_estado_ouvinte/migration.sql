-- CreateTable
CREATE TABLE "EstadoOuvinte" (
    "id" TEXT NOT NULL,
    "conectados" TEXT[],
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EstadoOuvinte_pkey" PRIMARY KEY ("id")
);

