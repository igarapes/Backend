import {prisma} from "../../config/db.js"

export class AuthRepository {
    async findUserByIdentifier(identifier: string) {
        const user = await prisma.user.findFirst({
            where: {
                OR: [{email:identifier}, {cpf:identifier}]
            },
            include: {
                role: true
            }
        });
        return user;
    }

    async findUserById(id: string) {
        const user = await prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                name: true,
                email: true,
                firstAccess: true,
                role: {
                    select: { name: true }
                }
            }
        });
        return user;
    }

    async updatePasswordFirstAccess(id: string, newPassword: string) {
        const userUptade = await prisma.user.update({
            where:{
                id:id
            },
            data: {
                password:newPassword,
                firstAccess:false,
                updatedById: id
            }
        });
        return userUptade;
    }
}