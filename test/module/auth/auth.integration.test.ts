import request from "supertest";
import { execSync } from "child_process";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import crypto from "crypto";

import { server } from "../../../src/server";
import { AuthService } from "../../../src/modules/auth/auth.service";
import { AuditService } from "../../../src/shared/audit";
import { desconectarBancoDeDados, prisma } from "../../../src/config/db";
import { hashCpf } from "../../../src/shared/crypto";

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
        expect(decoded.role).toBe("ADMIN");
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
        expect(user?.password).not.toBe("NovaSenhaSegura@2!");
        expect(await bcrypt.compare("NovaSenhaSegura@2!", user!.password)).toBe(true);
        expect(user?.updatedById).toBe(user?.id);
    });

    it("Deve retornar erro 400 quando a senha passa do tamanho máximo", async () => {
        const cookies = await realizarLogin();
        const senhaLonga = "Aa1@" + "a".repeat(80);

        const response = await request(server)
            .patch("/api/auth/updatePassword")
            .set("Cookie", cookies)
            .send({
                newPassword: senhaLonga,
                confirmPassword: senhaLonga
            });

        expect(response.status).toBe(400);
        expect(response.body.details.newPassword._errors).toContain("A senha deve ter no máximo 64 caracteres");
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
        expect(response.body.message).toBe("Acesso negado: Token inválido ou expirado.");
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
    it("Deve retornar 400 quando a nova senha aparece em vazamentos de dados", async () => {
        const cookies = await realizarLogin();
        const senhaVazada = "SenhaVazada@123";
        const sha1 = crypto.createHash("sha1").update(senhaVazada).digest("hex").toUpperCase();
        const fetchSpy = jest.spyOn(globalThis, "fetch")
            .mockImplementationOnce(async () => new Response(`0000000000000000000000000000000000A:0\r\n${sha1.slice(5)}:42`));

        const response = await request(server)
            .patch("/api/auth/updatePassword")
            .set("Cookie", cookies)
            .send({ newPassword: senhaVazada, confirmPassword: senhaVazada });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("Esta senha já apareceu em vazamentos de dados. Escolha outra senha.");
        expect(fetchSpy).toHaveBeenLastCalledWith(`https://api.pwnedpasswords.com/range/${sha1.slice(0, 5)}`, expect.anything());
    });

    it("Deve permitir a troca de senha se a API de senhas vazadas estiver fora do ar", async () => {
        const cookies = await realizarLogin();
        const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
        jest.spyOn(globalThis, "fetch").mockImplementationOnce(async () => { throw new Error("API fora do ar"); });

        const response = await request(server)
            .patch("/api/auth/updatePassword")
            .set("Cookie", cookies)
            .send({ newPassword: "NovaSenhaSegura@2!", confirmPassword: "NovaSenhaSegura@2!" });

        expect(response.status).toBe(200);
        expect(consoleSpy).toHaveBeenCalled();

        consoleSpy.mockRestore();
    });
});

