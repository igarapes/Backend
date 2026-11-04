import bcrypt from "bcrypt";

import { UserRepository } from "./user.repository.js";
import { sendTemporaryPasswordEmail } from "../../shared/email.js";
import { AuditService } from "../../shared/audit.js";
import type { CreateUserDTO, UpdateUserDTO } from "./user.schema.js";
import { hashCpf } from "../../shared/crypto.js";
import { generateCompliantPassword } from "../../shared/generatePassword.js";
import { isPasswordPwned, PWNED_PASSWORD_MESSAGE } from "../../shared/pwnedPassword.js";
import { AppError, ForbiddenError, NotFoundError } from "../../shared/errors.js";

const userRepository = new UserRepository();
const auditService = new AuditService();

export class UserService { 
    async createUser(userObj: CreateUserDTO, idCreator: string, creatorRole: string, ip: string) {
        
        if (creatorRole === "TECNICO" && userObj.role !== "USUARIO") {
            throw new ForbiddenError("Acesso negado: Técnicos podem cadastrar apenas Usuários comuns.");
        }

        const randomPassword = generateCompliantPassword();
        const hashedPassword = await bcrypt.hash(randomPassword, 10);
        const hashedCpf = hashCpf(userObj.cpf);

        let createdUser;
        try {
            createdUser = await userRepository.createUser(userObj, idCreator, userObj.role, hashedPassword, hashedCpf);
        } catch (dbError: unknown) {
            await auditService.register("USER_CREATION", "FAILED_DB_CONSTRAINT", userObj.email, idCreator, ip);
            throw dbError;
        }

        try {
            await sendTemporaryPasswordEmail(userObj.email, userObj.name, randomPassword);
            await auditService.register("USER_CREATION", "SUCCESS", userObj.email, idCreator, ip);
            
        } catch {
            // O detalhe do erro de SMTP já é registrado no log pelo sendTemporaryPasswordEmail
            await userRepository.deleteUser(createdUser.id);
            await auditService.register("USER_CREATION", "FAILED_EMAIL_ROLLBACK", userObj.email, idCreator, ip);
            // 503: o serviço de e-mail está indisponível, não é um erro nos dados enviados
            throw new AppError("Não foi possível enviar o email de acesso. O cadastro foi cancelado, tente novamente.", 503);
        }

        return createdUser;
    }

    async updateUser(idTarget: string, userObj: UpdateUserDTO, idUpdater: string, updaterRole: string, ip: string){
        const targetUser = await userRepository.getUserById(idTarget);
        if(!targetUser){
            throw new NotFoundError();
        }
        
        if(updaterRole === "USUARIO" && idUpdater !== targetUser.id){
            throw new ForbiddenError("Acesso negado: Usuários não podem atualizar outros perfis.");
        }

        if(updaterRole === "TECNICO"){
            const targetRole = targetUser.role.name;
            if (idUpdater !== idTarget && (targetRole === "ADMIN" || targetRole === "TECNICO")) {
                throw new ForbiddenError("Acesso negado: Técnicos não podem alterar dados de Administradores ou de outros Técnicos.");
            }
        }

        if (userObj.role && userObj.role !== targetUser.role.name) {
            if (updaterRole !== "ADMIN") {
                throw new ForbiddenError("Acesso negado: Apenas administradores podem alterar o perfil de acesso.");
            }
            if (idUpdater === idTarget) {
                throw new ForbiddenError("Acesso negado: Administradores não podem alterar o próprio perfil de acesso.");
            }
        }

        if(userObj.password){
            if (await isPasswordPwned(userObj.password)) {
                throw new AppError(PWNED_PASSWORD_MESSAGE);
            }
            userObj.password = await bcrypt.hash(userObj.password, 10);
        }

        let updateUser
        try {
            updateUser = await userRepository.updateUser(idTarget, userObj, idUpdater);
            await auditService.register("USER_UPDATE", "SUCCESS", userObj.email, idUpdater, ip);
            return updateUser;
        } catch (error: unknown) {
            await auditService.register("USER_UPDATE", "FAILED_DB_CONSTRAINT", userObj.email, idUpdater, ip);
            throw error;
        }

    }

    async inactivateUser(idTarget: string, idUpdater: string, roleUpdater:string, ip: string){
        const targetUser = await userRepository.getUserById(idTarget);
        if(!targetUser){
            throw new NotFoundError();
        }

        if(roleUpdater === "USUARIO"){
            throw new ForbiddenError("Acesso negado: Usuários não podem inativar perfis.");
        }

        if(idTarget === idUpdater){
            throw new ForbiddenError("Acesso negado: Não pode inativar o próprio perfil.");
        }

        if(roleUpdater === "TECNICO" && (targetUser.role.name === "ADMIN" || targetUser.role.name === "TECNICO")){
            throw new ForbiddenError("Acesso negado: Técnicos não podem alterar dados de Administradores ou de outros Técnicos.");
        }

        try {
            const inactivateUser = await userRepository.inactivateUser(idTarget, idUpdater);
            await auditService.register("USER_INACTIVATE", "SUCCESS", targetUser.email, idUpdater, ip);
            return inactivateUser;
        } catch (error) {
            await auditService.register("USER_INACTIVATE", "FAILED_DB_CONSTRAINT", idTarget, idUpdater, ip);
            throw error;
        }
    }

    async anonymizeUser(idTarget: string, idDeleter: string, ip: string){
        if(idTarget !== idDeleter){
            throw new ForbiddenError("Acesso negado: apenas o dono da conta pode deletar ela.");
        }

        const userTarget = await userRepository.getUserById(idTarget);
        if(!userTarget){
            throw new NotFoundError();
        }
        if(userTarget.role.name === "ADMIN"){
            throw new ForbiddenError("Acesso negado: O admin não pode deletar a sua conta.");
        }

        try {
            const deleteUser = await userRepository.anonymizeUser(idTarget);
            await auditService.register("USER_DELETE", "SUCCESS", userTarget.email, idTarget, ip);
            return deleteUser
        } catch (error) {
            await auditService.register("USER_DELETE", "FAILED_DB_CONSTRAINT", userTarget.email, idTarget, ip);
            throw error;
        }
    }

    async getUserById(idTarget: string, requesterId: string, requesterRole: string){
        const user = await userRepository.getUserDetails(idTarget);
        if(!user){
            throw new NotFoundError();
        }

        const isSelf = idTarget === requesterId;

        if(requesterRole === "USUARIO" && !isSelf){
            throw new ForbiddenError("Acesso negado: Usuários só podem visualizar o próprio perfil.");
        }

        if(requesterRole === "TECNICO" && !isSelf && user.role.name !== "USUARIO"){
            throw new ForbiddenError("Acesso negado: Técnicos só podem visualizar o próprio perfil e Usuários comuns.");
        }

        return user;
    }

    async listUsers(requesterRole: string, requesterId: string, ip: string, page: number, limit: number){
        if(requesterRole === "USUARIO"){
            throw new ForbiddenError("Acesso negado: usuário não pode listar usuários.")
        }

        try {
            const listUsers = await userRepository.listUsers(requesterRole, page, limit);
            await auditService.register("LIST_USERS", "SUCCESS", requesterId, requesterId, ip);
            return listUsers;
        } catch (error) {
            await auditService.register("LIST_USERS", "FAILED_DB_CONSTRAINT", requesterId, requesterId, ip);
            throw error;
        }
    }
}