import { z } from "zod";

import { passwordValidation } from "../../shared/passwordSchema.js";

export const schemaLogin = z.object({
    identifier: z
      .string()
      .trim()
      .max(255, "O identificador deve ter no máximo 255 caracteres")
      .min(11, "O identificador deve ter no mínimo 11 caracteres"),
    password: z.
      string()
      .trim()
      .max(255, "A senha deve ter no máximo 255 caracteres")
      .min(8, "A senha deve ter no mínimo 8 caracteres"),
})

export const schemaChangePassword = z.object({
  newPassword: passwordValidation,
  confirmPassword: z.string().min(1, "A confirmação de senha é obrigatória").max(64, "A senha deve ter no máximo 64 caracteres"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});