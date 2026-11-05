import { resolveTestDatabaseUrl } from "../helpers/testDatabase";

describe("Unitário: escolha do banco de teste", () => {
    const original = {
        CI: process.env.CI,
        DATABASE_URL: process.env.DATABASE_URL,
        TEST_DATABASE_URL: process.env.TEST_DATABASE_URL,
    };

    function definirAmbiente(env: { CI?: string; DATABASE_URL?: string; TEST_DATABASE_URL?: string }) {
        for (const chave of ["CI", "DATABASE_URL", "TEST_DATABASE_URL"] as const) {
            if (env[chave] === undefined) delete process.env[chave];
            else process.env[chave] = env[chave];
        }
    }

    afterEach(() => definirAmbiente(original));

    it("Deve usar o mesmo Postgres com o banco terminando em _test, mantendo os parâmetros da URL", () => {
        definirAmbiente({ DATABASE_URL: "postgresql://user:pass@localhost:5432/igarapesdb?schema=public" });

        expect(resolveTestDatabaseUrl()).toBe("postgresql://user:pass@localhost:5432/igarapesdb_test?schema=public");
    });

    it("Não deve adicionar _test de novo se o banco já for de teste", () => {
        definirAmbiente({ DATABASE_URL: "postgresql://user:pass@localhost:5432/igarapesdb_test" });

        expect(resolveTestDatabaseUrl()).toBe("postgresql://user:pass@localhost:5432/igarapesdb_test");
    });

    it("Deve usar o TEST_DATABASE_URL quando ele estiver definido", () => {
        definirAmbiente({
            DATABASE_URL: "postgresql://user:pass@localhost:5432/igarapesdb",
            TEST_DATABASE_URL: "postgresql://user:pass@outrohost:5432/banco_test",
        });

        expect(resolveTestDatabaseUrl()).toBe("postgresql://user:pass@outrohost:5432/banco_test");
    });

    it("Deve impedir os testes de rodarem num banco que não seja de teste", () => {
        definirAmbiente({
            DATABASE_URL: "postgresql://user:pass@localhost:5432/igarapesdb",
            TEST_DATABASE_URL: "postgresql://user:pass@localhost:5432/igarapesdb",
        });

        expect(() => resolveTestDatabaseUrl()).toThrow("Os testes só podem rodar em um banco cujo nome contenha");
    });

    it("No CI deve usar o DATABASE_URL como está, porque o banco já é descartável", () => {
        definirAmbiente({ CI: "true", DATABASE_URL: "postgresql://user:pass@localhost:5432/ci_db" });

        expect(resolveTestDatabaseUrl()).toBe("postgresql://user:pass@localhost:5432/ci_db");
    });
});
