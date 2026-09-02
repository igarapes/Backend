import { prisma } from "../config/db";

export class AuditService {
    async register(
        action: string, 
        status: string, 
        targetEmail?: string, 
        userId?: string, 
        ipAddress?: string
    ) {
        await prisma.auditLog.create({
            data: {
                action,
                status,
                targetEmail: targetEmail || null,
                userId: userId || null,
                ipAddress: ipAddress || "IP desconhecido"
            }
        });
    }
}