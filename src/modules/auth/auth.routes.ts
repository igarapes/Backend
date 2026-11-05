import { Router } from "express";

import { AuthController } from "./auth.controller.js";
import { validateData } from "../../shared/middleware/validateData.js";
import { authenticated } from "../../shared/middleware/authenticated.js";
import { loginRateLimit } from "../../shared/middleware/loginRateLimit.js";
import { schemaChangePassword, schemaLogin } from "./auth.schema.js";

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
 *         description: Login realizado com sucesso. O token é enviado apenas via HttpOnly Cookie; o corpo traz os dados básicos do usuário.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Login realizado com sucesso
 *                 user:
 *                   $ref: '#/components/schemas/UsuarioLogado'
 *       401:
 *         description: Credenciais inválidas.
 *       429:
 *         description: Muitas tentativas de login com falha. Limite de 5 tentativas a cada 15 minutos por IP.
 */
authRoutes.post(
    "/login",
    loginRateLimit,
    validateData(schemaLogin, "body"),
    authController.login.bind(authController)
);

/**
 * @swagger
 * /auth/atualizarSenha:
 *   post:
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
authRoutes.post(
    "/atualizarSenha",
    authenticated,
    validateData(schemaChangePassword, "body"),
    authController.updatePassword.bind(authController)
);

/**
 * @swagger
 * components:
 *   schemas:
 *     UsuarioLogado:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         name:
 *           type: string
 *           example: Administrador Igarapés
 *         role:
 *           type: string
 *           enum: [ADMIN, TECNICO, USUARIO]
 *         firstAccess:
 *           type: boolean
 *           example: false
 *
 * /auth/me:
 *   get:
 *     summary: Retorna os dados do usuário logado
 *     description: Rota protegida (Token via HttpOnly Cookie). Usada pelo front para saber se existe sessão, qual o perfil e se o usuário ainda precisa trocar a senha provisória. Não é bloqueada no primeiro acesso.
 *     tags: [Autenticação]
 *     responses:
 *       200:
 *         description: Dados do usuário logado (sem senha e sem CPF).
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/UsuarioLogado'
 *                 - type: object
 *                   properties:
 *                     email:
 *                       type: string
 *                       example: admin@igarape.com.br
 *       401:
 *         description: Token ausente, inválido, expirado ou usuário inativo.
 */
authRoutes.get(
    "/me",
    authenticated,
    authController.me.bind(authController)
);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Encerra a sessão do usuário
 *     description: Remove o cookie HttpOnly do token. Não exige autenticação, para que uma sessão com token expirado também possa ser encerrada.
 *     tags: [Autenticação]
 *     responses:
 *       200:
 *         description: Logout realizado com sucesso.
 */
authRoutes.post(
    "/logout",
    authController.logout.bind(authController)
);

export { authRoutes }