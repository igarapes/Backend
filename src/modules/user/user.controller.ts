import type { Response } from "express";
import { UserService } from "./user.service";
import type { AuthRequest } from "../../shared/middleware/authenticated";

const userService = new UserService();

export class UserController {
    async createUser(req: AuthRequest, res: Response) {
        const userData = req.body; 
        const creatorId = req.userId as string; 
        const creatorRole = req.roleId as string; 
        const ip = req.ip as string;

        try {
            const response = await userService.createUser(userData, creatorId, creatorRole, ip);
            return res.status(201).json(response);
        } catch (error) {
            if (error instanceof Error) {
                return res.status(400).json({ message: error.message });
            }
            return res.status(500).json({ message: "Ocorreu um erro interno inesperado." });
        }
    }
}