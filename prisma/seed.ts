import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("O seed não pode ser executado em produção.");
  }
  
  console.log("🧹 Limpando o banco de dados...");
  // AVISO: A ordem importa! Deletamos as dependências primeiro para não quebrar as Foreign Keys.
  await prisma.auditLog.deleteMany();
  await prisma.user.deleteMany();
  await prisma.role.deleteMany();

  console.log("🌱 Plantando novos dados iniciais...");

  // 1. Criando as Roles
  const adminRole = await prisma.role.create({ data: { name: "ADMIN" } });
  const tecnicoRole = await prisma.role.create({ data: { name: "TECNICO" } });
  const usuarioRole = await prisma.role.create({ data: { name: "USUARIO" } });

  // Hasheando uma única senha padrão para todos os testes ficarem mais fáceis
  const defaultPassword = await bcrypt.hash("Admin123!", 10);

  // 2. Criando o Administrador (Único)
  const adminUser = await prisma.user.create({
    data: {
      name: "Administrador Igarapés",
      email: "admin@igarape.com.br",
      cpf: "00000000000", 
      phone: "61999999999",
      password: defaultPassword,
      firstAccess: true,
      roleId: adminRole.id, 
    },
  });

  // 3. Criando 2 Técnicos em lote (createMany)
  await prisma.user.createMany({
    data: [
      {
        name: "Técnico Silva",
        email: "tecnico1@igarape.com.br",
        cpf: "11111111111",
        phone: "61988880001",
        password: defaultPassword,
        firstAccess: true,
        roleId: tecnicoRole.id,
      },
      {
        name: "Técnico Souza",
        email: "tecnico2@igarape.com.br",
        cpf: "22222222222",
        phone: "61988880002",
        password: defaultPassword,
        firstAccess: true,
        roleId: tecnicoRole.id,
      }
    ]
  });

  // 4. Criando 5 Usuários em lote (createMany)
  await prisma.user.createMany({
    data: [
      {
        name: "Usuário Alfa",
        email: "usuario1@igarape.com.br",
        cpf: "33333333331",
        phone: "61977770001",
        password: defaultPassword,
        firstAccess: true,
        roleId: usuarioRole.id,
      },
      {
        name: "Usuário Bravo",
        email: "usuario2@igarape.com.br",
        cpf: "33333333332",
        phone: "61977770002",
        password: defaultPassword,
        firstAccess: true,
        roleId: usuarioRole.id,
      },
      {
        name: "Usuário Charlie",
        email: "usuario3@igarape.com.br",
        cpf: "33333333333",
        phone: "61977770003",
        password: defaultPassword,
        firstAccess: true,
        roleId: usuarioRole.id,
      },
      {
        name: "Usuário Delta",
        email: "usuario4@igarape.com.br",
        cpf: "33333333334",
        phone: "61977770004",
        password: defaultPassword,
        firstAccess: true,
        roleId: usuarioRole.id,
      },
      {
        name: "Usuário Echo",
        email: "usuario5@igarape.com.br",
        cpf: "33333333335",
        phone: "61977770005",
        password: defaultPassword,
        firstAccess: true,
        roleId: usuarioRole.id,
      }
    ]
  });

  console.log("✅ Seed finalizado com sucesso!");
  console.log("\n📊 Resumo dos dados gerados:");
  console.log("- 3 Papéis (Roles)");
  console.log("- 1 Administrador");
  console.log("- 2 Técnicos");
  console.log("- 5 Usuários");
  
  console.log("\n🔑 Credenciais de Teste (Senha Padrão para todos: Admin123!):");
  console.log(`- Admin:   ${adminUser.email}`);
  console.log(`- Técnico: tecnico1@igarape.com.br`);
  console.log(`- Usuário: usuario1@igarape.com.br`);
}

main()
  .catch((e) => {
    console.error("❌ Erro ao rodar o seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });