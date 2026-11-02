import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

import { prisma } from "../../config/db.js";

export interface AuthRequest extends Request{
    userId?: string;
    roleId?:string;
    firstAccess?:boolean;
}

export async function authenticated(req: AuthRequest, res: Response, next: NextFunction) {
    const token = req.cookies.token;
    if(!token){
        return res.status(401).json({message: "Acesso negado: Token não fornecido."});
    }

    const secret = process.env.AUTH_TOKEN;

    if (!secret) {
        console.error("AUTH_TOKEN não configurado.");

        return res.status(500).json({ message: "Ocorreu um erro interno inesperado." });
    }

    let payload: {id?: string};
    try {
        payload = jwt.verify(token, secret) as {id?: string};
    } catch {
        return res.status(401).json({message: "Acesso negado: Token inválido ou expirado."});
    }

    if(!payload.id){
        return res.status(401).json({message: "Acesso negado: Token inválido ou expirado."});
    }

    let user;
    try {
        user = await prisma.user.findUnique({
            where: {id: payload.id},
            select: {
                isActivate: true,
                firstAccess: true,
                role: {
                    select: {name: true}
                }
            }
        });
    } catch (error) {
        console.error("Erro ao buscar usuário autenticado:", error);
        return res.status(500).json({ message: "Ocorreu um erro interno inesperado." });
    }

    if(!user || !user.isActivate){
        return res.status(401).json({message: "Acesso negado: Usuário não encontrado ou inativo."});
    }

    req.userId = payload.id;
    req.roleId = user.role.name;
    req.firstAccess = user.firstAccess;
    return next();
}
