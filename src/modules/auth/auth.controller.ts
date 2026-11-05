import type { Request, Response } from "express";

import { AuthService } from "./auth.service.js";
import { AuditService } from "../../shared/audit.js";
import { identifierForAudit } from "../../shared/crypto.js";
import { UnauthorizedError } from "../../shared/errors.js";
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
                await auditService.register( "LOGIN_ATTEMPT", "SUCCESS", identifierForAudit(identifier), undefined, req.ip);
            } catch (auditError) {
                console.error("Erro ao registrar auditoria de login:", auditError);
            }
            res.cookie("token", token, { ...cookieOptions, maxAge: 24 * 60 * 60 * 1000 });
            res.status(200).json({ message: "Login realizado com sucesso", user });
        } catch (error: unknown) {
            // O catch existe só para auditar a falha; quem responde é o errorHandler
            if (error instanceof UnauthorizedError) {
                try {
                    await auditService.register( "LOGIN_ATTEMPT", "FAILED", identifierForAudit(identifier), undefined, req.ip );
                } catch (auditError) {
                    console.error("Erro ao registrar auditoria de login:",auditError);
                }
            }
            throw error;
        }
    }

    async me(req: AuthRequest, res: Response){
        const user = await authService.getMe(req.userId as string);
        return res.status(200).json(user);
    }

    logout(req: Request, res: Response){
        res.clearCookie("token", cookieOptions);
        return res.status(200).json({ message: "Logout realizado com sucesso" });
    }

    async updatePassword(req:AuthRequest, res:Response){
        const {newPassword} = req.body;
        // O middleware authenticated garante que o id existe
        const id = req.userId as string;

        await authService.updatePassword(id, newPassword);

        try {
            await auditService.register("PASSWORD_UPDATE", "SUCCESS", undefined, id, req.ip);
        } catch (auditError) {
            console.error("Erro ao registrar auditoria de troca de senha:", auditError);
        }
        return res.status(200).json({ message: "Senha atualizada com sucesso" });
    }
}