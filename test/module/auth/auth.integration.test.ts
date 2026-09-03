import request from "supertest";
import { execSync } from "child_process";
import jwt from "jsonwebtoken";

import { server } from "../../../src/server";
import { AuthService } from "../../../src/modules/auth/auth.service";
import { AuditService } from "../../../src/shared/audit";
import { desconectarBancoDeDados, prisma } from "../../../src/config/db";

describe("Teste de integração: /api/auth/login", () => {
    beforeAll(() => {
        execSync("npx tsx prisma/seed.ts");
    });
    afterAll(async () => {
        await desconectarBancoDeDados();
    });
    
    it("Deve realizar o login com sucesso", async () => {
        const response = await request(server)
            .post("/api/auth/login")
            .send({
                identifier: "admin@igarape.com.br",
                password: "Admin123!"
            });
        
        expect(response.status).toBe(200);
        expect(response.header["set-cookie"]).toBeDefined();
        expect(response.headers["set-cookie"][0]).toMatch(/token=/);
    });

    it("Deve retornar 401 com mensagem genérica, quando o email não existe", async () => {
        const response = await request(server)
            .post("/api/auth/login")
            .send({
                identifier: "teste@teste.com.br",
                password: "Teste123!"
            });

        expect(response.status).toBe(401);
        expect(response.body.message).toBe("Credenciais inválidas");
    });

    it("Deve retornar 401 com mensagem genérica, quando a senha está errada", async () => {
        const response = await request(server)
            .post("/api/auth/login")
            .send({
                identifier: "admin@igarape.com.br",
                password: "Teste123!"
            });

        expect(response.status).toBe(401);
        expect(response.body.message).toBe("Credenciais inválidas");
    });

    it("Deve retornar 400 com mensagem genérica, quando os dados enviados estão no formato errado", async () => {
        const response = await request(server)
            .post("/api/auth/login")
            .send({
                identifier: "admin",
                password: "Teste123!"
            });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("Erro de validação nos dados enviados");
    });

    it("O token JWT gerado deve conter o ID e a Role do usuário", async () => {
        const response = await request(server)
            .post("/api/auth/login")
            .send({
                identifier: "admin@igarape.com.br",
                password: "Admin123!"
            });
        
        const cookie = response.headers["set-cookie"][0];
        const tokenValue = cookie.split(";")[0].replace("token=", "");
        const secret = process.env.AUTH_TOKEN;

        expect(secret).toBeDefined();

        const decoded = jwt.verify(tokenValue,secret!) as jwt.JwtPayload;

        expect(decoded).toHaveProperty("id");
        expect(decoded).toHaveProperty("role");
        expect(decoded.role).toBe("admin");
    });


    it("Deve retornar 400 se ocorrer um erro instanciado (Error) genérico no login", async () => {
        const spy = jest.spyOn(AuthService.prototype, 'makeLogin').mockRejectedValueOnce(new Error("Erro simulado no banco"));
        
        const response = await request(server)
            .post("/api/auth/login")
            .send({
                identifier: "admin@igarape.com.br",
                password: "Admin123!"
            });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("Erro simulado no banco");
        
        spy.mockRestore(); 
    });

    it("Deve retornar 500 se ocorrer um erro não instanciado no login", async () => {
        const spy = jest.spyOn(AuthService.prototype, 'makeLogin').mockRejectedValueOnce("Um erro em formato de string");
        
        const response = await request(server)
            .post("/api/auth/login")
            .send({
                identifier: "admin@igarape.com.br",
                password: "Admin123!"
            });

        expect(response.status).toBe(500);
        expect(response.body.message).toBe("Ocorreu um erro interno inesperado.");
        
        spy.mockRestore();
    });

    it("Deve concluir o login com sucesso mesmo se o AuditService lançar um erro", async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const auditSpy = jest.spyOn(AuditService.prototype, 'register').mockRejectedValueOnce(new Error("Erro de auditoria simulado"));
        
        const response = await request(server)
            .post("/api/auth/login")
            .send({
                identifier: "admin@igarape.com.br",
                password: "Admin123!"
            });
        
        expect(response.status).toBe(200);
        expect(consoleSpy).toHaveBeenCalled();
        
        consoleSpy.mockRestore();
        auditSpy.mockRestore();
    });

    it("Deve retornar 401 e logar erro se a auditoria falhar ao registrar credenciais inválidas", async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const auditSpy = jest.spyOn(AuditService.prototype, 'register').mockRejectedValueOnce(new Error("Erro de auditoria simulado"));
        
        const response = await request(server)
            .post("/api/auth/login")
            .send({
                identifier: "teste@teste.com.br",
                password: "SenhaErrada123!"
            });

        expect(response.status).toBe(401);
        expect(consoleSpy).toHaveBeenCalled();
        
        consoleSpy.mockRestore();
        auditSpy.mockRestore();
    });
});

