import { z } from "zod";

export const passwordValidation = z
  .string()
  .min(8, "A senha deve ter no mínimo 8 caracteres")
  .max(64, "A senha deve ter no máximo 64 caracteres")
  .regex(/(?=.*[a-z])/, "A senha deve conter pelo menos uma letra minúscula")
  .regex(/(?=.*[A-Z])/, "A senha deve conter pelo menos uma letra maiúscula")
  .regex(/(?=.*\d)/, "A senha deve conter pelo menos um número")
  .regex(/(?=.*[@$!%*?&])/, "A senha deve conter pelo menos um caractere especial (@$!%*?&)");

