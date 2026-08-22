/**
 * Dinheiro no ecrã.
 *
 * `formatPrice` existe para tabelas de preços, onde zero quer mesmo dizer
 * "gratuito". Nas contas do mês essa mesma tradução mente — "Despesas:
 * Gratuito" não quer dizer nada —, por isso há um segundo formatador. É fácil
 * trocá-los sem dar por nada, e estes testes marcam a diferença.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatMoney, formatPrice } from "./money.ts";
import { instagramHandle, instagramUrl } from "./social.ts";

/** O espaço fino do euro varia entre plataformas: comparar só os dígitos. */
function digitos(texto: string): string {
  return texto.replace(/[\s  ]/g, "");
}

describe("dinheiro", () => {
  it("um zero numa conta é zero, e não 'gratuito'", () => {
    assert.equal(formatPrice(0), "Gratuito", "na tabela de preços continua a ser gratuito");
    assert.equal(digitos(formatMoney(0)), "0,00€");
  });

  it("não inventa um zero negativo", () => {
    // Negar um total de despesas vazio dá -0, e o Intl escreve "-0,00 €".
    assert.equal(digitos(formatMoney(-0)), "0,00€");
    assert.equal(digitos(formatMoney(-0 / 100)), "0,00€");
  });

  it("guarda o sinal quando há mesmo um valor negativo", () => {
    assert.match(formatMoney(-9530), /9.?530|95,30/);
    assert.ok(formatMoney(-9530).includes("-") || formatMoney(-9530).includes("−"));
  });

  it("trata a ausência de valor como zero", () => {
    assert.equal(digitos(formatMoney(null)), "0,00€");
    assert.equal(digitos(formatMoney(undefined)), "0,00€");
  });

  it("converte cêntimos em euros", () => {
    assert.equal(digitos(formatMoney(15050)), "150,50€");
    assert.equal(digitos(formatMoney(1)), "0,01€");
  });
});

describe("instagram", () => {
  it("aceita as três formas que as pessoas escrevem", () => {
    // O campo do perfil é livre, e todas estas aparecem lá.
    for (const escrito of [
      "anasousa.nails",
      "@anasousa.nails",
      "instagram.com/anasousa.nails",
      "https://www.instagram.com/anasousa.nails",
      "https://instagram.com/anasousa.nails/",
      "https://instagram.com/anasousa.nails?igshid=abc",
    ]) {
      assert.equal(instagramUrl(escrito), "https://instagram.com/anasousa.nails", escrito);
    }
  });

  it("não inventa um link a partir de lixo", () => {
    for (const escrito of ["", "   ", null, undefined, "não tenho", "a@b.pt", "http://"]) {
      assert.equal(instagramUrl(escrito), null, String(escrito));
    }
  });

  it("não deixa escapar para outro domínio", () => {
    // "instagram.com.outro-site.pt/x" não é o Instagram.
    assert.equal(instagramUrl("instagram.com.outro-site.pt/perfil"), null);
    assert.equal(instagramUrl("outro-site.pt/anasousa"), null);
  });

  it("mostra o nome com arroba", () => {
    assert.equal(instagramHandle("https://instagram.com/anasousa.nails"), "@anasousa.nails");
    assert.equal(instagramHandle(""), null);
  });
});
