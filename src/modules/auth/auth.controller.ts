import type { Request, Response } from "express";

import { AuthService } from "./auth.service.js";
import { AuditService } from "../../shared/audit.js";
import type { AuthRequest } from "../../shared/middleware/authenticated.js";

const auditService = new AuditService();
const authService = new AuthService();

const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
};

export class AuthController{
    async login(req:Request, res:Response){
        const {identifier, password} = req.body;
        try {
            const { token, user } = await authService.makeLogin(identifier, password);
            try {
                await auditService.register( "LOGIN_ATTEMPT", "SUCCESS", identifier, undefined, req.ip);
            } catch (auditError) {
                console.error("Error ao regostrar auditoria de login:", auditError);
            }
            res.cookie("token", token, { ...cookieOptions, maxAge: 24 * 60 * 60 * 1000 });
            res.status(200).json({ message: "Login realizado com sucesso", user });
        } catch (error: unknown) {
            if(error instanceof Error){
                if (error.message === "Credenciais inválidas" ) {
                    try {
                        await auditService.register( "LOGIN_ATTEMPT", "FAILED", identifier, undefined, req.ip );
                    } catch (auditError) {
                        console.error("Erro ao registrar auditoria de login:",auditError);
                    }

                    return res.status(401).json({ message: "Credenciais inválidas", });
                }
                res.status(400).json({ message: error.message });
            }else{
                return res.status(500).json({ message: "Ocorreu um erro interno inesperado.", });
            } 
        }
    }

    async me(req: AuthRequest, res: Response){
        try {
            const user = await authService.getMe(req.userId as string);
            return res.status(200).json(user);
        } catch (error: unknown) {
            if (error instanceof Error && error.message === "Usuário não encontrado") {
                return res.status(404).json({ message: error.message });
            }
            return res.status(500).json({ message: "Ocorreu um erro interno inesperado." });
        }
    }

    async logout(req: Request, res: Response){
        res.clearCookie("token", cookieOptions);
        return res.status(200).json({ message: "Logout realizado com sucesso" });
    }

    async updatePassword(req:AuthRequest, res:Response){
        try {
            const {newPassword} = req.body;
            const id = req.userId;
            if (!id) {
                await auditService.register("PASSWORD_UPDATE", "FAILED", undefined, undefined, req.ip);
                res.status(401).json({ message: "Acesso negado: ID não encontrado no token" });
                return;
            }
            await authService.updatePassword(id, newPassword);
        
            try {
                await auditService.register("PASSWORD_UPDATE", "SUCCESS", undefined, id, req.ip);
            } catch (auditError) {
                console.error("Error ao regostrar auditoria de login:", auditError);
            }
            res.status(200).json({ message: "Senha atualizada com sucesso" });
        } catch (error: unknown) {
            if (error instanceof Error) {
                res.status(400).json({ message: error.message });
            } else {
                res.status(500).json({ message: "Ocorreu um erro interno inesperado." });
            }
        }
    }
}