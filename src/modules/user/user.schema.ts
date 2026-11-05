import { z } from "zod";

import { passwordValidation } from "../../shared/passwordSchema.js";

export function isValidCPF(cpf: string) {
  const cleanCPF = cpf.replace(/[^\d]+/g, "");
  
  if (cleanCPF.length !== 11 || /^(\d)\1{10}$/.test(cleanCPF)) return false;
  
  let soma = 0, resto;
  for (let i = 1; i <= 9; i++) soma = soma + parseInt(cleanCPF.substring(i - 1, i)) * (11 - i);
  resto = (soma * 10) % 11;
  
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cleanCPF.substring(9, 10))) return false;
  
  soma = 0;
  for (let i = 1; i <= 10; i++) soma = soma + parseInt(cleanCPF.substring(i - 1, i)) * (12 - i);
  resto = (soma * 10) % 11;
  
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cleanCPF.substring(10, 11))) return false;
  
  return true;
}

// ALLOWED_EMAIL_DOMAINS=igarape.com.br,gmail.com → só esses domínios são aceitos.
// Sem a variável, qualquer domínio é aceito. Lida a cada validação para poder mudar sem reiniciar os testes.
export function isAllowedEmailDomain(email: string) {
  const allowedDomains = (process.env.ALLOWED_EMAIL_DOMAINS ?? "")
    .split(",")
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean);

  if (allowedDomains.length === 0) return true;

  const domain = email.split("@").pop()?.toLowerCase();
  return !!domain && allowedDomains.includes(domain);
}

const phoneRegex =/^[1-9]{2}(?:[2-8]|9[1-9])[0-9]{3}[0-9]{4}$/;

export const schemaCreate = z.object({
  name: z.string().min(3, "O nome deve ter no mínimo 3 caracteres").max(100, "O nome não pode exceder 100 caracteres"),
  email: z.string().max(255, "E-mail muito longo").email("Formato de e-mail inválido").refine(isAllowedEmailDomain, { message: "Domínio de e-mail não permitido." }),
  phone: z.string().max(11, "Telefone muito longo").regex(phoneRegex, "Telefone inválido. Envie apenas números com DDD."),
  cpf: z.string().refine((val) => isValidCPF(val), { message: "CPF inválido ou incorreto" }),
  role: z.enum(["ADMIN", "TECNICO", "USUARIO"], { message: "O perfil é obrigatório e deve ser válido." }),
  dataConsent: z.literal(true, { message: "O consentimento de dados é obrigatório." }),
});

export type CreateUserDTO = z.infer<typeof schemaCreate>;

export const schemaUpdate = schemaCreate
    .omit({ cpf: true, dataConsent: true })
    .extend({ password: passwordValidation }) 
    .partial(); 


export type UpdateUserDTO = z.infer<typeof schemaUpdate>;

export const schemaListQuery = z.object({
  page: z.coerce.number().int("A página deve ser um número inteiro").min(1, "A página deve ser no mínimo 1").default(1),
  limit: z.coerce.number().int("O limite deve ser um número inteiro").min(1, "O limite deve ser no mínimo 1").max(100, "O limite deve ser no máximo 100").default(10),
});

export type ListUsersQuery = z.infer<typeof schemaListQuery>;

export const schemaIdParam = z.object({
  id: z.string().uuid({ message: "O ID fornecido não é um formato de UUID válido." })
});