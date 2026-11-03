import request from "supertest";

import { server } from "../../../src/server";
import { desconectarBancoDeDados } from "../../../src/config/db";

describe("Integração: cabeçalhos de segurança e CORS", () => {
    afterAll(async () => {
        await desconectarBancoDeDados();
    });

    it("Deve enviar os cabeçalhos de segurança do helmet e esconder o X-Powered-By", async () => {
        const response = await request(server).get("/api/auth/me");

        expect(response.headers["x-frame-options"]).toBe("SAMEORIGIN");
        expect(response.headers["x-content-type-options"]).toBe("nosniff");
        expect(response.headers["strict-transport-security"]).toBeDefined();
        expect(response.headers["content-security-policy"]).toBeDefined();
        expect(response.headers["x-powered-by"]).toBeUndefined();
    });

    it("Deve liberar o CORS para localhost fora de produção", async () => {
        const response = await request(server)
            .get("/api/auth/me")
            .set("Origin", "http://localhost:5173");

        expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
        expect(response.headers["access-control-allow-credentials"]).toBe("true");
    });

    it("Deve bloquear o CORS de uma origem desconhecida sem gerar erro 500", async () => {
        const response = await request(server)
            .get("/api/auth/me")
            .set("Origin", "https://site-malicioso.com");

        expect(response.headers["access-control-allow-origin"]).toBeUndefined();
        expect(response.status).not.toBe(500);
    });
});
