import { generateCompliantPassword } from "../../src/shared/generatePassword";
import { passwordValidation } from "../../src/shared/passwordShema";

describe("Unitário: geração da senha provisória", () => {
    const senhas = Array.from({ length: 200 }, () => generateCompliantPassword());

    it("Deve gerar senhas com 12 caracteres", () => {
        senhas.forEach((senha) => expect(senha).toHaveLength(12));
    });

    it("Deve gerar senhas que passam na validação de senha forte", () => {
        senhas.forEach((senha) => expect(passwordValidation.safeParse(senha).success).toBe(true));
    });

    it("Não deve usar letras que se confundem com números ao copiar do e-mail", () => {
        senhas.forEach((senha) => expect(senha).not.toMatch(/[OlI]/));
    });

    it("Não deve repetir senhas nem seguir um padrão fixo", () => {
        expect(new Set(senhas).size).toBe(senhas.length);
        expect(new Set(senhas.map((senha) => senha.slice(0, 4))).size).toBeGreaterThan(1);
    });
});
