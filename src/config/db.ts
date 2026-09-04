import { PrismaClient } from "@prisma/client";

declare global {
  var __prisma__: PrismaClient | undefined;
}

const prismaClient =
  global.__prisma__ ??
  new PrismaClient({
    log: ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.__prisma__ = prismaClient;
}

export const prisma = prismaClient;

export async function conectarBancoDeDados() {
  await prisma.$connect();
}

export async function desconectarBancoDeDados() {
  await prisma.$disconnect();
}