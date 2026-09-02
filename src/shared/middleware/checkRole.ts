import type { Response, NextFunction } from "express";
import type { AuthRequest } from "./authenticated";

export function checkRole(allowedRoles: string[]) {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        const userRole = req.roleId;
        if(!userRole){
            return res.status(403).json({
                message: "Acesso negado: Perfil de usuário não identificado."
            })
        }

        if(!allowedRoles.includes(userRole)){
            return res.status(403).json({
                message: "Acesso negado: Você não tem permissão para realizar esta ação."
            })
        }

        return next();
    }
}