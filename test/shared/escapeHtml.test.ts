import { escapeHtml } from "../../src/shared/escapeHtml";

describe("Unitário: escapeHtml", () => {
    it("Deve transformar os caracteres especiais do HTML em texto", () => {
        expect(escapeHtml('<a href="https://site-falso.com">Clique</a>')).toBe("&lt;a href=&quot;https://site-falso.com&quot;&gt;Clique&lt;/a&gt;");
        expect(escapeHtml("D'Ávila")).toBe("D&#39;Ávila");
    });

    it("Deve escapar o & primeiro, sem escapar duas vezes", () => {
        expect(escapeHtml("Tom & Jerry <3")).toBe("Tom &amp; Jerry &lt;3");
    });

    it("Não deve alterar um texto comum", () => {
        expect(escapeHtml("João da Silva")).toBe("João da Silva");
    });
});
