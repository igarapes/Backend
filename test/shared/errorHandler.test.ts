import type { Request, Response } from "express";

import { errorHandler } from "../../src/shared/middleware/errorHandler";
import { AppError, ConflictError, ForbiddenError, NotFoundError, UnauthorizedError } from "../../src/shared/errors";

function criarResposta() {
    const res = { headersSent: false } as Response & { status: jest.Mock; json: jest.Mock };
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
}

describe("Unitário: errorHandler", () => {
    const req = {} as Request;

    it.each([
        [new UnauthorizedError(), 401, "Credenciais inválidas"],
        [new ForbiddenError("Acesso negado: teste"), 403, "Acesso negado: teste"],
        [new NotFoundError(), 404, "Usuário não encontrado"],
        [new ConflictError(), 409, "Os dados informados (E-mail ou CPF) já estão em uso."],
        [new AppError("Erro de regra de negócio"), 400, "Erro de regra de negócio"],
        [new AppError("Serviço indisponível", 503), 503, "Serviço indisponível"],
    ])("Deve responder %p com o status %i e a mensagem do erro", (erro, status, mensagem) => {
        const res = criarResposta();

        errorHandler(erro, req, res, jest.fn());

        expect(res.status).toHaveBeenCalledWith(status);
        expect(res.json).toHaveBeenCalledWith({ message: mensagem });
    });

    it("Deve responder 500 genérico para erros inesperados, sem expor a mensagem original", () => {
        const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
        const res = criarResposta();

        errorHandler(new Error("senha do banco: segredo123"), req, res, jest.fn());

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ message: "Ocorreu um erro interno inesperado." });
        expect(JSON.stringify(res.json.mock.calls)).not.toContain("segredo123");
        expect(consoleSpy).toHaveBeenCalled();

        consoleSpy.mockRestore();
    });

    it("Deve repassar o erro se a resposta já tiver começado a ser enviada", () => {
        const res = criarResposta();
        Object.assign(res, { headersSent: true });
        const next = jest.fn();
        const erro = new Error("depois do envio");

        errorHandler(erro, req, res, next);

        expect(next).toHaveBeenCalledWith(erro);
        expect(res.status).not.toHaveBeenCalled();
    });
});