describe("Teste de integração: login por CPF e bloqueio de usuários inativos", () => {
    const senha = "Senha@123";
    const emails = ["cpf_login@igarape.com.br", "inativo_login@igarape.com.br", "inativado_depois@igarape.com.br"];

    beforeAll(async () => {
        await prisma.user.deleteMany({ where: { email: { in: emails } } });

        const usuarioRole = await prisma.role.findFirst({ where: { name: "USUARIO" } });
        const hashedPassword = await bcrypt.hash(senha, 10);

        await prisma.user.createMany({
            data: [
                { name: "Login CPF", email: emails[0]!, phone: "61977771001", cpf: hashCpf("52998224725"), password: hashedPassword, firstAccess: false, roleId: usuarioRole!.id },
                { name: "Login Inativo", email: emails[1]!, phone: "61977771002", cpf: hashCpf("86288366757"), password: hashedPassword, firstAccess: false, isActivate: false, roleId: usuarioRole!.id },
                { name: "Inativado Depois", email: emails[2]!, phone: "61977771003", cpf: hashCpf("71428793860"), password: hashedPassword, firstAccess: false, roleId: usuarioRole!.id },
            ]
        });
    });

    afterAll(async () => {
        await prisma.user.deleteMany({ where: { email: { in: emails } } });
        await desconectarBancoDeDados();
    });

    it("Deve realizar o login com CPF com máscara", async () => {
        const response = await request(server)
            .post("/api/auth/login")
            .send({ identifier: "529.982.247-25", password: senha });

        expect(response.status).toBe(200);
    });

    it("Deve realizar o login com CPF sem máscara", async () => {
        const response = await request(server)
            .post("/api/auth/login")
            .send({ identifier: "52998224725", password: senha });

        expect(response.status).toBe(200);
    });

    it("Não deve gravar o CPF em texto puro na auditoria do login (sucesso e falha)", async () => {
        await request(server)
            .post("/api/auth/login")
            .send({ identifier: "529.982.247-25", password: senha });
        await request(server)
            .post("/api/auth/login")
            .send({ identifier: "529.982.247-25", password: "SenhaErrada@1" });

        const registros = await prisma.auditLog.findMany({
            where: { action: "LOGIN_ATTEMPT" },
            orderBy: { createdAt: "desc" },
            take: 2,
        });

        expect(registros.map((registro) => registro.status).sort()).toEqual(["FAILED", "SUCCESS"]);
        registros.forEach((registro) => {
            expect(registro.targetEmail).toBe(hashCpf("52998224725"));
            expect(registro.targetEmail).not.toContain("52998224725");
        });
    });

    it("Deve manter o e-mail na auditoria quando o login é feito por e-mail", async () => {
        await request(server)
            .post("/api/auth/login")
            .send({ identifier: emails[0], password: senha });

        const registro = await prisma.auditLog.findFirst({
            where: { action: "LOGIN_ATTEMPT" },
            orderBy: { createdAt: "desc" },
        });

        expect(registro?.targetEmail).toBe(emails[0]);
    });

    it("Deve retornar 401 com mensagem genérica ao logar com usuário inativo", async () => {
        const response = await request(server)
            .post("/api/auth/login")
            .send({ identifier: emails[1], password: senha });

        expect(response.status).toBe(401);
        expect(response.body.message).toBe("Credenciais inválidas");
    });

    it("Deve retornar 401 ao usar um token emitido antes da inativação", async () => {
        const loginResponse = await request(server)
            .post("/api/auth/login")
            .send({ identifier: emails[2], password: senha });

        expect(loginResponse.status).toBe(200);
        const cookies = loginResponse.headers["set-cookie"];

        await prisma.user.update({ where: { email: emails[2] }, data: { isActivate: false } });

        const response = await request(server)
            .patch("/api/auth/updatePassword")
            .set("Cookie", cookies)
            .send({ newPassword: "NovaSenhaSegura@2!", confirmPassword: "NovaSenhaSegura@2!" });

        expect(response.status).toBe(401);
        expect(response.body.message).toContain("Usuário não encontrado ou inativo");
    });
});

describe("Teste de integração: troca de senha obrigatória no primeiro acesso", () => {
    const email = "primeiro_acesso@igarape.com.br";
    const senhaProvisoria = "Provisoria@123";
    let cookies: string[];

    beforeAll(async () => {
        await prisma.user.deleteMany({ where: { email } });

        const tecnicoRole = await prisma.role.findFirst({ where: { name: "TECNICO" } });

        await prisma.user.create({
            data: { name: "Primeiro Acesso", email, phone: "61977771004", cpf: hashCpf("39053344705"), password: await bcrypt.hash(senhaProvisoria, 10), firstAccess: true, roleId: tecnicoRole!.id }
        });

        const loginResponse = await request(server)
            .post("/api/auth/login")
            .send({ identifier: email, password: senhaProvisoria });

        cookies = loginResponse.headers["set-cookie"] as unknown as string[];
    });

    afterAll(async () => {
        await prisma.user.deleteMany({ where: { email } });
        await desconectarBancoDeDados();
    });

    it("Deve bloquear (403) as rotas de usuário enquanto a senha provisória não for trocada", async () => {
        const response = await request(server)
            .get("/api/user")
            .set("Cookie", cookies);

        expect(response.status).toBe(403);
        expect(response.body.message).toBe("Troque sua senha provisória para continuar.");
    });

    it("Deve permitir a troca de senha durante o primeiro acesso", async () => {
        const response = await request(server)
            .patch("/api/auth/updatePassword")
            .set("Cookie", cookies)
            .send({ newPassword: "NovaSenhaSegura@2!", confirmPassword: "NovaSenhaSegura@2!" });

        expect(response.status).toBe(200);
    });

    it("Deve liberar as rotas com o mesmo cookie depois da troca de senha", async () => {
        const response = await request(server)
            .get("/api/user")
            .set("Cookie", cookies);

        expect(response.status).toBe(200);
    });
});

