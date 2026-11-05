import bcrypt from "bcrypt";

import { prisma } from "../../src/config/db";
import { hashCpf } from "../../src/shared/crypto";

const ROLES = ["ADMIN", "TECNICO", "USUARIO"] as const;
type RoleName = (typeof ROLES)[number];

export async function ensureRoles() {
    for (const name of ROLES) {
        const existing = await prisma.role.findFirst({ where: { name } });
        if (!existing) {
            await prisma.role.create({ data: { name } });
        }
    }
}

// Deixa o banco de teste vazio (mantendo as roles), para cada arquivo começar do zero
export async function resetDatabase() {
    await prisma.auditLog.deleteMany();
    await prisma.user.deleteMany();
    await ensureRoles();
}

type TestUserData = {
    name: string;
    email: string;
    phone: string;
    cpf: string;
    password: string;
    role: RoleName;
    firstAccess?: boolean;
    isActivate?: boolean;
};

export async function createTestUser(data: TestUserData) {
    const role = await prisma.role.findFirst({ where: { name: data.role } });

    return prisma.user.create({
        data: {
            name: data.name,
            email: data.email,
            phone: data.phone,
            cpf: hashCpf(data.cpf),
            password: await bcrypt.hash(data.password, 10),
            firstAccess: data.firstAccess ?? false,
            isActivate: data.isActivate ?? true,
            roleId: role!.id,
        },
    });
}
