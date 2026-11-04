import type { Response } from "express";

import { UserService } from "./user.service.js";
import type { AuthRequest } from "../../shared/middleware/authenticated.js";
import type { ListUsersQuery } from "./user.schema.js";

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

    async updateUser(req: AuthRequest, res: Response){
        const idTarget = req.params.id as string;
        const userData = req.body; 
        const UpdaterId = req.userId as string; 
        const UpdaterRole = req.roleId as string; 
        const ip = req.ip as string;

        try {
            const response = await userService.updateUser(idTarget, userData, UpdaterId, UpdaterRole, ip);
            return res.status(200).json(response);
        } catch (error) {
            if (error instanceof Error) {
                if (error.message.includes("Acesso negado")) {
                    return res.status(403).json({ message: error.message });
                }
                return res.status(400).json({ message: error.message });
            }
            return res.status(500).json({ message: "Ocorreu um erro interno inesperado." });
        }
    }

    async inactivateUser(req: AuthRequest, res: Response){
        const UpdaterId = req.userId as string; 
        const UpdaterRole = req.roleId as string; 
        const idTarget = req.params.id as string;
        const ip = req.ip as string;

        try {
            const response = await userService.inactivateUser(idTarget, UpdaterId, UpdaterRole, ip);
            return res.status(200).json(response);
        } catch (error) {
            if (error instanceof Error) {
                if (error.message.includes("Acesso negado")) {
                    return res.status(403).json({ message: error.message });
                }
                return res.status(400).json({ message: error.message });
            }
            return res.status(500).json({ message: "Ocorreu um erro interno inesperado." });
        }
    }

    async anonymizeUser(req:AuthRequest, res: Response){
        const UpdaterId = req.userId as string;
        const idTarget = req.params.id as string;
        const ip = req.ip as string;

        try {
            const response = await userService.anonymizeUser(idTarget, UpdaterId, ip);
            return res.status(200).json(response);
        } catch (error) {
            if (error instanceof Error) {
                if (error.message.includes("Acesso negado")) {
                    return res.status(403).json({ message: error.message });
                }
                return res.status(400).json({ message: error.message });
            }
            return res.status(500).json({ message: "Ocorreu um erro interno inesperado." });
        }
    }

    async getUserById(req: AuthRequest, res: Response){
        const idTarget = req.params.id as string;
        const requesterId = req.userId as string;
        const requesterRole = req.roleId as string;

        try {
            const response = await userService.getUserById(idTarget, requesterId, requesterRole);
            return res.status(200).json(response);
        } catch (error) {
            if (error instanceof Error) {
                if (error.message.includes("Acesso negado")) {
                    return res.status(403).json({ message: error.message });
                }
                if (error.message === "Usuário não encontrado") {
                    return res.status(404).json({ message: error.message });
                }
                return res.status(400).json({ message: error.message });
            }
            return res.status(500).json({ message: "Ocorreu um erro interno inesperado." });
        }
    }

    async listUsers(req:AuthRequest, res: Response){
        const requesterId = req.userId as string;
        const requesterRole = req.roleId as string;
        const ip = req.ip as string;
        // Já validado e convertido para número pelo validateData(schemaListQuery, "query")
        const { page, limit } = req.query as unknown as ListUsersQuery;

        try {
            const response = await userService.listUsers(requesterRole, requesterId, ip, page, limit);
            return res.status(200).json(response);
        } catch (error) {
            if (error instanceof Error) {
                if (error.message.includes("Acesso negado")) {
                    return res.status(403).json({ message: error.message });
                }
                return res.status(400).json({ message: error.message });
            }
            return res.status(500).json({ message: "Ocorreu um erro interno inesperado." });
        }
    }
}