describe("Teste de integração: /api/auth/me e /api/auth/logout", () => {
    const email = "sessao_me@igarape.com.br";
    const senha = "Senha@123";

    beforeAll(async () => {
        await prisma.user.deleteMany({ where: { email } });

        const usuarioRole = await prisma.role.findFirst({ where: { name: "USUARIO" } });

        await prisma.user.create({
            data: { name: "Sessao Me", email, phone: "61977771005", cpf: hashCpf("16899535009"), password: await bcrypt.hash(senha, 10), firstAccess: true, roleId: usuarioRole!.id }
        });
    });

    afterAll(async () => {
        await prisma.user.deleteMany({ where: { email } });
        await desconectarBancoDeDados();
    });

    async function login() {
        return request(server)
            .post("/api/auth/login")
            .send({ identifier: email, password: senha });
    }

    it("O login não deve devolver o token no corpo, apenas os dados do usuário", async () => {
        const response = await login();

        expect(response.status).toBe(200);
        expect(response.headers["set-cookie"][0]).toMatch(/token=/);
        expect(response.body.token).toBeUndefined();
        expect(response.body.user).toMatchObject({ name: "Sessao Me", role: "USUARIO", firstAccess: true });
        expect(response.body.user.id).toBeDefined();
    });

    it("Deve retornar os dados do usuário logado sem senha e sem CPF, mesmo no primeiro acesso", async () => {
        const cookies = (await login()).headers["set-cookie"];

        const response = await request(server)
            .get("/api/auth/me")
            .set("Cookie", cookies);

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({ name: "Sessao Me", email, role: "USUARIO", firstAccess: true });
        expect(response.body.password).toBeUndefined();
        expect(response.body.cpf).toBeUndefined();
    });

    it("Deve retornar 401 no /me sem cookie", async () => {
        const response = await request(server).get("/api/auth/me");

        expect(response.status).toBe(401);
    });

    it("Deve apagar o cookie do token no logout, mesmo sem estar autenticado", async () => {
        const response = await request(server).post("/api/auth/logout");

        expect(response.status).toBe(200);
        const cookie = response.headers["set-cookie"][0];
        expect(cookie).toMatch(/^token=;/);
        expect(cookie).toMatch(/Expires=Thu, 01 Jan 1970/);
        expect(cookie).toMatch(/HttpOnly/);
    });
});

describe("Teste de integração: limite de tentativas no /api/auth/login", () => {
    afterAll(async () => {
        await desconectarBancoDeDados();
    });

    async function loginComFalha() {
        return request(server)
            .post("/api/auth/login")
            .send({ identifier: "nao_existe@igarape.com.br", password: "SenhaErrada@1" });
    }

    it("Deve bloquear (429) a partir da 6ª tentativa com falha", async () => {
        for (let i = 0; i < 5; i++) {
            const response = await loginComFalha();
            expect(response.status).toBe(401);
        }

        const bloqueada = await loginComFalha();

        expect(bloqueada.status).toBe(429);
        expect(bloqueada.body.message).toBe("Muitas tentativas de login. Tente novamente em alguns minutos.");
    });

    it("Não deve contar os logins realizados com sucesso", async () => {
        for (let i = 0; i < 6; i++) {
            const response = await request(server)
                .post("/api/auth/login")
                .send({ identifier: "admin@igarape.com.br", password: "Admin123!" });

            expect(response.status).toBe(200);
        }
    });
});
