import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("O seed não pode ser executado em produção.");
  }
  console.log("Limpando o banco de dados...");
  
  await prisma.user.deleteMany();
  await prisma.role.deleteMany();
  await prisma.auditLog.deleteMany()

  console.log("Plantando novos dados iniciais...");

  const adminRole = await prisma.role.create({
    data: { name: "admin" },
  });
  
  const tecnicoRole = await prisma.role.create({
    data: { name: "tecnico" },
  });
  
  const usuarioRole = await prisma.role.create({
    data: { name: "usuario" },
  });

  const hashPassword = await bcrypt.hash("Admin123!", 10);

  const adminUser = await prisma.user.create({
    data: {
      email: "admin@igarape.com.br",
      cpf: "00000000000", 
      name: "Administrador Igarapés",
      phone: "61999999999",
      password: hashPassword,
      firstAccess: true,
      roleId: adminRole.id, 
    },
  });

  console.log("Papéis criados com sucesso: admin, tecnico, usuario.");
  console.log("Usuário Admin criado com sucesso!");
  console.log(`Email para teste: ${adminUser.email}`);
  console.log(`Senha para teste: Admin123!`);
}

main()
  .catch((e) => {
    console.error("Erro ao rodar o seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });