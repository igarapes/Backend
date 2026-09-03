import express from "express";
import cookieParser from "cookie-parser";
import swaggerUi from "swagger-ui-express";
import morgan from "morgan";

import { swaggerSpec } from "./config/swagger";
import { routes } from "./config/routes";

const server = express();

server.disable("x-powered-by");

server.use(express.json());
server.use(cookieParser());

server.use(morgan("dev"));

server.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

server.use("/api", routes);
const port = process.env.PORT;

if (process.env.NODE_ENV !== "test") {
    server.listen(port, () => {
        console.log(`Servidor rodando http://localhost:${port}`);
    });
}

export {server}