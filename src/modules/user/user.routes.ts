import { Router } from "express";

import { UserController } from "./user.controller";
import { validateData } from "../../shared/middleware/validadeData";
import { authenticated } from "../../shared/middleware/authenticated";
import { checkRole } from "../../shared/middleware/checkRole"; // Ajuste o caminho conforme seu projeto
import { schemaCreate } from "./user.schema";

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
 *                 example: true
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

export { userRoutes };