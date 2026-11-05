import { execSync } from "child_process";
import dotenv from "dotenv";

import { resolveTestDatabaseUrl } from "./helpers/testDatabase";

// Roda uma vez antes de todos os testes: cria o banco de teste (se não existir) e aplica as migrations
export default function globalSetup() {
    dotenv.config({ quiet: true });

    execSync("npx prisma migrate deploy", {
        env: { ...process.env, DATABASE_URL: resolveTestDatabaseUrl() },
        stdio: "pipe",
    });
}
