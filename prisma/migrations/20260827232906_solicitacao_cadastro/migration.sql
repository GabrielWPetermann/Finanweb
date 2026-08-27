-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "aprovado" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "whatsapp" TEXT,
ALTER COLUMN "nomeEquipe" SET DEFAULT '';
