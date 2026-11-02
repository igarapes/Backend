import bcrypt from "bcrypt";
import crypto from "crypto"; 

import { UserRepository } from "./user.repository";
import { sendTemporaryPasswordEmail } from "../../shared/email";
import { AuditService } from "../../shared/audit";
import type { CreateUserDTO, UpdateUserDTO } from "./user.schema";

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

    async updateUser(idTarget: string, userObj: UpdateUserDTO, idUpdater: string, updaterRole: string, ip: string){
        const targetUser = await userRepository.getUserById(idTarget);
        if(!targetUser){
            throw new Error("Usuário não encontrado");
        }
        
        if(updaterRole === "USUARIO" && idUpdater !== targetUser.id){
            throw new Error("Acesso negado: Usuários não podem atualizar outros perfis.");
        }

        if(updaterRole === "TECNICO"){
            const targetRole = targetUser.role.name;
            if (idUpdater !== idTarget && (targetRole === "ADMIN" || targetRole === "TECNICO")) {
                throw new Error("Acesso negado: Técnicos não podem alterar dados de Administradores ou de outros Técnicos.");
            }

            if (userObj.role === "ADMIN") {
                throw new Error("Acesso negado: Apenas administradores podem conceder o perfil de ADMIN.");
            }
        }

        if(userObj.password){
            userObj.password = await bcrypt.hash(userObj.password, 10);
        }

        let updateUser
        try {
            updateUser = await userRepository.updateUser(idTarget, userObj, idUpdater);
            await auditService.register("USER_UPDATE", "SUCCESS", userObj.email, idUpdater, ip);
            return updateUser;
        } catch (error: unknown) {
            await auditService.register("USER_UPDATE", "FAILED_DB_CONSTRAINT", userObj.email, idUpdater, ip);
            
            if (error instanceof Error) {
                throw new Error(error.message, { cause: error }); 
            }
            
            throw new Error("Erro desconhecido ao tentar salvar no banco de dados.", { cause: error });
        }

    }

    async inactivateUser(idTarget: string, idUpdater: string, roleUpdater:string, ip: string){
        const targetUser = await userRepository.getUserById(idTarget);
        if(!targetUser){
            throw new Error("Usuário não encontrado");
        }

        if(roleUpdater === "USUARIO"){
            throw new Error("Acesso negado: Usuários não podem inativar perfis.");
        }

        if(idTarget === idUpdater){
            throw new Error("Acesso negado: Não pode inativar o próprio perfil.");
        }

        if(roleUpdater === "TECNICO" && (targetUser.role.name === "ADMIN" || targetUser.role.name === "TECNICO")){
            throw new Error("Acesso negado: Técnicos não podem alterar dados de Administradores ou de outros Técnicos.");
        }

        try {
            const inactivateUser = await userRepository.inactivateUser(idTarget, idUpdater);
            await auditService.register("USER_INACTIVATE", "SUCCESS", targetUser.email, idUpdater, ip);
            return inactivateUser;
        } catch (error) {
            await auditService.register("USER_INACTIVATE", "FAILED_DB_CONSTRAINT", idTarget, idUpdater, ip);
            
            if (error instanceof Error) {
                throw new Error(error.message, { cause: error }); 
            }
            
            throw new Error("Erro desconhecido ao tentar salvar no banco de dados.", { cause: error });
        }
    }

    async anonymizeUser(idTarget: string, idDeleter: string, ip: string){
        if(idTarget !== idDeleter){
            throw new Error("Acesso negado: apenas o dono da conta pode deletar ela.");
        }

        const userTarget = await userRepository.getUserById(idTarget);
        if(!userTarget){
            throw new Error("Usuário não encontrado");
        }
        if(userTarget.role.name === "ADMIN"){
            throw new Error("O admin não pode deletar a sua conta");
        }

        try {
            const deleteUser = await userRepository.anonymizeUser(idTarget);
            await auditService.register("USER_DELETE", "SUCCESS", userTarget.email, idTarget, ip);
            return deleteUser
        } catch (error) {
            await auditService.register("USER_DELETE", "FAILED_DB_CONSTRAINT", userTarget.email, idTarget, ip);
            
            if (error instanceof Error) {
                throw new Error(error.message, { cause: error }); 
            }
            
            throw new Error("Erro desconhecido ao tentar salvar no banco de dados.", { cause: error });
        }
    }

    async listUsers(requesterRole: string, requesterId: string, ip: string){
        if(requesterRole === "USUARIO"){
            throw new Error("Acesso negado: usuário não pode listar usuários.")
        }

        try {
            const listUsers = await userRepository.listUsers(requesterRole);
            await auditService.register("LIST_USERS", "SUCCESS", requesterId, requesterId, ip);
            return listUsers;
        } catch (error) {
            await auditService.register("LIST_USERS", "FAILED_DB_CONSTRAINT", requesterId, requesterId, ip);
            
            if (error instanceof Error) {
                throw new Error(error.message, { cause: error }); 
            }
            
            throw new Error("Erro desconhecido ao tentar buscar os usuários no banco de dados.", { cause: error });
        }
    }
}