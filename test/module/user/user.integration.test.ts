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

describe('Integração: PUT /api/user/:id', () => {
    let adminToken: string;
    let tecnicoToken: string;
    let usuarioToken: string;
    
    let adminId: string;
    let tecnicoId: string;
    let usuarioId: string;
    let outroUsuarioId: string;

    beforeAll(async () => {
        const adminRole = await prisma.role.findFirst({ where: { name: 'ADMIN' } });
        const tecnicoRole = await prisma.role.findFirst({ where: { name: 'TECNICO' } });
        const usuarioRole = await prisma.role.findFirst({ where: { name: 'USUARIO' } });

        const admin = await prisma.user.create({
            data: { name: 'Admin Edição', email: 'admin_put@igarape.com.br', phone: '61988887771', cpf: '11422784013', password: 'hash', firstAccess: false, roleId: adminRole!.id }
        });
        adminId = admin.id;
        adminToken = jwt.sign({ id: adminId, role: 'ADMIN' }, process.env.AUTH_TOKEN || 'test-secret', { expiresIn: '1h' });

        const tecnico = await prisma.user.create({
            data: { name: 'Tecnico Edição', email: 'tecnico_put@igarape.com.br', phone: '61988887772', cpf: '26233513076', password: 'hash', firstAccess: false, roleId: tecnicoRole!.id }
        });
        tecnicoId = tecnico.id;
        tecnicoToken = jwt.sign({ id: tecnicoId, role: 'TECNICO' }, process.env.AUTH_TOKEN || 'test-secret', { expiresIn: '1h' });

        const usuario = await prisma.user.create({
            data: { name: 'Usuario Edição', email: 'usuario_put@igarape.com.br', phone: '61988887773', cpf: '55152283030', password: 'hash', firstAccess: false, roleId: usuarioRole!.id }
        });
        usuarioId = usuario.id;
        usuarioToken = jwt.sign({ id: usuarioId, role: 'USUARIO' }, process.env.AUTH_TOKEN || 'test-secret', { expiresIn: '1h' });

        const outroUsuario = await prisma.user.create({
            data: { name: 'Outro Usuario Edição', email: 'outro_put@igarape.com.br', phone: '61988887774', cpf: '66127116041', password: 'hash', firstAccess: false, roleId: usuarioRole!.id }
        });
        outroUsuarioId = outroUsuario.id;
    });

    it('Deve permitir que um USUARIO atualize o próprio perfil', async () => {
        const response = await request(server)
            .put(`/api/user/${usuarioId}`)
            .set('Cookie', [`token=${usuarioToken}`])
            .send({ name: 'Usuario Edição Atualizado' });

        expect(response.status).toBe(200);
        expect(response.body.name).toBe('Usuario Edição Atualizado');
    });

    it('Deve bloquear (403) se um USUARIO tentar atualizar o perfil de outra pessoa', async () => {
        const response = await request(server)
            .put(`/api/user/${outroUsuarioId}`) // Tentando editar a conta de outro
            .set('Cookie', [`token=${usuarioToken}`])
            .send({ name: 'Hacker Name' });

        expect(response.status).toBe(403);
        expect(response.body.message).toContain("Acesso negado: Usuários não podem atualizar outros perfis");
    });

    it('Deve permitir que um TECNICO atualize um USUARIO comum', async () => {
        const response = await request(server)
            .put(`/api/user/${outroUsuarioId}`)
            .set('Cookie', [`token=${tecnicoToken}`])
            .send({ name: 'Nome Editado Pelo Tecnico' });

        expect(response.status).toBe(200);
    });

    it('Deve bloquear (403) se um TECNICO tentar atualizar um ADMIN', async () => {
        const response = await request(server)
            .put(`/api/user/${adminId}`)
            .set('Cookie', [`token=${tecnicoToken}`])
            .send({ name: 'Admin Hackeado' });

        expect(response.status).toBe(403);
        expect(response.body.message).toContain("Técnicos não podem alterar dados de Administradores");
    });

    it('Deve bloquear (403) se um TECNICO tentar promover alguém a ADMIN', async () => {
        const response = await request(server)
            .put(`/api/user/${outroUsuarioId}`)
            .set('Cookie', [`token=${tecnicoToken}`])
            .send({ role: 'ADMIN' });

        expect(response.status).toBe(403);
        expect(response.body.message).toContain("Apenas administradores podem conceder o perfil de ADMIN");
    });

    it('Deve permitir que um ADMIN atualize qualquer usuário e altere roles', async () => {
        const response = await request(server)
            .put(`/api/user/${tecnicoId}`)
            .set('Cookie', [`token=${adminToken}`])
            .send({ name: 'Tecnico Atualizado Pelo Admin' });

        expect(response.status).toBe(200);
    });

    it('Deve retornar erro se o ID do alvo não for um UUID válido (Zod param)', async () => {
        const response = await request(server)
            .put(`/api/user/123-id-invalido`)
            .set('Cookie', [`token=${adminToken}`])
            .send({ name: 'Teste UUID' });

        expect(response.status).toBe(400);
    });

    it('Deve retornar erro se o usuário alvo não for encontrado no banco', async () => {
        const fakeUuid = '123e4567-e89b-12d3-a456-426614174000'; 
        const response = await request(server)
            .put(`/api/user/${fakeUuid}`)
            .set('Cookie', [`token=${adminToken}`])
            .send({ name: 'Fantasma' });

        expect(response.status).toBe(400); 
        expect(response.body.message).toContain("Usuário não envontrado"); // Escrito conforme o erro da sua service
    });

    it('Deve retornar erro se tentar atualizar para um email já existente (Erro P2002 Prisma)', async () => {
        const response = await request(server)
            .put(`/api/user/${usuarioId}`)
            .set('Cookie', [`token=${usuarioToken}`])
            .send({ email: 'admin_put@igarape.com.br' }); // Email que pertence ao adminId

        expect(response.status).toBe(400);
        expect(response.body.message).toContain("já estão em uso");
    });
});