import dotenv from "dotenv";

import { resolveTestDatabaseUrl } from "./helpers/testDatabase";

// Roda antes de cada arquivo de teste, antes do Prisma ser carregado: aponta o DATABASE_URL para o banco de teste.
// O "dotenv/config" do server.ts não sobrescreve variáveis que já existem, então o banco de teste prevalece.
dotenv.config({ quiet: true });
process.env.DATABASE_URL = resolveTestDatabaseUrl();

jest.spyOn(globalThis, "fetch").mockImplementation(async () => new Response(""));
