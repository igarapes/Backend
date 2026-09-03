import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

import { AuthRepository } from "./auth.repository";

const authRepository = new AuthRepository();
export class AuthService{
    async makeLogin(identifier: string, password: string){
        const user = await authRepository.findUserByIdentifier(identifier);
        if(!user){
            throw new Error("Credenciais inválidas")
        }

        const comparePassword = await bcrypt.compare(password, user.password);

        if(!comparePassword){
            throw new Error("Credenciais inválidas")
        }
        const secret = process.env.AUTH_TOKEN;

        if (!secret) {
            throw new Error(
                "AUTH_TOKEN não configurado"
            );
        }


        return jwt.sign({ id: user.id, role: user.role.name }, secret, { expiresIn: "1d" })
    }

    async updatePassword(id: string, newPassword:string){
        const hashPassword = await bcrypt.hash(newPassword, 10);
        await authRepository.updatePasswordFirstAccess(id, hashPassword);
    }
}