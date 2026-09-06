import { prisma } from "../../config/db";
import { Prisma } from "@prisma/client";
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

    async getAllUserAdmin(){
        const users = await prisma.user.findMany({
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                cpf: true,
                role: true,
                firstAccess: true
            }
        });
        return users;
    }

    async getAllUserTecnico(){
        const users = await prisma.user.findMany({
            where:{
                role: {
                    name: "USUARIO" 
                }
            },
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                cpf: true,
                role: true,
                firstAccess: true
            }
        });
        return users;
    }

    async updateUser(id: string, userObj: UpdateUserDTO, updateById: string){
        const updateUser = await prisma.user.update({
            where: { id: id },
            data:{
                ...(userObj.name && { name: userObj.name }),
                ...(userObj.phone && { phone: userObj.phone }),
                ...(userObj.email && { email: userObj.email }),
                ...(userObj.password && { password: userObj.password }),
                createdById: updateById,
            }
        });

        return updateUser;
    }
}