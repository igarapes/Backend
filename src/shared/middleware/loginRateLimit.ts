import { rateLimit, MemoryStore } from "express-rate-limit";

export const loginRateLimitStore = new MemoryStore();

export const loginRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    skipSuccessfulRequests: true,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    store: loginRateLimitStore,
    message: { message: "Muitas tentativas de login. Tente novamente em alguns minutos." },
});
