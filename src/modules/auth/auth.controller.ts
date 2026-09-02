import type { Request, Response } from "express";

import { AuthService } from "./auth.service";
import { AuditService } from "../../shared/audit";

const auditService = new AuditService();

export interface AuthRequest extends Request {
    userId?: string;
}

const authService = new AuthService();
export class AuthController{
    async login(req:Request, res:Response){
        try {
            const {identifier, password} = req.body;
            const tokenValue = await authService.madeLogin(identifier, password);
            await auditService.register("LOGIN_ATTEMPT", "SUCCESS", identifier, undefined, req.ip);
            res.cookie("token", tokenValue, {httpOnly: true, secure: true});
            res.status(200).json({message: "Login realizado com sucesso"})
        } catch (error: unknown) {
            if (error instanceof Error) {
                if (error.message === "Credenciais inválidas") {
                    await auditService.register("LOGIN_ATTEMPT", "FAILED", req.body.identifier, undefined, req.ip);
                    res.status(401).json({ message: error.message });
                    return; 
                }
                
                res.status(400).json({ message: error.message });
            } else {
                res.status(500).json({ message: "Ocorreu um erro interno inesperado." });
            }
        }
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
            await auditService.register("PASSWORD_UPDATE", "SUCCESS", undefined, id, req.ip);
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