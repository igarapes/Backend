import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthRequest extends Request{
    userId?: string;
    roleId?:string;
}

export function authenticated(req: AuthRequest, res: Response, next: NextFunction) {
    const token = req.cookies.token;
    if(!token){
        return res.status(401).json({message: "Acesso negado: Token não fornecido."});
    }

    const secret = process.env.AUTH_TOKEN;

    if (!secret) {
        console.error("AUTH_TOKEN não configurado.");

        return res.status(500).json({ message: "Ocorreu um erro interno inesperado." });
    }

    try {
        const payload = jwt.verify(token, secret) as {id: string, role: string};
        req.userId = payload.id;
        req.roleId = payload.role;
        return next();
    } catch {
        return res.status(401).json({message: "Acesso negado: Token inválido ou expirado."})
    }
}