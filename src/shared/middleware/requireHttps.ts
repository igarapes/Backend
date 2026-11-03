import type { Request, Response, NextFunction } from "express";

export function requireHttps(req: Request, res: Response, next: NextFunction) {
    if (req.secure) {
        return next();
    }
    return res.redirect(308, `https://${req.headers.host}${req.originalUrl}`);
}
