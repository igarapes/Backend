import { Router } from "express";

import { authRoutes } from "../modules/auth/auth.routes.js";
import { userRoutes } from "../modules/user/user.routes.js";

const routes = Router();

routes.use("/auth", authRoutes);
routes.use("/user", userRoutes);

export {routes};