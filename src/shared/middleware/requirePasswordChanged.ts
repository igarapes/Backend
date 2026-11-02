import type { Response, NextFunction } from "express";

import type { AuthRequest } from "./authenticated.js";

export function requirePasswordChanged(req: AuthRequest, res: Response, next: NextFunction) {
    if (req.firstAccess) {
        return res.status(403).json({ message: "Troque sua senha provisória para continuar." });
    }
    return next();
}