describe("Teste de integração: /api/auth/updatePassword", () => {

    let adminOriginalPassword: string;
    let adminOriginalFirstAccess: boolean;

    beforeAll(async () => {
        const admin = await prisma.user.findUnique({
            where: {
                email:"admin@igarape.com.br",
            },
        });

        if (!admin) {
            throw new Error("Usuário admin não encontrado.");
        }

        adminOriginalPassword = admin.password;
        adminOriginalFirstAccess = admin.firstAccess;
    });

    afterEach(async () => {
        await prisma.user.update({
            where: {
                email:"admin@igarape.com.br",
            },
            data: {
                password: adminOriginalPassword,
                firstAccess: adminOriginalFirstAccess,
            },
        });
    });

    async function realizarLogin() {
        const loginResponse = await request(server)
            .post("/api/auth/login")
            .send({
                identifier: "admin@igarape.com.br",
                password: "Admin123!",
            });

        expect(loginResponse.status).toBe(200);
        expect(loginResponse.headers["set-cookie"]).toBeDefined();

        return loginResponse.headers["set-cookie"];
    }

    it("Deve realizar atualização de senha com sucesso", async () => {
        const cookies = await realizarLogin();
        const response = await request(server)
            .patch("/api/auth/updatePassword")
            .set("Cookie", cookies)
            .send({
                newPassword: "NovaSenhaSegura@2!",
                confirmPassword: "NovaSenhaSegura@2!"
            });
        
            expect(response.status).toBe(200);
            expect(response.body.message).toBe("Senha atualizada com sucesso");
        
        const user = await prisma.user.findUnique({
            where: { email: "admin@igarape.com.br" }
        });

        expect(user?.firstAccess).toBe(false);
    });
        
    it("Deve returnar erro 400, quando a senha não tem o tamanho ideal", async () => {
        const cookies = await realizarLogin()
        const response = await request(server)
            .patch("/api/auth/updatePassword")
            .set("Cookie", cookies)
            .send({
                newPassword: "Nov123!",
                confirmPassword: "Nov123!"
            });
        
            expect(response.status).toBe(400);
            expect(response.body.message).toBe("Erro de validação nos dados enviados");
            expect(response.body.details.newPassword._errors).toContain(
                "A senha deve ter no mínimo 8 caracteres"
            );
    });

    it("Deve returnar erro 400, quando a senha não tem caracter especial", async () => {
        const cookies = await realizarLogin();

        const response = await request(server)
            .patch("/api/auth/updatePassword")
            .set("Cookie", cookies)
            .send({
                newPassword: "NovaSenha123",
                confirmPassword: "NovaSenha123"
            });
        
            expect(response.status).toBe(400);
            expect(response.body.message).toBe("Erro de validação nos dados enviados");
            expect(response.body.details.newPassword._errors).toContain(
                "A senha deve conter pelo menos um caractere especial (@$!%*?&)"
            );
    });

    it("Deve returnar erro 400, quando a senha não tem numeros", async () => {
        const cookies = await realizarLogin();

        const response = await request(server)
            .patch("/api/auth/updatePassword")
            .set("Cookie", cookies)
            .send({
                newPassword: "NovaSenha!!!",
                confirmPassword: "NovaSenha!!!"
            });
        
            expect(response.status).toBe(400);
            expect(response.body.message).toBe("Erro de validação nos dados enviados");
            expect(response.body.details.newPassword._errors).toContain(
                "A senha deve conter pelo menos um número"
            );
    });

    it("Deve returnar erro 400, quando a senha não tem letras minúsculas", async () => {
        const cookies = await realizarLogin();

        const response = await request(server)
            .patch("/api/auth/updatePassword")
            .set("Cookie", cookies)
            .send({
                newPassword: "NOVASENHA!!!",
                confirmPassword: "NOVASENHA!!!"
            });
        
            expect(response.status).toBe(400);
            expect(response.body.message).toBe("Erro de validação nos dados enviados");
            expect(response.body.details.newPassword._errors).toContain(
                "A senha deve conter pelo menos uma letra minúscula"
            );
    });

    it("Deve returnar erro 400, quando a senha não tem letras maiúsculas", async () => {
        const cookies = await realizarLogin();

        const response = await request(server)
            .patch("/api/auth/updatePassword")
            .set("Cookie", cookies)
            .send({
                newPassword: "novasenha!!!",
                confirmPassword: "novasenha!!!"
            });
        
            expect(response.status).toBe(400);
            expect(response.body.message).toBe("Erro de validação nos dados enviados");
            expect(response.body.details.newPassword._errors).toContain(
                "A senha deve conter pelo menos uma letra maiúscula"
            );
    });

    it("Deve exigir token válido para atualizar a senha", async () => {
        const response = await request(server)
            .patch("/api/auth/updatePassword")
            .send({
                newPassword: "Admin123!",
                confirmPassword: "Admin123!"
            });
        
        expect(response.status).toBe(401);
    });

    it("Deve retornar 401 quando o token for inválido", async () => {
        const response = await request(server)
            .patch("/api/auth/updatePassword")
            .set("Cookie", "token=token-invalido")
            .send({
                newPassword: "NovaSenhaSegura@2!",
                confirmPassword: "NovaSenhaSegura@2!",
            });

        expect(response.status).toBe(401);
        expect(response.body.message).toBe("Acesso negado: Token inválido ou expirado.");
    });

    it("Deve retornar 401 quando o token estiver expirado", async () => {
        const secret = process.env.AUTH_TOKEN;

        expect(secret).toBeDefined();

        const expiredToken = jwt.sign(
            {
                id: "usuario-id",
                role: "admin",
            },
            secret!,
            {
                expiresIn: -1,
            }
        );

        const response = await request(server)
            .patch("/api/auth/updatePassword")
            .set("Cookie", `token=${expiredToken}`)
            .send({
                newPassword: "NovaSenhaSegura@2!",
                confirmPassword: "NovaSenhaSegura@2!",
            });

        expect(response.status).toBe(401);
        expect(response.body.message).toBe("Acesso negado: Token inválido ou expirado.");
    });

    it("Deve retornar 400 quando as senhas não coincidirem", async () => {
        const cookies = await realizarLogin();

        const response = await request(server)
            .patch("/api/auth/updatePassword")
            .set("Cookie", cookies)
            .send({
                newPassword: "NovaSenhaSegura@2!",
                confirmPassword: "OutraSenhaSegura@3!",
            });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("Erro de validação nos dados enviados");
        expect(response.body.details.confirmPassword._errors).toContain("As senhas não coincidem");
    });

    it("Deve retornar 401 quando o token é válido, mas não contém um ID", async () => {
        const secret = process.env.AUTH_TOKEN;
        
        const tokenSemId = jwt.sign({ role: "admin" }, secret!);
        
        const response = await request(server)
            .patch("/api/auth/updatePassword")
            .set("Cookie", `token=${tokenSemId}`)
            .send({
                newPassword: "NovaSenhaSegura@2!",
                confirmPassword: "NovaSenhaSegura@2!",
            });

        expect(response.status).toBe(401);
        expect(response.body.message).toBe("Acesso negado: ID não encontrado no token");
    });

    it("Deve retornar 400 se o AuthService.updatePassword lançar um erro comum", async () => {
        const cookies = await realizarLogin();
        const spy = jest.spyOn(AuthService.prototype, 'updatePassword').mockRejectedValueOnce(new Error("Erro simulado ao atualizar"));

        const response = await request(server)
            .patch("/api/auth/updatePassword")
            .set("Cookie", cookies)
            .send({
                newPassword: "NovaSenhaSegura@2!",
                confirmPassword: "NovaSenhaSegura@2!",
            });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("Erro simulado ao atualizar");
        
        spy.mockRestore();
    });

    it("Deve retornar 500 se o AuthService.updatePassword lançar um erro inesperado", async () => {
        const cookies = await realizarLogin();
        const spy = jest.spyOn(AuthService.prototype, 'updatePassword').mockRejectedValueOnce({ falha: "desconhecida" });

        const response = await request(server)
            .patch("/api/auth/updatePassword")
            .set("Cookie", cookies)
            .send({
                newPassword: "NovaSenhaSegura@2!",
                confirmPassword: "NovaSenhaSegura@2!",
            });

        expect(response.status).toBe(500);
        expect(response.body.message).toBe("Ocorreu um erro interno inesperado.");
        
        spy.mockRestore();
    });

    it("Deve concluir a atualização mesmo se a auditoria falhar (cobertura do catch)", async () => {
        const cookies = await realizarLogin();
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const auditSpy = jest.spyOn(AuditService.prototype, 'register').mockRejectedValueOnce(new Error("Auditoria offline"));

        const response = await request(server)
            .patch("/api/auth/updatePassword")
            .set("Cookie", cookies)
            .send({
                newPassword: "NovaSenhaSegura@2!",
                confirmPassword: "NovaSenhaSegura@2!",
            });

        expect(response.status).toBe(200);
        expect(consoleSpy).toHaveBeenCalled();
        
        consoleSpy.mockRestore();
        auditSpy.mockRestore();
    });
});