/**
 * Os filtros somam-se.
 *
 * Nasceu de um pedido que era, no fundo, um relato de erro: com o filtro de
 * manicure activo, carregar em "usar a minha localização" mostrava toda a
 * gente da zona — a categoria tinha desaparecido. Cada caixa de pesquisa
 * montava os parâmetros de raiz e deitava fora o que não era seu.
 *
 * É uma perda silenciosa: não rebenta nada, só devolve outra lista. Por isso
 * a junção vive em funções puras e está presa aqui.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { camposASeguir, pesquisaEscrita, pesquisaPorLocalizacao } from "./search.ts";

/** Um objecto simples, mais fácil de comparar que uma query string. */
function mapa(params: URLSearchParams): Record<string, string> {
  return Object.fromEntries(params.entries());
}

describe("pesquisa pela localização do dispositivo", () => {
  it("mantém os filtros que já estavam", () => {
    const saida = pesquisaPorLocalizacao(
      "category=manicure&at_home=1&radius_km=25&featured=1&max_price_cents=3000",
      { city: "Porto", lat: "41.157900", lng: "-8.629100" },
    );
    assert.equal(saida.get("category"), "manicure", "a categoria não pode desaparecer");
    assert.equal(saida.get("at_home"), "1");
    assert.equal(saida.get("radius_km"), "25");
    assert.equal(saida.get("featured"), "1");
    assert.equal(saida.get("max_price_cents"), "3000");
    assert.equal(saida.get("city"), "Porto");
    assert.equal(saida.get("lat"), "41.157900");
  });

  it("sugere ordenar por distância quando ninguém escolheu ordem", () => {
    assert.equal(
      pesquisaPorLocalizacao("", { lat: "1", lng: "2" }).get("sort"),
      "distance",
    );
    assert.equal(
      pesquisaPorLocalizacao("sort=relevance", { lat: "1", lng: "2" }).get("sort"),
      "distance",
      "a ordem por omissão não é uma escolha",
    );
  });

  it("não pisa uma ordenação escolhida de propósito", () => {
    for (const ordem of ["rating", "price", "newest"]) {
      assert.equal(
        pesquisaPorLocalizacao(`sort=${ordem}`, { lat: "1", lng: "2" }).get("sort"),
        ordem,
      );
    }
  });

  it("substitui a localidade anterior em vez de a acumular", () => {
    const saida = pesquisaPorLocalizacao("city=Braga&lat=41.5&lng=-8.4", {
      city: "Porto",
      lat: "41.157900",
      lng: "-8.629100",
    });
    assert.deepEqual(saida.getAll("city"), ["Porto"]);
    assert.equal(saida.get("lat"), "41.157900");
  });

  it("sem localidade reconhecida, fica só com as coordenadas", () => {
    // No meio do Atlântico não há localidade nossa: o nome antigo tem de sair,
    // senão a pesquisa mostrava a zona errada com o rótulo certo.
    const saida = pesquisaPorLocalizacao("city=Braga", { lat: "30", lng: "-40" });
    assert.equal(saida.has("city"), false);
    assert.equal(saida.get("lat"), "30");
  });

  it("recomeça a paginação", () => {
    assert.equal(
      pesquisaPorLocalizacao("page=3&category=tatuagem", { lat: "1", lng: "2" }).has("page"),
      false,
    );
  });
});

describe("pesquisa escrita", () => {
  it("mantém os filtros da coluna lateral", () => {
    const saida = pesquisaEscrita("category=tatuagem&at_home=1&sort=rating&featured=1", {
      q: "sombreado",
      city: "Braga",
    });
    assert.deepEqual(mapa(saida), {
      category: "tatuagem",
      at_home: "1",
      sort: "rating",
      featured: "1",
      q: "sombreado",
      city: "Braga",
    });
  });

  it("escrever a localidade manda mais que as coordenadas antigas", () => {
    // As coordenadas ganham à localidade na resolução do local: se ficassem,
    // escrever "Braga" depois de detetar o Porto não mudava nada.
    const saida = pesquisaEscrita("city=Porto&lat=41.15&lng=-8.62&sort=distance", {
      city: "Braga",
    });
    assert.equal(saida.get("city"), "Braga");
    assert.equal(saida.has("lat"), false);
    assert.equal(saida.has("lng"), false);
  });

  it("um campo esvaziado apaga o filtro em vez de o deixar preso", () => {
    const saida = pesquisaEscrita("q=manicure&city=Porto&category=manicure", {
      q: "",
      city: "  ",
    });
    assert.equal(saida.has("q"), false);
    assert.equal(saida.has("city"), false);
    assert.equal(saida.get("category"), "manicure", "limpar o texto não limpa os filtros");
  });

  it("ignora espaços à volta do que se escreveu", () => {
    const saida = pesquisaEscrita("", { q: "  tatuagem  ", city: " Braga " });
    assert.equal(saida.get("q"), "tatuagem");
    assert.equal(saida.get("city"), "Braga");
  });

  it("recomeça a paginação", () => {
    assert.equal(pesquisaEscrita("page=5", { q: "unhas" }).has("page"), false);
  });
});

describe("os campos seguem o endereço", () => {
  it("esvazia as caixas quando a pesquisa é limpa", () => {
    // O caso que deu origem a isto: "Limpar pesquisa" apagava o endereço e as
    // caixas ficavam com o texto antigo, como se ainda estivessem a filtrar.
    assert.deepEqual(
      camposASeguir({ q: "manicure", city: "Braga" }, { q: "", city: "" }),
      { q: "", city: "" },
    );
  });

  it("não toca no que a pessoa está a escrever", () => {
    // Escolher uma categoria na coluna ao lado muda o endereço, mas não o
    // termo nem a localidade: as caixas ficam como estão.
    assert.deepEqual(camposASeguir({ q: "manicure" }, { q: "manicure" }), {});
    assert.deepEqual(
      camposASeguir({ q: "manicure", city: "Braga" }, { q: "manicure", city: "Braga" }),
      {},
    );
  });

  it("escreve a localidade que a deteção encontrou", () => {
    assert.deepEqual(camposASeguir({ city: "" }, { city: "Porto" }), { city: "Porto" });
  });

  it("mexe só no campo que mudou", () => {
    assert.deepEqual(
      camposASeguir({ q: "unhas", city: "Braga" }, { q: "unhas", city: "Porto" }),
      { city: "Porto" },
    );
  });

  it("trata ausência e vazio como a mesma coisa", () => {
    // O endereço não distingue "sem q" de "q=": as caixas também não podem.
    assert.deepEqual(camposASeguir({}, { q: "", city: "" }), {});
    assert.deepEqual(camposASeguir({ q: "", city: "" }, {}), {});
  });
});
