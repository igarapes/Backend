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

    try {
        const secret = process.env.AUTH_TOKEN as string;
        const payload = jwt.verify(token, secret) as {id: string, role: string};
        req.userId = payload.id;
        req.roleId = payload.role;
        return next();
    } catch {
        return res.status(401).json({message: "Acesso negado: Token inválido ou expirado."})
    }
}