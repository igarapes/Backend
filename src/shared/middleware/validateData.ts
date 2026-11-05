import type { Request, Response, NextFunction } from "express";
import type { ZodType } from "zod";

type ValidationTarget = "body" | "query" | "params";

export function validateData<T>(schema: ZodType<T>, target: ValidationTarget = "body") {
    return (req: Request, res: Response, next: NextFunction) => {
        const validation = schema.safeParse(req[target]);
        if(!validation.success){
            return res.status(400).json({
                message: "Erro de validação nos dados enviados",
                details: validation.error.format()
            });
        }
        if (target === "query") {
            Object.defineProperty(req, "query", { value: validation.data, writable: true, configurable: true, enumerable: true });
        } else {
            req[target] = validation.data;
        }

        return next();
    }
}