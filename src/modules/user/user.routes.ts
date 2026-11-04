import { Router } from "express";

import { UserController } from "./user.controller.js";
import { validateData } from "../../shared/middleware/validadeData.js";
import { authenticated } from "../../shared/middleware/authenticated.js";
import { checkRole } from "../../shared/middleware/checkRole.js";
import { schemaCreate, schemaIdParam, schemaListQuery, schemaUpdate } from "./user.schema.js";
import { requirePasswordChanged } from "../../shared/middleware/requirePasswordChanged.js";

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
 *               dataConsent:
 *                 type: boolean
 *                 description: Consentimento do usuário para o uso do e-mail (opt-in). Precisa ser true.
 *                 example: true
 *     responses:
 *       201:
 *         description: Usuário criado com sucesso e e-mail de acesso enviado.
 *       400:
 *         description: Erro de validação nos dados enviados (Zod), como consentimento ausente ou domínio de e-mail não permitido.
 *       401:
 *         description: Acesso negado. Token não fornecido ou inválido.
 *       403:
 *         description: Acesso negado. Perfil sem permissão para criar usuários ou Técnico tentando criar um perfil acima de Usuário.
 *       409:
 *         description: E-mail, CPF ou telefone já em uso.
 *       503:
 *         description: Falha no envio do e-mail com a senha provisória. O cadastro é desfeito.
 */
userRoutes.post(
    "/", 
    authenticated,
    requirePasswordChanged,
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
 *         description: Erro de validação nos dados enviados (Zod) ou senha encontrada em vazamentos de dados.
 *       401:
 *         description: Acesso negado. Token não fornecido ou inválido.
 *       403:
 *         description: Acesso negado. Violação de hierarquia (Ex Tentar editar um Admin sendo Técnico).
 *       404:
 *         description: Usuário alvo não encontrado no banco de dados.
 *       409:
 *         description: E-mail ou telefone já em uso por outro usuário.
 */
userRoutes.put(
    "/:id",
    authenticated,
    requirePasswordChanged,                                 
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
    requirePasswordChanged,
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
 *         description: ID em formato inválido.
 *       401:
 *         description: Acesso negado. Token ausente ou inválido.
 *       403:
 *         description: Acesso negado. Tentativa de excluir conta de terceiros ou tentativa do Admin de se autoexcluir.
 */
userRoutes.delete(
    "/:id",
    authenticated,
    requirePasswordChanged,
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
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *     responses:
 *       200:
 *         description: Página da lista de usuários.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                 total:
 *                   type: integer
 *                   example: 42
 *                 page:
 *                   type: integer
 *                   example: 1
 *                 limit:
 *                   type: integer
 *                   example: 10
 *                 totalPages:
 *                   type: integer
 *                   example: 5
 *       400:
 *         description: Parâmetros de paginação inválidos.
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
    requirePasswordChanged,
    checkRole(["ADMIN", "TECNICO"]),
    validateData(schemaListQuery, "query"),
    userController.listUsers.bind(userController)
);

/**
 * @swagger
 * /user/{id}:
 *   get:
 *     summary: Busca os dados de um usuário
 *     description: Rota protegida. Usada pela tela de edição. Usuários só veem o próprio perfil; Técnicos veem o próprio perfil e Usuários comuns; Administradores veem todos. A senha nunca é retornada e o CPF vem mascarado.
 *     tags: [Usuários]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Dados do usuário.
 *       400:
 *         description: ID em formato inválido.
 *       401:
 *         description: Token ausente, inválido ou expirado.
 *       403:
 *         description: Sem permissão para ver este usuário.
 *       404:
 *         description: Usuário não encontrado.
 */
userRoutes.get(
    "/:id",
    authenticated,
    requirePasswordChanged,
    checkRole(["ADMIN", "TECNICO", "USUARIO"]),
    validateData(schemaIdParam, "params"),
    userController.getUserById.bind(userController)
);

export { userRoutes };