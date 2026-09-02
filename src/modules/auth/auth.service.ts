import { AuthRepository } from "./auth.repository";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const authRepository = new AuthRepository();
export class AuthService{
    async madeLogin(identifier: string, password: string){
        const user = await authRepository.findUserByIdentifier(identifier);
        if(!user){
            throw new Error("Credenciais inválidas")
        }

        const comparePassword = await bcrypt.compare(password, user.password);

        if(!comparePassword){
            throw new Error("Credenciais inválidas")
        }

        return jwt.sign({ id: user.id, role: user.role.name }, process.env.AUTH_TOKEN as string, { expiresIn: "1d" })
    }

    async updatePassword(id: string, newPassword:string){
        const hashPassword = await bcrypt.hash(newPassword, 10);
        await authRepository.updatePasswordFirstAccess(id, hashPassword);
    }
}