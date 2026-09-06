import { Router } from "express";

import { UserController } from "./user.controller";
import { validateData } from "../../shared/middleware/validadeData";
import { authenticated } from "../../shared/middleware/authenticated";
import { checkRole } from "../../shared/middleware/checkRole"; // Ajuste o caminho conforme seu projeto
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

export { userRoutes };