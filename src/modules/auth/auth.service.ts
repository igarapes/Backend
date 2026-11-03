import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

import { AuthRepository } from "./auth.repository.js";
import { hashCpf } from "../../shared/crypto.js";
import { isPasswordPwned, PWNED_PASSWORD_MESSAGE } from "../../shared/pwnedPassword.js";
import {isValidCPF} from "../user/user.schema.js"

const authRepository = new AuthRepository();

export class AuthService {
    async makeLogin(identifier: string, password: string) {
        if(isValidCPF(identifier)){
            identifier = hashCpf(identifier)
        }
        
        const user = await authRepository.findUserByIdentifier(identifier);
        
        if (!user) {
            throw new Error("Credenciais inválidas");
        }

        const comparePassword = await bcrypt.compare(password, user.password);

        if (!comparePassword) {
            throw new Error("Credenciais inválidas");
        }

        if(!user.isActivate) throw new Error("Credenciais inválidas")
        
        const secret = process.env.AUTH_TOKEN;

        if (!secret) {
            throw new Error("AUTH_TOKEN não configurado");
        }

        const token = jwt.sign(
            { 
                id: user.id,
                role: user.role.name,
                primeiro_acesso: user.firstAccess
            }, 
            secret, 
            { expiresIn: "1d" },
        );

        return {
            token,
            user: {
                id: user.id,
                name: user.name,
                role: user.role.name,
                firstAccess: user.firstAccess
            }
        };
    }

    async getMe(id: string) {
        const user = await authRepository.findUserById(id);

        if (!user) {
            throw new Error("Usuário não encontrado");
        }

        return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role.name,
            firstAccess: user.firstAccess
        };
    }

    async updatePassword(id: string, newPassword: string) {
        if (await isPasswordPwned(newPassword)) {
            throw new Error(PWNED_PASSWORD_MESSAGE);
        }

        const hashPassword = await bcrypt.hash(newPassword, 10);
        await authRepository.updatePasswordFirstAccess(id, hashPassword);
    }
}