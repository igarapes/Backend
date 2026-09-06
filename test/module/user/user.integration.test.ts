import request from 'supertest';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';

import { server } from '../../../src/server'; 
import { prisma, desconectarBancoDeDados } from '../../../src/config/db';

jest.mock('nodemailer', () => {
    const mSendMail = jest.fn().mockResolvedValue({ messageId: 'mock-id-123' });
    return {
        createTransport: jest.fn().mockReturnValue({
            sendMail: mSendMail
        })
    };
});

jest.mock('../../../src/shared/audit', () => {
    return {
        AuditService: jest.fn().mockImplementation(() => ({
            register: jest.fn().mockResolvedValue(true)
        }))
    }
});

describe('Integração: POST /api/user', () => {
    let adminToken: string;
    let tecnicoToken: string;
    let realAdminId: string;

    beforeAll(async () => {
        let adminRole = await prisma.role.findFirst({ where: { name: 'ADMIN' } });
        if (!adminRole) adminRole = await prisma.role.create({ data: { name: 'ADMIN' } });

        let tecnicoRole = await prisma.role.findFirst({ where: { name: 'TECNICO' } });
        if (!tecnicoRole) tecnicoRole = await prisma.role.create({ data: { name: 'TECNICO' } });

        const usuarioRole = await prisma.role.findFirst({ where: { name: 'USUARIO' } });
        if (!usuarioRole) await prisma.role.create({ data: { name: 'USUARIO' } });

        let adminUser = await prisma.user.findUnique({ where: { email: 'admin@igarape.com.br' } });
        if (!adminUser) {
            adminUser = await prisma.user.create({
                data: {
                    name: 'Admin Teste',
                    email: 'admin@igarape.com.br',
                    phone: '61988888888',
                    cpf: '12345678900',
                    password: 'hashedpassword',
                    firstAccess: false,
                    roleId: adminRole.id
                }
            });
        }
        
        realAdminId = adminUser.id;

        adminToken = jwt.sign(
            { id: realAdminId, role: 'ADMIN' }, 
            process.env.AUTH_TOKEN || 'test-secret', 
            { expiresIn: '1h' }
        );

        tecnicoToken = jwt.sign(
            { id: realAdminId, role: 'TECNICO' }, 
            process.env.AUTH_TOKEN || 'test-secret', 
            { expiresIn: '1h' }
        );

        await prisma.user.deleteMany({ where: { email: { contains: 'test' } } });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    afterAll(async () => {
        await prisma.user.deleteMany({ where: { email: { contains: 'test' } } });
        await desconectarBancoDeDados();
    });

    it('Deve criar um novo USUARIO, retornar CPF mascarado e disparar o email', async () => {
        const response = await request(server)
            .post('/api/user')
            .set('Cookie', [`token=${adminToken}`])
            .send({
                name: "Usuário Teste",
                email: "sucesso_test@test.com",
                phone: "61999999991",
                cpf: "71935766074",
                role: "USUARIO"
            });

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('id');
        expect(response.body.cpf).toBe("***.***.***-**");
        
        const transporter = nodemailer.createTransport();
        expect(transporter.sendMail).toHaveBeenCalled(); 
    });

    it('Deve permitir que um ADMIN crie um usuário com perfil TECNICO', async () => {
        const response = await request(server)
            .post('/api/user')
            .set('Cookie', [`token=${adminToken}`])
            .send({
                name: "Técnico Criado Por Admin",
                email: "tecnico_test@test.com",
                phone: "61999999992",
                cpf: "22752809018",
                role: "TECNICO"
            });

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('id');
        expect(response.body.cpf).toBe("***.***.***-**");
    });

    it('Deve bloquear a criação se o role não existe no schema Zod', async () => {
        const response = await request(server)
            .post('/api/user')
            .set('Cookie', [`token=${adminToken}`])
            .send({
                name: "Usuário Role Invalida",
                email: "invalid_role@test.com",
                phone: "61993419991",
                cpf: "96125090000",
                role: "GERENTE"
            });

        expect(response.status).toBe(400);
        expect(response.body.message).toContain("Erro de validação nos dados enviados");
    });

    it('Deve bloquear a criação se o CPF for inválido', async () => {
        const response = await request(server)
            .post('/api/user')
            .set('Cookie', [`token=${adminToken}`])
            .send({
                name: "Usuário CPF Invalido",
                email: "invalido_test@test.com",
                phone: "61999999992",
                cpf: "11111111111",
                role: "USUARIO"
            });
        
        expect(response.status).toBe(400);
        expect(response.body.message).toContain("Erro de validação nos dados enviados");
    });

    it('Deve bloquear a criação (Erro P2002) se o email ou CPF já existirem no banco', async () => {
        const userData = {
            name: "Usuário Duplicado",
            email: "duplicado_test@test.com",
            phone: "61999999993",
            cpf: "22576339034",
            role: "USUARIO"
        };

        await request(server)
            .post('/api/user')
            .set('Cookie', [`token=${adminToken}`])
            .send(userData);
        
        const response = await request(server)
            .post('/api/user')
            .set('Cookie', [`token=${adminToken}`])
            .send(userData);
        
        expect(response.status).toBe(400);
        expect(response.body.message).toContain("já estão em uso");
    });

    it('Deve bloquear a criação se um TÉCNICO tentar criar um ADMIN', async () => {
        const response = await request(server)
            .post('/api/user')
            .set('Cookie', [`token=${tecnicoToken}`])
            .send({
                name: "Novo Admin Ilegal",
                email: "admin_test@test.com",
                phone: "61999999994",
                cpf: "28859976057", 
                role: "ADMIN"
            });
        
        expect(response.status).toBe(400);
        expect(response.body.message).toContain("Técnicos podem cadastrar apenas Usuários comuns");
    });

    it('Deve bloquear a criação se um TÉCNICO tentar criar outro TECNICO', async () => {
        const response = await request(server)
            .post('/api/user')
            .set('Cookie', [`token=${tecnicoToken}`])
            .send({
                name: "Novo Tecnico Ilegal",
                email: "tecnico_ilegal@test.com",
                phone: "61999999995",
                cpf: "69207687046", 
                role: "TECNICO"
            });
        
        expect(response.status).toBe(400);
        expect(response.body.message).toContain("Técnicos podem cadastrar apenas Usuários comuns");
    });

    it('Deve deletar o usuário do banco se o envio de email falhar (Rollback)', async () => {
        const transporter = nodemailer.createTransport();
        (transporter.sendMail as jest.Mock).mockRejectedValueOnce(new Error('SMTP Falhou'));

        const response = await request(server)
            .post('/api/user')
            .set('Cookie', [`token=${adminToken}`])
            .send({
                name: "Usuário Teste Rollback",
                email: "rollback_test@test.com",
                phone: "61999999996",
                cpf: "15380277047",
                role: "USUARIO"
            });

        expect(response.status).toBe(400);
        expect(response.body.message).toContain("Não foi possível enviar o email");
        
        const ghostUser = await prisma.user.findFirst({ where: { email: "rollback_test@test.com" } });
        expect(ghostUser).toBeNull();
    });
});