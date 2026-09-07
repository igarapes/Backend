import { Router } from "express";

import { UserController } from "./user.controller";
import { validateData } from "../../shared/middleware/validadeData";
import { authenticated } from "../../shared/middleware/authenticated";
import { checkRole } from "../../shared/middleware/checkRole";
import { schemaCreate, schemaIdParam, schemaUpdate } from "./user.schema";

const userRoutes = Router();
const userController = new UserController();

/**
 * @swagger
 * /user:
 *   post:
 *     summary: Cria um novo usuário na plataforma
 *     description: Rota protegida. O criador deve estar logado (Token via HttpOnly Cookie) e possuir perfil de ADMIN ou TECNICO. Técnicos só podem criar usuários comuns. A senha é gerada e enviada automaticamente por email.
 *     tags: [Usuários]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - phone
 *               - cpf
 *               - role
 *               - dataConsent
 *             properties:
 *               name:
 *                 type: string
 *                 example: "João da Silva"
 *               email:
 *                 type: string
 *                 example: "pcdf0303@gmail.com"
 *               phone:
 *                 type: string
 *                 example: "61999999989"
 *               cpf:
 *                 type: string
 *                 example: "66007683044"
 *               role:
 *                 type: string
 *                 enum: [ADMIN, TECNICO, USUARIO]
 *                 example: "USUARIO"
 *     responses:
 *       201:
 *         description: Usuário criado com sucesso e e-mail de acesso enviado.
 *       400:
 *         description: Erro de validação nos dados enviados (Zod) ou regra de negócio (Email/CPF duplicado, violação de hierarquia).
 *       401:
 *         description: Acesso negado. Token não fornecido ou inválido.
 *       403:
 *         description: Acesso negado. Perfil sem permissão para criar usuários.
 */
userRoutes.post(
    "/", 
    authenticated,
    checkRole(["ADMIN", "TECNICO"]),
    validateData(schemaCreate, "body"),
    userController.createUser.bind(userController)
);


/**
 * @swagger
 * /user/{id}:
 *   put:
 *     summary: Atualiza os dados de um usuário existente
 *     description: Rota protegida. O solicitante deve estar logado (Token via HttpOnly Cookie). Técnicos só podem editar a si mesmos e a Usuários comuns. Administradores podem editar qualquer um. Todos os campos no body são opcionais (envie apenas o que deseja alterar).
 *     tags: [Usuários]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID (UUID) do usuário que será atualizado
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "João da Silva Atualizado"
 *               email:
 *                 type: string
 *                 example: "novoemail@igarape.com.br"
 *               phone:
 *                 type: string
 *                 example: "61999999989"
 *               password:
 *                 type: string
 *                 example: "NovaSenhaSegura1@"
 *     responses:
 *       200:
 *         description: Usuário atualizado com sucesso.
 *       400:
 *         description: Erro de validação nos dados enviados (Zod) ou e-mail já em uso.
 *       401:
 *         description: Acesso negado. Token não fornecido ou inválido.
 *       403:
 *         description: Acesso negado. Violação de hierarquia (Ex Tentar editar um Admin sendo Técnico).
 *       404:
 *         description: Usuário alvo não encontrado no banco de dados.
 */
userRoutes.put(
    "/:id",
    authenticated,                                 
    checkRole(["ADMIN", "TECNICO", "USUARIO"]),               
    validateData(schemaIdParam, "params"),         
    validateData(schemaUpdate, "body"),            
    userController.updateUser.bind(userController) 
);

/**
 * @swagger
 * /user/{id}/inactivate:
 *   patch:
 *     summary: Inativa um usuário do sistema (Soft Delete)
 *     description: Rota estritamente administrativa. Altera o status do usuário para inativo, bloqueando acessos futuros sem apagar o histórico de auditoria. Técnicos só podem inativar Usuários comuns. Administradores podem inativar Técnicos e Usuários.
 *     tags: [Usuários]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID (UUID) do usuário alvo que será inativado
 *     responses:
 *       200:
 *         description: Usuário inativado com sucesso.
 *       400:
 *         description: Erro de validação no formato do UUID enviado.
 *       401:
 *         description: Acesso negado. Token de autenticação ausente ou inválido.
 *       403:
 *         description: Acesso negado. Possíveis motivos - Violação de hierarquia (Técnico inativando Admin) ou tentativa de autossabotagem (inativar a própria conta).
 *       404:
 *         description: Usuário alvo não encontrado no banco de dados.
 */
userRoutes.patch( 
    "/:id/inactivate", 
    authenticated,
    checkRole(["ADMIN", "TECNICO"]), 
    validateData(schemaIdParam, "params"),
    userController.inactivateUser.bind(userController)
);

/**
 * @swagger
 * /user/{id}:
 *   delete:
 *     summary: Exclui (anonimiza) a conta do próprio usuário
 *     description: Rota para que o usuário exerça seu direito de exclusão (LGPD). Os dados pessoais são anonimizados para preservar a integridade do banco de dados e os logs de auditoria. Apenas o dono da conta pode excluí-la. Administradores não podem excluir suas próprias contas.
 *     tags: [Usuários]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID (UUID) da conta a ser excluída
 *     responses:
 *       200:
 *         description: Conta excluída (anonimizada) com sucesso.
 *       400:
 *         description: Erro de validação ou usuário não encontrado.
 *       401:
 *         description: Acesso negado. Token ausente ou inválido.
 *       403:
 *         description: Acesso negado. Tentativa de excluir conta de terceiros ou tentativa do Admin de se autoexcluir.
 */
userRoutes.delete(
    "/:id",
    authenticated,
    validateData(schemaIdParam, "params"),
    userController.anonymizeUser.bind(userController)
);

/**
 * @swagger
 * /user:
 *   get:
 *     summary: Lista os usuários cadastrados no sistema
 *     description: Retorna uma lista de usuários preservando a privacidade (senhas omitidas e CPFs mascarados). O retorno é filtrado pelo Princípio do Menor Privilégio - Administradores podem visualizar todos os usuários do sistema; Técnicos podem visualizar apenas perfis do tipo "USUARIO". Perfis comuns ("USUARIO") não têm acesso a esta rota.
 *     tags: [Usuários]
 *     responses:
 *       200:
 *         description: Lista de usuários retornada com sucesso.
 *       401:
 *         description: Acesso negado. Token de autenticação ausente ou inválido.
 *       403:
 *         description: Acesso negado. Usuário comum tentando acessar a listagem.
 *       500:
 *         description: Erro interno no servidor.
 */
userRoutes.get(
    "/",
    authenticated,
    checkRole(["ADMIN", "TECNICO"]),
    userController.listUsers.bind(userController)
);

export { userRoutes };