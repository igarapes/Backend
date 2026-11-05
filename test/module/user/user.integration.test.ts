import request from 'supertest';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import bcrypt from 'bcrypt';

import { server } from '../../../src/server'; 
import { prisma, desconectarBancoDeDados } from '../../../src/config/db';
import { resetDatabase } from '../../helpers/factory';

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

describe('Integração: POST /api/usuarios', () => {
    let adminToken: string;
    let tecnicoToken: string;
    let realAdminId: string;

    beforeAll(async () => {
        await resetDatabase();

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
        
        // O admin do seed nasce com firstAccess = true e seria barrado pelo requirePasswordChanged
        if (adminUser.firstAccess) {
            adminUser = await prisma.user.update({ where: { id: adminUser.id }, data: { firstAccess: false } });
        }

        realAdminId = adminUser.id;

        adminToken = jwt.sign(
            { id: realAdminId, role: 'ADMIN' }, 
            process.env.AUTH_TOKEN as string, 
            { expiresIn: '1h' }
        );

        await prisma.user.deleteMany({ where: { email: { contains: 'test' } } });

        const tecnicoUser = await prisma.user.create({
            data: {
                name: 'Tecnico Criador',
                email: 'tecnico_criador_test@igarape.com.br',
                phone: '61988880999',
                cpf: '90513873041',
                password: 'hashedpassword',
                firstAccess: false,
                roleId: tecnicoRole.id
            }
        });

        tecnicoToken = jwt.sign(
            { id: tecnicoUser.id, role: 'TECNICO' },
            process.env.AUTH_TOKEN as string,
            { expiresIn: '1h' }
        );
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
            .post('/api/usuarios')
            .set('Cookie', [`token=${adminToken}`])
            .send({
                name: "Usuário Teste",
                email: "sucesso_test@test.com",
                phone: "61999999991",
                cpf: "71935766074",
                role: "USUARIO",
                dataConsent: true
            });

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('id');
        expect(response.body.cpf).toBe("***.***.***-**");
        
        const transporter = nodemailer.createTransport();
        expect(transporter.sendMail).toHaveBeenCalled();

        // A senha enviada por e-mail deve ser a mesma que ficou salva (com hash) no banco
        const html = (transporter.sendMail as jest.Mock).mock.calls[0][0].html as string;
        const senhaEnviada = html.match(/<h3[^>]*>\s*(\S+)\s*<\/h3>/)![1]!;
        const usuarioSalvo = await prisma.user.findUnique({ where: { email: "sucesso_test@test.com" } });

        expect(senhaEnviada).toHaveLength(12);
        expect(usuarioSalvo!.password).not.toBe(senhaEnviada);
        expect(await bcrypt.compare(senhaEnviada, usuarioSalvo!.password)).toBe(true);
        expect(usuarioSalvo!.dataConsent).toBe(true);
    });

    it('Deve escapar o nome no HTML do e-mail, impedindo a injeção de links ou tags', async () => {
        const response = await request(server)
            .post('/api/usuarios')
            .set('Cookie', [`token=${adminToken}`])
            .send({ name: '<a href="https://site-falso.com">Clique</a>', email: "html_test@test.com", phone: "61999999984", cpf: "11144477735", role: "USUARIO", dataConsent: true });

        expect(response.status).toBe(201);

        const transporter = nodemailer.createTransport();
        const html = (transporter.sendMail as jest.Mock).mock.calls.at(-1)[0].html as string;
        expect(html).toContain('&lt;a href=&quot;https://site-falso.com&quot;&gt;Clique&lt;/a&gt;');
        expect(html).not.toContain('<a href="https://site-falso.com">');
    });

    it('Deve bloquear (400) a criação sem o consentimento de dados', async () => {
        const semConsentimento = await request(server)
            .post('/api/usuarios')
            .set('Cookie', [`token=${adminToken}`])
            .send({ name: "Sem Consentimento", email: "sem_consentimento_test@test.com", phone: "61999999981", cpf: "45317828791", role: "USUARIO" });

        const consentimentoFalso = await request(server)
            .post('/api/usuarios')
            .set('Cookie', [`token=${adminToken}`])
            .send({ name: "Sem Consentimento", email: "sem_consentimento_test@test.com", phone: "61999999981", cpf: "45317828791", role: "USUARIO", dataConsent: false });

        expect(semConsentimento.status).toBe(400);
        expect(consentimentoFalso.status).toBe(400);
        expect(consentimentoFalso.body.details.dataConsent._errors).toContain("O consentimento de dados é obrigatório.");
    });

    it('Deve bloquear (400) e-mails fora dos domínios permitidos quando ALLOWED_EMAIL_DOMAINS está configurado', async () => {
        const original = process.env.ALLOWED_EMAIL_DOMAINS;
        process.env.ALLOWED_EMAIL_DOMAINS = "igarape.com.br, outrodominio.com";

        try {
            const bloqueado = await request(server)
                .post('/api/usuarios')
                .set('Cookie', [`token=${adminToken}`])
                .send({ name: "Dominio Bloqueado", email: "dominio_test@gmail.com", phone: "61999999982", cpf: "68356544068", role: "USUARIO", dataConsent: true });

            const permitido = await request(server)
                .post('/api/usuarios')
                .set('Cookie', [`token=${adminToken}`])
                .send({ name: "Dominio Permitido", email: "dominio_test@IGARAPE.com.br", phone: "61999999983", cpf: "68356544068", role: "USUARIO", dataConsent: true });

            expect(bloqueado.status).toBe(400);
            expect(bloqueado.body.details.email._errors).toContain("Domínio de e-mail não permitido.");
            expect(permitido.status).toBe(201);
        } finally {
            if (original === undefined) delete process.env.ALLOWED_EMAIL_DOMAINS;
            else process.env.ALLOWED_EMAIL_DOMAINS = original;
        }
    });

    it('Deve permitir que um ADMIN crie um usuário com perfil TECNICO', async () => {
        const response = await request(server)
            .post('/api/usuarios')
            .set('Cookie', [`token=${adminToken}`])
            .send({
                name: "Técnico Criado Por Admin",
                email: "tecnico_test@test.com",
                phone: "61999999992",
                cpf: "22752809018",
                role: "TECNICO",
                dataConsent: true
            });

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('id');
        expect(response.body.cpf).toBe("***.***.***-**");
    });

    it('Deve bloquear a criação se o role não existe no schema Zod', async () => {
        const response = await request(server)
            .post('/api/usuarios')
            .set('Cookie', [`token=${adminToken}`])
            .send({
                name: "Usuário Role Invalida",
                email: "invalid_role@test.com",
                phone: "61993419991",
                cpf: "96125090000",
                role: "GERENTE",
                dataConsent: true
            });

        expect(response.status).toBe(400);
        expect(response.body.message).toContain("Erro de validação nos dados enviados");
    });

    it('Deve bloquear a criação se o CPF for inválido', async () => {
        const response = await request(server)
            .post('/api/usuarios')
            .set('Cookie', [`token=${adminToken}`])
            .send({
                name: "Usuário CPF Invalido",
                email: "invalido_test@test.com",
                phone: "61999999992",
                cpf: "11111111111",
                role: "USUARIO",
                dataConsent: true
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
            role: "USUARIO",
            dataConsent: true
        };

        await request(server)
            .post('/api/usuarios')
            .set('Cookie', [`token=${adminToken}`])
            .send(userData);
        
        const response = await request(server)
            .post('/api/usuarios')
            .set('Cookie', [`token=${adminToken}`])
            .send(userData);
        
        expect(response.status).toBe(409);
        expect(response.body.message).toContain("já estão em uso");
    });

    it('Deve bloquear a criação se um TÉCNICO tentar criar um ADMIN', async () => {
        const response = await request(server)
            .post('/api/usuarios')
            .set('Cookie', [`token=${tecnicoToken}`])
            .send({
                name: "Novo Admin Ilegal",
                email: "admin_test@test.com",
                phone: "61999999994",
                cpf: "28859976057", 
                role: "ADMIN",
                dataConsent: true
            });
        
        expect(response.status).toBe(403);
        expect(response.body.message).toContain("Técnicos podem cadastrar apenas Usuários comuns");
    });

    it('Deve bloquear a criação se um TÉCNICO tentar criar outro TECNICO', async () => {
        const response = await request(server)
            .post('/api/usuarios')
            .set('Cookie', [`token=${tecnicoToken}`])
            .send({
                name: "Novo Tecnico Ilegal",
                email: "tecnico_ilegal@test.com",
                phone: "61999999995",
                cpf: "69207687046", 
                role: "TECNICO",
                dataConsent: true
            });
        
        expect(response.status).toBe(403);
        expect(response.body.message).toContain("Técnicos podem cadastrar apenas Usuários comuns");
    });

    it('Deve deletar o usuário do banco se o envio de email falhar (Rollback)', async () => {
        const transporter = nodemailer.createTransport();
        (transporter.sendMail as jest.Mock).mockRejectedValueOnce(new Error('SMTP Falhou'));

        const response = await request(server)
            .post('/api/usuarios')
            .set('Cookie', [`token=${adminToken}`])
            .send({
                name: "Usuário Teste Rollback",
                email: "rollback_test@test.com",
                phone: "61999999996",
                cpf: "15380277047",
                role: "USUARIO",
                dataConsent: true
            });

        expect(response.status).toBe(503);
        expect(response.body.message).toContain("Não foi possível enviar o email");
        
        const ghostUser = await prisma.user.findFirst({ where: { email: "rollback_test@test.com" } });
        expect(ghostUser).toBeNull();
    });
});

describe('Integração: PUT /api/usuarios/:id', () => {
    let adminToken: string;
    let tecnicoToken: string;
    let usuarioToken: string;
    
    let adminId: string;
    let tecnicoId: string;
    let usuarioId: string;
    let outroUsuarioId: string;
    let outroTecnicoId: string;

    beforeAll(async () => {
        await resetDatabase();

        const adminRole = await prisma.role.findFirst({ where: { name: 'ADMIN' } });
        const tecnicoRole = await prisma.role.findFirst({ where: { name: 'TECNICO' } });
        const usuarioRole = await prisma.role.findFirst({ where: { name: 'USUARIO' } });

        const admin = await prisma.user.create({
            data: { name: 'Admin Edição', email: 'admin_put@igarape.com.br', phone: '61988887771', cpf: '11422784013', password: 'hash', firstAccess: false, roleId: adminRole!.id }
        });
        adminId = admin.id;
        adminToken = jwt.sign({ id: adminId, role: 'ADMIN' }, process.env.AUTH_TOKEN as string, { expiresIn: '1h' });

        const tecnico = await prisma.user.create({
            data: { name: 'Tecnico Edição', email: 'tecnico_put@igarape.com.br', phone: '61988887772', cpf: '26233513076', password: 'hash', firstAccess: false, roleId: tecnicoRole!.id }
        });
        tecnicoId = tecnico.id;
        tecnicoToken = jwt.sign({ id: tecnicoId, role: 'TECNICO' }, process.env.AUTH_TOKEN as string, { expiresIn: '1h' });

        const usuario = await prisma.user.create({
            data: { name: 'Usuario Edição', email: 'usuario_put@igarape.com.br', phone: '61988887773', cpf: '55152283030', password: 'hash', firstAccess: false, roleId: usuarioRole!.id }
        });
        usuarioId = usuario.id;
        usuarioToken = jwt.sign({ id: usuarioId, role: 'USUARIO' }, process.env.AUTH_TOKEN as string, { expiresIn: '1h' });

        const outroUsuario = await prisma.user.create({
            data: { name: 'Outro Usuario Edição', email: 'outro_put@igarape.com.br', phone: '61988887774', cpf: '66127116041', password: 'hash', firstAccess: false, roleId: usuarioRole!.id }
        });
        outroUsuarioId = outroUsuario.id;

        const outroTecnico = await prisma.user.create({
            data: { name: 'Outro Tecnico Edição', email: 'outro_tecnico_put@igarape.com.br', phone: '61988887775', cpf: '73428957049', password: 'hash', firstAccess: false, roleId: tecnicoRole!.id }
        });
        outroTecnicoId = outroTecnico.id;
    });

    afterAll(async () => {
        await resetDatabase();
        await desconectarBancoDeDados();
    });

    it('Deve permitir que um USUARIO atualize o próprio perfil', async () => {
        const response = await request(server)
            .put(`/api/usuarios/${usuarioId}`)
            .set('Cookie', [`token=${usuarioToken}`])
            .send({ name: 'Usuario Edição Atualizado' });

        expect(response.status).toBe(200);
        expect(response.body.name).toBe('Usuario Edição Atualizado');
    });

    it('Deve bloquear (403) se um USUARIO tentar atualizar o perfil de outra pessoa', async () => {
        const response = await request(server)
            .put(`/api/usuarios/${outroUsuarioId}`) 
            .set('Cookie', [`token=${usuarioToken}`])
            .send({ name: 'Hacker Name' });

        expect(response.status).toBe(403);
        expect(response.body.message).toContain("Acesso negado: Usuários não podem atualizar outros perfis");
    });

    it('Deve permitir que um TECNICO atualize um USUARIO comum', async () => {
        const response = await request(server)
            .put(`/api/usuarios/${outroUsuarioId}`)
            .set('Cookie', [`token=${tecnicoToken}`])
            .send({ name: 'Nome Editado Pelo Tecnico' });

        expect(response.status).toBe(200);
        expect(response.body.name).toBe('Nome Editado Pelo Tecnico');
    });

    it('Deve bloquear (403) se um TECNICO tentar atualizar um ADMIN', async () => {
        const response = await request(server)
            .put(`/api/usuarios/${adminId}`)
            .set('Cookie', [`token=${tecnicoToken}`])
            .send({ name: 'Admin Hackeado' });

        expect(response.status).toBe(403);
        expect(response.body.message).toContain("Técnicos não podem alterar dados de Administradores");
    });

    it('Deve bloquear (403) se um TECNICO tentar atualizar outro TECNICO, sem alterar nada no banco', async () => {
        const response = await request(server)
            .put(`/api/usuarios/${outroTecnicoId}`)
            .set('Cookie', [`token=${tecnicoToken}`])
            .send({ name: 'Tecnico Hackeado' });

        expect(response.status).toBe(403);
        expect(response.body.message).toContain("Técnicos não podem alterar dados de Administradores ou de outros Técnicos");

        const noBanco = await prisma.user.findUnique({ where: { id: outroTecnicoId } });
        expect(noBanco?.name).toBe('Outro Tecnico Edição');
    });

    it('Deve bloquear (403) se um TECNICO tentar promover alguém a ADMIN', async () => {
        const response = await request(server)
            .put(`/api/usuarios/${outroUsuarioId}`)
            .set('Cookie', [`token=${tecnicoToken}`])
            .send({ role: 'ADMIN' });

        expect(response.status).toBe(403);
        expect(response.body.message).toContain("Apenas administradores podem alterar o perfil de acesso");
    });

    it('Deve bloquear (403) se um USUARIO tentar se promover a ADMIN', async () => {
        const response = await request(server)
            .put(`/api/usuarios/${usuarioId}`)
            .set('Cookie', [`token=${usuarioToken}`])
            .send({ role: 'ADMIN' });

        expect(response.status).toBe(403);
        const noBanco = await prisma.user.findUnique({ where: { id: usuarioId }, include: { role: true } });
        expect(noBanco?.role.name).toBe('USUARIO');
    });

    it('Deve permitir que o USUARIO envie a própria role sem alterá-la (o formulário sempre envia o campo)', async () => {
        const response = await request(server)
            .put(`/api/usuarios/${usuarioId}`)
            .set('Cookie', [`token=${usuarioToken}`])
            .send({ name: 'Usuario Edição', role: 'USUARIO' });

        expect(response.status).toBe(200);
    });

    it('Deve bloquear (403) que o ADMIN altere o próprio perfil de acesso', async () => {
        const response = await request(server)
            .put(`/api/usuarios/${adminId}`)
            .set('Cookie', [`token=${adminToken}`])
            .send({ role: 'USUARIO' });

        expect(response.status).toBe(403);
        expect(response.body.message).toContain("não podem alterar o próprio perfil");
    });

    it('Deve permitir que um ADMIN atualize qualquer usuário', async () => {
        const response = await request(server)
            .put(`/api/usuarios/${tecnicoId}`)
            .set('Cookie', [`token=${adminToken}`])
            .send({ name: 'Tecnico Atualizado Pelo Admin' });

        expect(response.status).toBe(200);
        expect(response.body.name).toBe('Tecnico Atualizado Pelo Admin');
    });

    it('Deve permitir que um ADMIN altere o perfil de acesso de outro usuário', async () => {
        const response = await request(server)
            .put(`/api/usuarios/${outroUsuarioId}`)
            .set('Cookie', [`token=${adminToken}`])
            .send({ role: 'TECNICO' });

        expect(response.status).toBe(200);
        const noBanco = await prisma.user.findUnique({ where: { id: outroUsuarioId }, include: { role: true } });
        expect(noBanco?.role.name).toBe('TECNICO');
        expect(noBanco?.updatedById).toBe(adminId);
    });

    it('Deve retornar erro se o ID do alvo não for um UUID válido (Zod param)', async () => {
        const response = await request(server)
            .put(`/api/usuarios/123-id-invalido`)
            .set('Cookie', [`token=${adminToken}`])
            .send({ name: 'Teste UUID' });

        expect(response.status).toBe(400);
    });

    it('Deve retornar erro se o usuário alvo não for encontrado no banco', async () => {
        const fakeUuid = '123e4567-e89b-12d3-a456-426614174000'; 
        const response = await request(server)
            .put(`/api/usuarios/${fakeUuid}`)
            .set('Cookie', [`token=${adminToken}`])
            .send({ name: 'Fantasma' });

        expect(response.status).toBe(404); 
        expect(response.body.message).toContain("Usuário não encontrado");
    });

    it('Deve retornar erro se tentar atualizar para um email já existente (Erro P2002 Prisma)', async () => {
        const response = await request(server)
            .put(`/api/usuarios/${usuarioId}`)
            .set('Cookie', [`token=${usuarioToken}`])
            .send({ email: 'admin_put@igarape.com.br' }); 

        expect(response.status).toBe(409);
        expect(response.body.message).toContain("já estão em uso");
    });
});

describe('Integração: PATCH /api/usuarios/:id/inativar', () => {
    let adminToken: string;
    let tecnicoToken: string;
    let usuarioToken: string;
    
    let adminId: string;
    let tecnico1Id: string;
    let tecnico2Id: string;
    let usuario1Id: string;
    let usuario2Id: string;

    beforeAll(async () => {
        await resetDatabase();

        const adminRole = await prisma.role.findFirst({ where: { name: 'ADMIN' } });
        const tecnicoRole = await prisma.role.findFirst({ where: { name: 'TECNICO' } });
        const usuarioRole = await prisma.role.findFirst({ where: { name: 'USUARIO' } });

        const admin = await prisma.user.create({
            data: { name: 'Admin Inativador', email: 'admin_patch@igarape.com.br', phone: '61988886661', cpf: '04859384001', password: 'hash', firstAccess: false, roleId: adminRole!.id }
        });
        adminId = admin.id;
        adminToken = jwt.sign({ id: adminId, role: 'ADMIN' }, process.env.AUTH_TOKEN as string, { expiresIn: '1h' });

        const tecnico1 = await prisma.user.create({
            data: { name: 'Tecnico Inativador', email: 'tecnico1_patch@igarape.com.br', phone: '61988886662', cpf: '04859384002', password: 'hash', firstAccess: false, roleId: tecnicoRole!.id }
        });
        tecnico1Id = tecnico1.id;
        tecnicoToken = jwt.sign({ id: tecnico1Id, role: 'TECNICO' }, process.env.AUTH_TOKEN as string, { expiresIn: '1h' });

        const tecnico2 = await prisma.user.create({
            data: { name: 'Tecnico Alvo', email: 'tecnico2_patch@igarape.com.br', phone: '61988886663', cpf: '04859384003', password: 'hash', firstAccess: false, roleId: tecnicoRole!.id }
        });
        tecnico2Id = tecnico2.id;

        const usuario1 = await prisma.user.create({
            data: { name: 'Usuario Inativador', email: 'usuario1_patch@igarape.com.br', phone: '61988886664', cpf: '04859384004', password: 'hash', firstAccess: false, roleId: usuarioRole!.id }
        });
        usuario1Id = usuario1.id;

        const usuario2 = await prisma.user.create({
            data: { name: 'Usuario Alvo', email: 'usuario2_patch@igarape.com.br', phone: '61988886665', cpf: '04859384005', password: 'hash', firstAccess: false, roleId: usuarioRole!.id }
        });
        usuario2Id = usuario2.id;

        // Usuário que nunca é inativado nos testes: usado para validar o 403 de quem não tem permissão
        const usuario3 = await prisma.user.create({
            data: { name: 'Usuario Sem Permissao', email: 'usuario3_patch@igarape.com.br', phone: '61988886666', cpf: '04859384006', password: 'hash', firstAccess: false, roleId: usuarioRole!.id }
        });
        usuarioToken = jwt.sign({ id: usuario3.id, role: 'USUARIO' }, process.env.AUTH_TOKEN as string, { expiresIn: '1h' });
    });

    afterAll(async () => {
        await resetDatabase();
        await desconectarBancoDeDados();
    });

    it('Deve permitir que um ADMIN inative um USUARIO comum', async () => {
        const response = await request(server)
            .patch(`/api/usuarios/${usuario2Id}/inativar`)
            .set('Cookie', [`token=${adminToken}`]);

        expect(response.status).toBe(200);
        expect(response.body.isActivate).toBe(false);

        // Soft delete: o registro continua no banco, só que inativo, e com o autor da inativação
        const noBanco = await prisma.user.findUnique({ where: { id: usuario2Id } });
        expect(noBanco).not.toBeNull();
        expect(noBanco?.isActivate).toBe(false);
        expect(noBanco?.name).toBe('Usuario Alvo');
        expect(noBanco?.email).toBe('usuario2_patch@igarape.com.br');
        expect(noBanco?.updatedById).toBe(adminId);
    });

    it('Deve permitir que um ADMIN inative um TECNICO', async () => {
        const response = await request(server)
            .patch(`/api/usuarios/${tecnico2Id}/inativar`)
            .set('Cookie', [`token=${adminToken}`]);

        expect(response.status).toBe(200);
        expect(response.body.isActivate).toBe(false);
    });

    it('Deve permitir que um TECNICO inative um USUARIO comum', async () => {
        const response = await request(server)
            .patch(`/api/usuarios/${usuario1Id}/inativar`)
            .set('Cookie', [`token=${tecnicoToken}`]);

        expect(response.status).toBe(200);
        expect(response.body.isActivate).toBe(false);
    });

    it('Deve bloquear (403) se um TECNICO tentar inativar um ADMIN', async () => {
        const response = await request(server)
            .patch(`/api/usuarios/${adminId}/inativar`)
            .set('Cookie', [`token=${tecnicoToken}`]);

        expect(response.status).toBe(403);
        expect(response.body.message).toContain("Técnicos não podem alterar dados de Administradores");
    });

    it('Deve bloquear (403) se um TECNICO tentar inativar outro TECNICO', async () => {
        const response = await request(server)
            .patch(`/api/usuarios/${tecnico2Id}/inativar`)
            .set('Cookie', [`token=${tecnicoToken}`]);

        expect(response.status).toBe(403);
        expect(response.body.message).toContain("Técnicos não podem alterar dados de Administradores");
    });

    it('Deve bloquear (403) a tentativa de autossabotagem (inativar a própria conta)', async () => {
        const response = await request(server)
            .patch(`/api/usuarios/${adminId}/inativar`)
            .set('Cookie', [`token=${adminToken}`]);

        expect(response.status).toBe(403);
        expect(response.body.message).toContain("Não pode inativar o próprio perfil");
    });

    it('Deve bloquear (403) se um USUARIO tentar acessar a rota de inativação', async () => {
        const response = await request(server)
            .patch(`/api/usuarios/${usuario2Id}/inativar`)
            .set('Cookie', [`token=${usuarioToken}`]);

        expect(response.status).toBe(403); 
    });

    it('Deve retornar erro (400) se o ID do alvo não for um UUID válido (Zod)', async () => {
        const response = await request(server)
            .patch(`/api/usuarios/id-falso-invalido/inativar`)
            .set('Cookie', [`token=${adminToken}`]);

        expect(response.status).toBe(400);
    });

    it('Deve retornar erro se o usuário alvo não existir no banco', async () => {
        const fakeUuid = '999e4567-e89b-12d3-a456-426614174000';
        const response = await request(server)
            .patch(`/api/usuarios/${fakeUuid}/inativar`)
            .set('Cookie', [`token=${adminToken}`]);

        expect(response.status).toBe(404);
        expect(response.body.message).toContain("Usuário não encontrado");
    });
});

describe('Integração: DELETE /api/usuarios/:id', () => {
    let adminToken: string;
    let usuario1Token: string;
    let usuario2Token: string;
    
    let adminId: string;
    let usuario1Id: string;
    let usuario2Id: string;

    beforeAll(async () => {
        await resetDatabase();

        const adminRole = await prisma.role.findFirst({ where: { name: 'ADMIN' } });
        const usuarioRole = await prisma.role.findFirst({ where: { name: 'USUARIO' } });

        const admin = await prisma.user.create({
            data: { name: 'Admin Deletador', email: 'admin_del@igarape.com.br', phone: '61988885551', cpf: '44596328004', password: 'hash', firstAccess: false, roleId: adminRole!.id }
        });
        adminId = admin.id;
        adminToken = jwt.sign({ id: adminId, role: 'ADMIN' }, process.env.AUTH_TOKEN as string, { expiresIn: '1h' });

        const usuario1 = await prisma.user.create({
            data: { name: 'Usuario Dono', email: 'user1_del@igarape.com.br', phone: '61988885552', cpf: '34483863071', password: 'hash', firstAccess: false, roleId: usuarioRole!.id }
        });
        usuario1Id = usuario1.id;
        usuario1Token = jwt.sign({ id: usuario1Id, role: 'USUARIO' }, process.env.AUTH_TOKEN as string, { expiresIn: '1h' });

        const usuario2 = await prisma.user.create({
            data: { name: 'Usuario Vitima', email: 'user2_del@igarape.com.br', phone: '61988885553', cpf: '81119567086', password: 'hash', firstAccess: false, roleId: usuarioRole!.id }
        });
        usuario2Id = usuario2.id;
        usuario2Token = jwt.sign({ id: usuario2Id, role: 'USUARIO' }, process.env.AUTH_TOKEN as string, { expiresIn: '1h' });
    });

    afterAll(async () => {
        await resetDatabase();
        await desconectarBancoDeDados();
    });

    it('Deve bloquear (403) a tentativa de excluir a conta de outra pessoa', async () => {
        const response = await request(server)
            .delete(`/api/usuarios/${usuario2Id}`)
            .set('Cookie', [`token=${usuario1Token}`]);

        expect(response.status).toBe(403);
        expect(response.body.message).toContain("apenas o dono da conta pode deletar ela");
    });

    it('Deve bloquear (403) a tentativa do ADMIN de excluir a própria conta', async () => {
        const response = await request(server)
            .delete(`/api/usuarios/${adminId}`)
            .set('Cookie', [`token=${adminToken}`]);

        expect(response.status).toBe(403); 
        expect(response.body.message).toContain("O admin não pode deletar a sua conta");
    });

    it('Deve retornar erro (400) se o ID do alvo não for um UUID válido (Zod)', async () => {
        const response = await request(server)
            .delete(`/api/usuarios/id-invalido-zod`)
            .set('Cookie', [`token=${usuario1Token}`]);

        expect(response.status).toBe(400);
    });

    it('Deve retornar 401 se o token for de um usuário que não existe no banco', async () => {
        const fakeUuid = '555e4567-e89b-12d3-a456-426614174000';

        const fakeToken = jwt.sign({ id: fakeUuid, role: 'USUARIO' }, process.env.AUTH_TOKEN as string, { expiresIn: '1h' });

        const response = await request(server)
            .delete(`/api/usuarios/${fakeUuid}`)
            .set('Cookie', [`token=${fakeToken}`]);

        expect(response.status).toBe(401);
        expect(response.body.message).toContain("Usuário não encontrado ou inativo");
    });

    it('Deve permitir (200) que um USUARIO exclua (anonimize) a própria conta', async () => {
        const response = await request(server)
            .delete(`/api/usuarios/${usuario1Id}`)
            .set('Cookie', [`token=${usuario1Token}`]);

        expect(response.status).toBe(200);
        
        expect(response.body.name).toBe("Usuário Excluído");
        expect(response.body.email).toContain("excluido_");
        expect(response.body.isActivate).toBe(false);
        expect(response.body.cpf).toBe("***.***.***-**");

        const usuarioNoBanco = await prisma.user.findUnique({ where: { id: usuario1Id } });
        expect(usuarioNoBanco?.updatedById).toBe(usuario1Id);
    });
});

describe('Integração: GET /api/usuarios', () => {
    let adminToken: string;
    let tecnicoToken: string;
    let usuarioToken: string;

    beforeAll(async () => {
        await resetDatabase();

        const adminRole = await prisma.role.findFirst({ where: { name: 'ADMIN' } });
        const tecnicoRole = await prisma.role.findFirst({ where: { name: 'TECNICO' } });
        const usuarioRole = await prisma.role.findFirst({ where: { name: 'USUARIO' } });

        const admin = await prisma.user.create({
            data: { name: 'Admin Master', email: 'admin_get@igarape.com.br', phone: '61999990001', cpf: '11111111111', password: 'hash', firstAccess: false, roleId: adminRole!.id }
        });
        adminToken = jwt.sign({ id: admin.id, role: 'ADMIN' }, process.env.AUTH_TOKEN || 'test-secret', { expiresIn: '1h' });

        const tecnico1 = await prisma.user.create({
            data: { name: 'Tecnico 1', email: 'tec1_get@igarape.com.br', phone: '61999990002', cpf: '22222222222', password: 'hash', firstAccess: false, roleId: tecnicoRole!.id }
        });
        tecnicoToken = jwt.sign({ id: tecnico1.id, role: 'TECNICO' }, process.env.AUTH_TOKEN || 'test-secret', { expiresIn: '1h' });

        await prisma.user.create({
            data: { name: 'Tecnico 2', email: 'tec2_get@igarape.com.br', phone: '61999990003', cpf: '33333333333', password: 'hash', firstAccess: false, roleId: tecnicoRole!.id }
        });

        const usuario1 = await prisma.user.create({
            data: { name: 'Usuario 1', email: 'user1_get@igarape.com.br', phone: '61999990004', cpf: '44444444444', password: 'hash', firstAccess: false, roleId: usuarioRole!.id }
        });
        usuarioToken = jwt.sign({ id: usuario1.id, role: 'USUARIO' }, process.env.AUTH_TOKEN || 'test-secret', { expiresIn: '1h' });

        await prisma.user.create({
            data: { name: 'Usuario 2', email: 'user2_get@igarape.com.br', phone: '61999990005', cpf: '55555555555', password: 'hash', firstAccess: false, roleId: usuarioRole!.id }
        });
    });

    afterAll(async () => {
        await resetDatabase();
        await desconectarBancoDeDados();
    });

    it('Deve permitir que o ADMIN liste todos os usuários cadastrados no banco', async () => {
        const response = await request(server)
            .get('/api/usuarios')
            .set('Cookie', [`token=${adminToken}`]);

        expect(response.status).toBe(200);
        expect(Array.isArray(response.body.data)).toBeTruthy();
        expect(response.body.data.length).toBe(5);
        expect(response.body).toMatchObject({ total: 5, page: 1, limit: 10, totalPages: 1 });
        
        expect(response.body.data[0]).not.toHaveProperty('password');
        expect(response.body.data[0].cpf).toBe('***.***.***-**');
    });

    it('Deve paginar a listagem sem repetir usuários entre as páginas', async () => {
        const pagina1 = await request(server)
            .get('/api/usuarios?page=1&limit=2')
            .set('Cookie', [`token=${adminToken}`]);
        const pagina2 = await request(server)
            .get('/api/usuarios?page=2&limit=2')
            .set('Cookie', [`token=${adminToken}`]);
        const pagina3 = await request(server)
            .get('/api/usuarios?page=3&limit=2')
            .set('Cookie', [`token=${adminToken}`]);

        expect(pagina1.status).toBe(200);
        expect(pagina1.body).toMatchObject({ total: 5, page: 1, limit: 2, totalPages: 3 });
        expect(pagina1.body.data).toHaveLength(2);
        expect(pagina2.body.data).toHaveLength(2);
        expect(pagina3.body.data).toHaveLength(1);

        const ids = [...pagina1.body.data, ...pagina2.body.data, ...pagina3.body.data].map((user: { id: string }) => user.id);
        expect(new Set(ids).size).toBe(5);
    });

    it('Deve retornar 400 para parâmetros de paginação inválidos', async () => {
        const limiteAlto = await request(server)
            .get('/api/usuarios?limit=500')
            .set('Cookie', [`token=${adminToken}`]);
        const paginaZero = await request(server)
            .get('/api/usuarios?page=0')
            .set('Cookie', [`token=${adminToken}`]);
        const naoNumero = await request(server)
            .get('/api/usuarios?page=abc')
            .set('Cookie', [`token=${adminToken}`]);

        expect(limiteAlto.status).toBe(400);
        expect(paginaZero.status).toBe(400);
        expect(naoNumero.status).toBe(400);
    });

    it('Deve restringir a listagem do TECNICO apenas a perfis do tipo USUARIO (Menor Privilégio)', async () => {
        const response = await request(server)
            .get('/api/usuarios')
            .set('Cookie', [`token=${tecnicoToken}`]);

        expect(response.status).toBe(200);
        expect(Array.isArray(response.body.data)).toBeTruthy();
        
        expect(response.body.data.length).toBe(2); 
        expect(response.body.total).toBe(2);

        response.body.data.forEach((user: any) => {
            expect(user.role.name).toBe('USUARIO');
        });
    });

    it('Deve bloquear (403) a tentativa de um USUARIO comum acessar a listagem', async () => {
        const response = await request(server)
            .get('/api/usuarios')
            .set('Cookie', [`token=${usuarioToken}`]);

        expect(response.status).toBe(403);
    });
});
describe('Integração: GET /api/usuarios/:id', () => {
    const ids: Record<string, string> = {};
    const tokens: Record<string, string> = {};

    beforeAll(async () => {
        await resetDatabase();

        const roles = {
            ADMIN: await prisma.role.findFirst({ where: { name: 'ADMIN' } }),
            TECNICO: await prisma.role.findFirst({ where: { name: 'TECNICO' } }),
            USUARIO: await prisma.role.findFirst({ where: { name: 'USUARIO' } }),
        };

        const pessoas = [
            { chave: 'admin', role: 'ADMIN', email: 'admin_getid@igarape.com.br', phone: '61999980001', cpf: '10000000001' },
            { chave: 'tecnico1', role: 'TECNICO', email: 'tec1_getid@igarape.com.br', phone: '61999980002', cpf: '10000000002' },
            { chave: 'tecnico2', role: 'TECNICO', email: 'tec2_getid@igarape.com.br', phone: '61999980003', cpf: '10000000003' },
            { chave: 'usuario1', role: 'USUARIO', email: 'user1_getid@igarape.com.br', phone: '61999980004', cpf: '10000000004' },
            { chave: 'usuario2', role: 'USUARIO', email: 'user2_getid@igarape.com.br', phone: '61999980005', cpf: '10000000005' },
        ] as const;

        for (const pessoa of pessoas) {
            const user = await prisma.user.create({
                data: { name: pessoa.chave, email: pessoa.email, phone: pessoa.phone, cpf: pessoa.cpf, password: 'hash', firstAccess: false, roleId: roles[pessoa.role]!.id }
            });
            ids[pessoa.chave] = user.id;
            tokens[pessoa.chave] = jwt.sign({ id: user.id, role: pessoa.role }, process.env.AUTH_TOKEN as string, { expiresIn: '1h' });
        }
    });

    afterAll(async () => {
        await resetDatabase();
        await desconectarBancoDeDados();
    });

    async function buscar(quem: string, alvo: string) {
        return request(server)
            .get(`/api/usuarios/${alvo}`)
            .set('Cookie', [`token=${tokens[quem]}`]);
    }

    it('Deve retornar os dados sem senha e com CPF mascarado', async () => {
        const response = await buscar('admin', ids.usuario1!);

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({ id: ids.usuario1, email: 'user1_getid@igarape.com.br', phone: '61999980004', cpf: '***.***.***-**' });
        expect(response.body.role.name).toBe('USUARIO');
        expect(response.body).not.toHaveProperty('password');
    });

    it('ADMIN pode ver qualquer usuário', async () => {
        expect((await buscar('admin', ids.tecnico1!)).status).toBe(200);
        expect((await buscar('admin', ids.admin!)).status).toBe(200);
    });

    it('TECNICO pode ver a si mesmo e Usuários comuns', async () => {
        expect((await buscar('tecnico1', ids.tecnico1!)).status).toBe(200);
        expect((await buscar('tecnico1', ids.usuario1!)).status).toBe(200);
    });

    it('TECNICO não pode ver outros Técnicos nem Administradores (403)', async () => {
        expect((await buscar('tecnico1', ids.tecnico2!)).status).toBe(403);
        expect((await buscar('tecnico1', ids.admin!)).status).toBe(403);
    });

    it('USUARIO só pode ver a si mesmo (403 para os outros)', async () => {
        expect((await buscar('usuario1', ids.usuario1!)).status).toBe(200);
        expect((await buscar('usuario1', ids.usuario2!)).status).toBe(403);
        expect((await buscar('usuario1', ids.admin!)).status).toBe(403);
    });

    it('Deve retornar 404 para um usuário inexistente e 400 para um ID inválido', async () => {
        expect((await buscar('admin', '123e4567-e89b-12d3-a456-426614174000')).status).toBe(404);
        expect((await buscar('admin', 'id-invalido')).status).toBe(400);
    });
});
