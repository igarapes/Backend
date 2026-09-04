import { Router } from "express";

import { authRoutes } from "../modules/auth/auth.routes";

const routes = Router();

routes.use("/auth", authRoutes);

export {routes};