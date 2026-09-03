import { z } from "zod";

export const schemaLogin = z.object({
    identifier: z
      .string()
      .trim()
      .max(255, "Oidentificador deve ter no máximo 255 caracteres")
      .min(11, "O identificador deve ter no mínimo 11 caracteres"),
    password: z.
      string()
      .trim()
      .max(255, "A senha deve ter no máximo 255 caracteres")
      .min(8, "A senha deve ter no mínimo 8 caracteres"),
})

const passwordValidation = z
  .string()
  .min(8, "A senha deve ter no mínimo 8 caracteres")
  .regex(/(?=.*[a-z])/, "A senha deve conter pelo menos uma letra minúscula")
  .regex(/(?=.*[A-Z])/, "A senha deve conter pelo menos uma letra maiúscula")
  .regex(/(?=.*\d)/, "A senha deve conter pelo menos um número")
  .regex(/(?=.*[@$!%*?&])/, "A senha deve conter pelo menos um caractere especial (@$!%*?&)");

export const schemaChangePassword = z.object({
  newPassword: passwordValidation,
  confirmPassword: z.string().min(1, "A confirmação de senha é obrigatória"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});