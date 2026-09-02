import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  console.log("🧹 Limpando o banco de dados...");
  
  // 1. DELEÇÃO NA ORDEM CORRETA
  // Primeiro deletamos os filhos (Usuários)
  await prisma.user.deleteMany();
  // Depois deletamos os pais (Roles)
  await prisma.role.deleteMany();

  console.log("🌱 Plantando novos dados iniciais...");

  // 2. CRIAR TODOS OS PAPÉIS (ROLES)
  const adminRole = await prisma.role.create({
    data: { name: "admin" },
  });
  
  const tecnicoRole = await prisma.role.create({
    data: { name: "tecnico" },
  });
  
  const usuarioRole = await prisma.role.create({
    data: { name: "usuario" },
  });

  // 3. GERAR SENHA DO ADMIN
  const hashPassword = await bcrypt.hash("Admin123!", 10);

  // 4. CRIAR O USUÁRIO ADMIN
  const adminUser = await prisma.user.create({
    data: {
      email: "admin@igarape.com.br",
      cpf: "00000000000", 
      name: "Administrador Igarapés",
      phone: "61999999999",
      password: hashPassword,
      firstAccess: true,
      roleId: adminRole.id, // Relacionando com o papel 'admin' recém-criado
    },
  });

  console.log("✅ Papéis criados com sucesso: admin, tecnico, usuario.");
  console.log("✅ Usuário Admin criado com sucesso!");
  console.log(`📧 Email para teste: ${adminUser.email}`);
  console.log(`🔑 Senha para teste: Admin123!`);
}

main()
  .catch((e) => {
    console.error("❌ Erro ao rodar o seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });