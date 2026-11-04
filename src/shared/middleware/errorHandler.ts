import type { Request, Response, NextFunction } from "express";

import { AppError } from "../errors.js";

const INTERNAL_ERROR_MESSAGE = "Ocorreu um erro interno inesperado.";

function isBodyParserError(err: unknown): err is { type: string; status: number } {
    return typeof err === "object" && err !== null && "type" in err && "status" in err;
}

export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
    if (res.headersSent) {
        return next(err);
    }

    if (err instanceof AppError) {
        return res.status(err.statusCode).json({ message: err.message });
    }

    if (isBodyParserError(err)) {
        const message = err.type === "entity.parse.failed" ? "JSON inválido no corpo da requisição." : "Requisição inválida.";
        return res.status(err.status).json({ message });
    }

    console.error("Erro inesperado:", err);
    return res.status(500).json({ message: INTERNAL_ERROR_MESSAGE });
}
