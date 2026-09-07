import { Prisma } from "@prisma/client";
import crypto from "crypto";

import { prisma } from "../../config/db";
import type { CreateUserDTO, UpdateUserDTO } from "./user.schema";

export class UserRepository {
    async createUser(userObj: CreateUserDTO, id: string, role: string, password: string, hashedCpf: string) {
        const roleData = await prisma.role.findFirst({
            where: { name: role }
        });

        if (!roleData) {
            throw new Error("Perfil não encontrado no banco de dados.");
        }

        try {
            const newUser = await prisma.user.create({
                data: {
                    name: userObj.name,
                    phone: userObj.phone,
                    email: userObj.email,
                    password: password,
                    cpf: hashedCpf, 
                    firstAccess: true,
                    createdById: id,
                    roleId: roleData.id
                }
            });

            return {
                ...newUser,
                cpf: "***.***.***-**" 
            };

        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError) {
                if (error.code === 'P2002') {
                    throw new Error("Os dados informados (E-mail ou CPF) já estão em uso.", {cause: error});
                }
            }
            throw error; 
        }
    }

    async deleteUser(id: string) {
        const deleteUser = await prisma.user.delete({
            where: { id: id }
        });
        return deleteUser;
    }

    async getUserById(id: string){
        const user = await prisma.user.findUnique({
            where:{id}, 
            include:{role:true}
        });
        return user;
    }

    async updateUser(id: string, userObj: UpdateUserDTO, updateById: string){
    
        try {
            const updateUser = await prisma.user.update({
            where: { id: id },
                data:{
                    ...(userObj.name && { name: userObj.name }),
                    ...(userObj.phone && { phone: userObj.phone }),
                    ...(userObj.email && { email: userObj.email }),
                    ...(userObj.password && { password: userObj.password }),
                    updatedById: updateById,
                }
            });

            return {
                ...updateUser,
                cpf: "***.***.***-**" 
            };
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError) {
                if (error.code === 'P2002') {
                    throw new Error("Os dados informados (E-mail ou CPF) já estão em uso.", {cause: error});
                }
            }
            throw error; 
        }

    }

    async inactivateUser(id: string, updaterID: string){
        const user = await prisma.user.update({
            where:{id},
            data:{
                isActivate: false,
                updatedById: updaterID
            }
        });

        return {
            ...user,
            cpf: "***.***.***-**"
        };
    }

    async anonymizeUser(id: string) {
        const uniqueSuffix = crypto.randomBytes(4).toString("hex"); 

        const anonymizedUser = await prisma.user.update({
            where: { id: id },
            data: {
                name: "Usuário Excluído",
                email: `excluido_${uniqueSuffix}@anonymize.com.br`,
                phone: `DEL${uniqueSuffix}`,
                cpf: `DEL${uniqueSuffix}`,
                password: "dados_anonimizados", 
                isActivate: false
            }
        });

        return {
            ...anonymizedUser,
            cpf: "***.***.***-**"
        };
    }

    async listUsers(requesterRole: string) {
        const whereClause: Prisma.UserWhereInput = {};

        if (requesterRole === "TECNICO") {
            whereClause.role = {
                is: {
                    name: "USUARIO"
                }
            };
        }

        const users = await prisma.user.findMany({
            where: whereClause,
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                cpf: true,
                isActivate: true,
                firstAccess: true,
                createdAt: true,
                role: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            },
            orderBy: {
                createdAt: "desc" 
            }
        });

        return users.map(user => ({
            ...user,
            cpf: "***.***.***-**"
        }));
    }
}