import crypto from "crypto";

const PASSWORD_LENGTH = 12;

const letrasMaiusculas = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const letrasMinusculas = "abcdefghijkmnopqrstuvwxyz";
const numeros = "0123456789";
const caracteresEspeciais = "@$!%*?&";

const todosOsCaracteres = letrasMaiusculas + letrasMinusculas + numeros + caracteresEspeciais;

function sortearCaractere(caracteres: string): string {
    return caracteres[crypto.randomInt(caracteres.length)]!;
}

function embaralhar(caracteres: string[]): string[] {
    for (let i = caracteres.length - 1; i > 0; i--) {
        const j = crypto.randomInt(i + 1);
        [caracteres[i], caracteres[j]] = [caracteres[j]!, caracteres[i]!];
    }
    return caracteres;
}

export function generateCompliantPassword(): string {
    const senha = [
        sortearCaractere(letrasMaiusculas),
        sortearCaractere(letrasMinusculas),
        sortearCaractere(numeros),
        sortearCaractere(caracteresEspeciais),
    ];

    while (senha.length < PASSWORD_LENGTH) {
        senha.push(sortearCaractere(todosOsCaracteres));
    }

    return embaralhar(senha).join("");
}
