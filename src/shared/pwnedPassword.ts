import crypto from "crypto";

const PWNED_API_URL = "https://api.pwnedpasswords.com/range/";

export const PWNED_PASSWORD_MESSAGE = "Esta senha já apareceu em vazamentos de dados. Escolha outra senha.";

export async function isPasswordPwned(password: string): Promise<boolean> {
    const hash = crypto.createHash("sha1").update(password).digest("hex").toUpperCase();
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);

    try {
        const response = await fetch(`${PWNED_API_URL}${prefix}`, {
            headers: { "Add-Padding": "true" },
            signal: AbortSignal.timeout(3000),
        });

        if (!response.ok) {
            throw new Error(`Status ${response.status}`);
        }

        const body = await response.text();

        return body.split("\n").some((line) => {
            const [lineSuffix, count] = line.trim().split(":");
            return lineSuffix === suffix && Number(count) > 0;
        });
    } catch (error) {
        console.error("Não foi possível consultar a base de senhas vazadas:", error);
        return false;
    }
}
