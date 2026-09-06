import { z } from "zod";

function isValidCPF(cpf: string) {
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

const phoneRegex = /^[1-9]{2}(?:[2-8]|9[1-9])[0-9]{3}[0-9]{4}$/;

export const schemaCreate = z.object({
    name: z.string().min(3, "O nome deve ter no mínimo 3 caracteres").max(100, "O nome não pode exceder 100 caracteres"),
    email: z.string().max(255, "E-mail muito longo").email("Formato de e-mail inválido"),
    phone: z.string().max(11, "Telefone muito longo").regex(phoneRegex, "Telefone inválido. Envie apenas números com DDD."),
    cpf: z.string().refine((val) => isValidCPF(val), { message: "CPF inválido ou incorreto" }),
    role: z.enum(["ADMIN", "TECNICO", "USUARIO"], { message: "O perfil é obrigatório e deve ser válido." }),
});

export type CreateUserDTO = z.infer<typeof schemaCreate>;

const passwordValidation = z
  .string()
  .min(8, "A senha deve ter no mínimo 8 caracteres")
  .regex(/(?=.*[a-z])/, "A senha deve conter pelo menos uma letra minúscula")
  .regex(/(?=.*[A-Z])/, "A senha deve conter pelo menos uma letra maiúscula")
  .regex(/(?=.*\d)/, "A senha deve conter pelo menos um número")
  .regex(/(?=.*[@$!%*?&])/, "A senha deve conter pelo menos um caractere especial (@$!%*?&)");


export const schemaUpdate = schemaCreate
    .omit({ cpf: true, role: true }) 
    .extend({ password: passwordValidation }) 
    .partial(); 


export type UpdateUserDTO = z.infer<typeof schemaUpdate>;