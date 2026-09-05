import express from "express";
import cors from 'cors';
import cookieParser from "cookie-parser";
import swaggerUi from "swagger-ui-express";
import morgan from "morgan";

import { swaggerSpec } from "./config/swagger";
import { routes } from "./config/routes";

const server = express();

server.disable("x-powered-by");

server.set('trust proxy', 1);

server.use(cors({
  origin: (origin, callback) => {
    if (!origin || /^http:\/\/localhost(:\d+)?$/.test(origin)) {
      callback(null, true);
    } else if (process.env.URL_FRONT && origin === process.env.URL_FRONT) {
      callback(null, true);
    } else {
      callback(new Error("Bloqueado pela política de CORS"));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200, 
}));
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