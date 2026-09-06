import bcrypt from "bcrypt";
import crypto from "crypto"; 

import { UserRepository } from "./user.repository";
import { sendTemporaryPasswordEmail } from "../../shared/email";
import { AuditService } from "../../shared/audit";
import type { CreateUserDTO } from "./user.schema";

const userRepository = new UserRepository();
const auditService = new AuditService();

function generateCompliantPassword(): string {
    const randomHex = crypto.randomBytes(3).toString("hex"); 
    return `Aa23${randomHex}1@`; 
}

function hashSensitiveData(data: string): string {
    const salt = process.env.DATA_SALT || "chave_secreta_padrao";
    return crypto.createHash("sha256").update(data + salt).digest("hex");
}

export class UserService { 
    async createUser(userObj: CreateUserDTO, idCreator: string, creatorRole: string, ip: string) {
        
        if (creatorRole === "TECNICO" && userObj.role !== "USUARIO") {
            throw new Error("Acesso negado: Técnicos podem cadastrar apenas Usuários comuns.");
        }

        const randomPassword = generateCompliantPassword();
        const hashedPassword = await bcrypt.hash(randomPassword, 10);
        const hashedCpf = hashSensitiveData(userObj.cpf);

        let createdUser;
        try {
            createdUser = await userRepository.createUser(userObj, idCreator, userObj.role, hashedPassword, hashedCpf);
        } catch (dbError: unknown) {
            await auditService.register("USER_CREATION", "FAILED_DB_CONSTRAINT", userObj.email, idCreator, ip);
            
            if (dbError instanceof Error) {
                throw new Error(dbError.message, { cause: dbError }); 
            }
            
            throw new Error("Erro desconhecido ao tentar salvar no banco de dados.", { cause: dbError });
        }

        try {
            await sendTemporaryPasswordEmail(userObj.email, userObj.name, randomPassword);
            await auditService.register("USER_CREATION", "SUCCESS", userObj.email, idCreator, ip);
            
        } catch (error: unknown) {
            await userRepository.deleteUser(createdUser.id);
            await auditService.register("USER_CREATION", "FAILED_EMAIL_ROLLBACK", userObj.email, idCreator, ip);
            throw new Error("Não foi possível enviar o email de acesso. O cadastro foi cancelado, tente novamente.", { cause: error });
        }

        return createdUser;
    }
}