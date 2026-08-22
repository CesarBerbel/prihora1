/**
 * As duas metades do site nao se podem misturar.
 *
 * O menu de cada area e a sua chamada para accao saem daqui, e e facil um
 * caminho novo cair no lado errado sem que nada falhe na compilacao. Estes
 * testes fixam a regra: quem esta do lado do cliente nunca ve o registo de
 * profissional, e quem esta do lado profissional nunca ve a pesquisa.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { CHAMADA, INICIO, MENU, areaDaRota, estaAtivo, mostraMenuPublico } from "./areas.ts";

describe("areas do site", () => {
  it("poe as rotas de vitrine do lado certo", () => {
    for (const caminho of ["/", "/buscar", "/como-funciona", "/p/ana-sousa", "/agendamento", "/cadastro", "/entrar", "/minha-conta"]) {
      assert.equal(areaDaRota(caminho), "cliente", caminho);
    }
    for (const caminho of ["/para-profissionais", "/para-profissionais/como-funciona", "/para-profissionais/registo", "/planos", "/painel", "/painel/agenda"]) {
      assert.equal(areaDaRota(caminho), "profissional", caminho);
    }
  });

  it("nao deixa um prefixo parecido roubar a area", () => {
    // "/planosaurio" nao e "/planos".
    assert.equal(areaDaRota("/planosaurio"), "cliente");
    assert.equal(areaDaRota("/painelada"), "cliente");
    // A barra final nao muda nada.
    assert.equal(areaDaRota("/planos/"), "profissional");
  });

  it("nao mostra a pesquisa de clientes do lado profissional", () => {
    const hrefs = MENU.profissional.map((item) => item.href);
    assert.ok(!hrefs.includes("/buscar"));
    assert.ok(hrefs.includes("/planos"), "os planos vivem do lado profissional");
    assert.ok(hrefs.includes("/para-profissionais/como-funciona"));
  });

  it("nao mostra o registo de profissional do lado do cliente", () => {
    assert.equal(CHAMADA.cliente, null);
    assert.equal(CHAMADA.profissional?.href, "/para-profissionais/registo");

    const hrefs = MENU.cliente.map((item) => item.href);
    assert.deepEqual(hrefs, [
      "/buscar",
      "/agendamento",
      "/como-funciona",
      "/para-profissionais",
    ]);
  });

  it("da a cada area exactamente uma saida para a outra", () => {
    for (const area of ["cliente", "profissional"] as const) {
      const trocas = MENU[area].filter((item) => item.troca);
      assert.equal(trocas.length, 1, `${area} precisa de uma ponte para o outro lado`);
      assert.notEqual(areaDaRota(trocas[0].href), area, `a ponte de ${area} tem de sair da area`);
    }
  });

  it("manda o logotipo para o inicio da area onde se esta", () => {
    assert.equal(areaDaRota(INICIO.cliente), "cliente");
    assert.equal(areaDaRota(INICIO.profissional), "profissional");
  });

  it("esconde o menu de vitrine dentro do produto", () => {
    assert.equal(mostraMenuPublico("/painel"), false);
    assert.equal(mostraMenuPublico("/painel/agenda"), false);
    assert.equal(mostraMenuPublico("/admin/planos"), false);
    assert.equal(mostraMenuPublico("/"), true);
    assert.equal(mostraMenuPublico("/para-profissionais"), true);
  });

  it("marca como activo so o item em que se esta", () => {
    assert.equal(estaAtivo("/", "/"), true);
    // A raiz nao pode acender em todas as paginas.
    assert.equal(estaAtivo("/buscar", "/"), false);
    assert.equal(estaAtivo("/buscar?q=manicure".split("?")[0], "/buscar"), true);
    assert.equal(estaAtivo("/para-profissionais/como-funciona", "/para-profissionais/como-funciona"), true);
    assert.equal(estaAtivo("/planosaurio", "/planos"), false);
  });
});
