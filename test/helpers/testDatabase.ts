// Os testes apagam dados à vontade, então nunca podem usar o banco de desenvolvimento.
// Fora do CI, usam o mesmo Postgres do DATABASE_URL, mas com o banco "<nome>_test".
// Para usar outro banco, defina TEST_DATABASE_URL. No CI o banco já é descartável e é usado como está.
export function resolveTestDatabaseUrl(): string {
    if (process.env.TEST_DATABASE_URL) {
        return assertIsTestDatabase(process.env.TEST_DATABASE_URL);
    }

    const baseUrl = process.env.DATABASE_URL;
    if (!baseUrl) {
        throw new Error("DATABASE_URL não configurado: não é possível descobrir o banco de testes.");
    }

    if (process.env.CI) {
        return baseUrl;
    }

    const url = new URL(baseUrl);
    if (!url.pathname.endsWith("_test")) {
        url.pathname = `${url.pathname}_test`;
    }
    return assertIsTestDatabase(url.toString());
}

// Trava de segurança: se por algum motivo a URL não for de um banco de teste, os testes param antes de apagar algo
function assertIsTestDatabase(databaseUrl: string): string {
    if (!process.env.CI && !new URL(databaseUrl).pathname.includes("test")) {
        throw new Error("Os testes só podem rodar em um banco cujo nome contenha \"test\".");
    }
    return databaseUrl;
}
