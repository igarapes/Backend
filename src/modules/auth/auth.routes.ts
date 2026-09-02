import { Router } from "express";

import { AuthController } from "./auth.controller";
import { validateData } from "../../shared/middleware/validadeData";
import { authenticated } from "../../shared/middleware/authenticated";
import { schemaChangePassword, schemaLogin } from "./auth.schema";

const authRoutes = Router();
const authController = new AuthController();


/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Realiza o login do usuário
 *     tags: [Autenticação]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               identifier:
 *                 type: string
 *                 example: admin@igarape.com.br
 *               password:
 *                 type: string
 *                 example: Admin123!
 *     responses:
 *       200:
 *         description: Login realizado com sucesso. Token injetado via HttpOnly Cookie.
 *       401:
 *         description: Credenciais inválidas.
 */
authRoutes.post(
    "/login",
    validateData(schemaLogin, "body"),
    authController.login
);

/**
 * @swagger
 * /auth/updatePassword:
 *   patch:
 *     summary: Atualiza a senha do usuário
 *     description: Rota protegida. O usuário já deve estar logado (Token injetado via HttpOnly Cookie).
 *     tags: [Autenticação]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               newPassword:
 *                 type: string
 *                 example: "NovaSenhaSegura@2026!"
 *               confirmPassword:
 *                 type: string
 *                 example: "NovaSenhaSegura@2026!"
 *     responses:
 *       200:
 *         description: Senha atualizada com sucesso.
 */
authRoutes.patch(
    "/updatePassword",
    authenticated,
    validateData(schemaChangePassword),
    authController.updatePassword
);

export { authRoutes }