import type { Response } from "express";

import { UserService } from "./user.service.js";
import type { AuthRequest } from "../../shared/middleware/authenticated.js";
import type { ListUsersQuery } from "./user.schema.js";

const userService = new UserService();

// Os erros lançados aqui são respondidos pelo errorHandler (o Express 5 repassa os erros de funções async)
export class UserController {
    async createUser(req: AuthRequest, res: Response) {
        const userData = req.body;
        const creatorId = req.userId as string;
        const creatorRole = req.roleId as string;
        const ip = req.ip as string;

        const response = await userService.createUser(userData, creatorId, creatorRole, ip);
        return res.status(201).json(response);
    }

    async updateUser(req: AuthRequest, res: Response){
        const idTarget = req.params.id as string;
        const userData = req.body;
        const UpdaterId = req.userId as string;
        const UpdaterRole = req.roleId as string;
        const ip = req.ip as string;

        const response = await userService.updateUser(idTarget, userData, UpdaterId, UpdaterRole, ip);
        return res.status(200).json(response);
    }

    async inactivateUser(req: AuthRequest, res: Response){
        const UpdaterId = req.userId as string;
        const UpdaterRole = req.roleId as string;
        const idTarget = req.params.id as string;
        const ip = req.ip as string;

        const response = await userService.inactivateUser(idTarget, UpdaterId, UpdaterRole, ip);
        return res.status(200).json(response);
    }

    async anonymizeUser(req:AuthRequest, res: Response){
        const UpdaterId = req.userId as string;
        const idTarget = req.params.id as string;
        const ip = req.ip as string;

        const response = await userService.anonymizeUser(idTarget, UpdaterId, ip);
        return res.status(200).json(response);
    }

    async getUserById(req: AuthRequest, res: Response){
        const idTarget = req.params.id as string;
        const requesterId = req.userId as string;
        const requesterRole = req.roleId as string;

        const response = await userService.getUserById(idTarget, requesterId, requesterRole);
        return res.status(200).json(response);
    }

    async listUsers(req:AuthRequest, res: Response){
        const requesterId = req.userId as string;
        const requesterRole = req.roleId as string;
        const ip = req.ip as string;
        // Já validado e convertido para número pelo validateData(schemaListQuery, "query")
        const { page, limit } = req.query as unknown as ListUsersQuery;

        const response = await userService.listUsers(requesterRole, requesterId, ip, page, limit);
        return res.status(200).json(response);
    }
}
