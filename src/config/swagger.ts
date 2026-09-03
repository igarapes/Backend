import swaggerJSDoc from "swagger-jsdoc";

const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "API Sistema Igarapés",
      version: "1.0.0",
      description: "Documentação oficial da API com foco em segurança",
    },
    servers: [
      {
        url: "http://localhost:3000/api",
        description: "Servidor Local",
      },
    ],
  },
  apis: ["./src/**/*.routes.ts"], 
};

export const swaggerSpec = swaggerJSDoc(swaggerOptions);