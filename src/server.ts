import "dotenv/config";
import express from "express";
import cors from 'cors';
import helmet from "helmet";
import cookieParser from "cookie-parser";
import swaggerUi from "swagger-ui-express";
import morgan from "morgan";

import { swaggerSpec } from "./config/swagger.js";
import { routes } from "./config/routes.js";
import { requireHttps } from "./shared/middleware/requireHttps.js";

const server = express();
const isProduction = process.env.NODE_ENV === "production";

server.use(helmet());

if (isProduction) {
    server.set('trust proxy', 1);
    server.use(requireHttps);
}

server.use(cors({
  origin: (origin, callback) => {
    if (!origin || (!isProduction && /^http:\/\/localhost(:\d+)?$/.test(origin))) {
      callback(null, true);
    } else if (process.env.URL_FRONT && origin === process.env.URL_FRONT) {
      callback(null, true);
    } else {
      callback(null, false);
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