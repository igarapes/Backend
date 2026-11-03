import type { Request, Response } from "express";

import { requireHttps } from "../../src/shared/middleware/requireHttps";

function criarRequisicao(secure: boolean) {
    return {
        secure,
        headers: { host: "api.igarapes.com.br" },
        originalUrl: "/api/auth/login?origem=teste",
    } as unknown as Request;
}

describe("Unitário: middleware requireHttps", () => {
    it("Deve seguir para a próxima etapa quando a requisição já é HTTPS", () => {
        const res = { redirect: jest.fn() } as unknown as Response;
        const next = jest.fn();

        requireHttps(criarRequisicao(true), res, next);

        expect(next).toHaveBeenCalled();
        expect(res.redirect).not.toHaveBeenCalled();
    });

    it("Deve redirecionar com 308 para a mesma URL em HTTPS quando a requisição é HTTP", () => {
        const res = { redirect: jest.fn() } as unknown as Response;
        const next = jest.fn();

        requireHttps(criarRequisicao(false), res, next);

        expect(res.redirect).toHaveBeenCalledWith(308, "https://api.igarapes.com.br/api/auth/login?origem=teste");
        expect(next).not.toHaveBeenCalled();
    });
});
