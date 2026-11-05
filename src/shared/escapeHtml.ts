// Impede que um texto vindo do usuário (ex.: o nome) vire HTML de verdade dentro do e-mail.
// O "&" precisa ser trocado primeiro, senão os "&" das outras trocas seriam escapados de novo.
export function escapeHtml(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
