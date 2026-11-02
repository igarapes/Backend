import crypto from "crypto";

export function hashCpf(cpf:string): string {
    const key = process.env.DATA_SALT;
    if(!key){
        throw new Error("DATA_SALT não configurado");
    }
    const clean = cpf.replace(/\D/g, "");
    return crypto.createHmac("sha256", key).update(clean).digest("hex");
}