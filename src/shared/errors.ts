export class AppError extends Error {
    public readonly statusCode: number;

    constructor(message: string, statusCode = 400) {
        super(message);
        this.name = new.target.name;
        this.statusCode = statusCode;
    }
}

export class UnauthorizedError extends AppError {
    constructor(message = "Credenciais inválidas") {
        super(message, 401);
    }
}

export class ForbiddenError extends AppError {
    constructor(message: string) {
        super(message, 403);
    }
}

export class NotFoundError extends AppError {
    constructor(message = "Usuário não encontrado") {
        super(message, 404);
    }
}

export class ConflictError extends AppError {
    constructor(message = "Os dados informados (E-mail ou CPF) já estão em uso.") {
        super(message, 409);
    }
}
