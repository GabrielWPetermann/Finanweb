import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.usuario.upsert({
    where: { username: "admin" },
    create: {
      username: "admin",
      senha: "admin123",
      nomeEquipe: "Administração",
      role: "ADMIN",
    },
    update: {},
  });

  await prisma.usuario.upsert({
    where: { username: "user" },
    create: {
      username: "user",
      senha: "user123",
      nomeEquipe: "Geral",
      role: "USER",
    },
    update: {},
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (erro) => {
    console.error(erro);
    await prisma.$disconnect();
    process.exit(1);
  });
