/**
 * Testes da matematica do recorte. Rodam no test runner nativo do Node,
 * sem nenhuma dependencia extra:  npm test
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  baseScale,
  centeredOffset,
  clampAxis,
  clampOffset,
  cropRect,
  drawnSize,
} from "./crop.ts";

const VIEW = 288;

/** Compara numeros de ponto flutuante com tolerancia. */
function perto(atual: number, esperado: number, mensagem?: string) {
  assert.ok(
    Math.abs(atual - esperado) < 1e-6,
    mensagem ?? `esperava ~${esperado}, veio ${atual}`,
  );
}

describe("baseScale", () => {
  it("faz o menor lado caber exatamente na janela", () => {
    // Paisagem: a altura e o lado limitante.
    const scale = baseScale({ width: 1200, height: 600 }, VIEW);
    perto(600 * scale, VIEW);
    assert.ok(1200 * scale > VIEW, "a largura deve sobrar para os lados");
  });

  it("trata retrato pelo mesmo criterio", () => {
    const scale = baseScale({ width: 600, height: 1200 }, VIEW);
    perto(600 * scale, VIEW);
  });

  it("nao divide por zero em imagem degenerada", () => {
    assert.equal(baseScale({ width: 0, height: 0 }, VIEW), 1);
  });
});

describe("clampAxis", () => {
  const drawn = 576; // imagem com o dobro da janela

  it("nao deixa arrastar para depois da borda esquerda", () => {
    assert.equal(clampAxis(50, drawn, VIEW), 0);
  });

  it("nao deixa arrastar para antes da borda direita", () => {
    assert.equal(clampAxis(-999, drawn, VIEW), VIEW - drawn);
  });

  it("mantem posicoes validas intactas", () => {
    assert.equal(clampAxis(-100, drawn, VIEW), -100);
  });

  it("centraliza quando a imagem e menor que a janela", () => {
    perto(clampAxis(-40, 200, VIEW), (VIEW - 200) / 2);
  });
});

describe("cropRect", () => {
  it("sem zoom, pega a faixa central de uma imagem deitada", () => {
    // 1200x600 centralizada: o recorte deve ser o quadrado 600x600 do meio.
    const natural = { width: 1200, height: 600 };
    const offset = centeredOffset(natural, VIEW);
    const rect = cropRect(natural, VIEW, 1, offset);

    perto(rect.size, 600);
    perto(rect.sx, 300);
    perto(rect.sy, 0);
  });

  it("sem zoom, pega a faixa central de uma imagem em pe", () => {
    const natural = { width: 600, height: 1200 };
    const rect = cropRect(natural, VIEW, 1, centeredOffset(natural, VIEW));

    perto(rect.size, 600);
    perto(rect.sx, 0);
    perto(rect.sy, 300);
  });

  it("imagem ja quadrada e aproveitada por inteiro", () => {
    const natural = { width: 900, height: 900 };
    const rect = cropRect(natural, VIEW, 1, centeredOffset(natural, VIEW));

    perto(rect.size, 900);
    perto(rect.sx, 0);
    perto(rect.sy, 0);
  });

  it("zoom aproxima: recorta uma area menor da imagem", () => {
    const natural = { width: 1000, height: 1000 };
    const semZoom = cropRect(natural, VIEW, 1, centeredOffset(natural, VIEW));
    const comZoom = cropRect(natural, VIEW, 2, centeredOffset(natural, VIEW, 2));

    perto(semZoom.size, 1000);
    perto(comZoom.size, 500);
    // Continua centralizado: sobra a mesma margem dos dois lados.
    perto(comZoom.sx, 250);
    perto(comZoom.sy, 250);
  });

  it("arrastar ate o limite esquerdo mostra a borda esquerda da imagem", () => {
    const natural = { width: 1200, height: 600 };
    const rect = cropRect(natural, VIEW, 1, { x: 0, y: 0 });

    perto(rect.sx, 0, "deve comecar no primeiro pixel da imagem");
  });

  it("arrastar ate o limite direito mostra a borda direita da imagem", () => {
    const natural = { width: 1200, height: 600 };
    // Um arrasto exagerado para a esquerda, que o clamp precisa segurar.
    const rect = cropRect(natural, VIEW, 1, { x: -99999, y: 0 });

    perto(rect.sx + rect.size, natural.width);
  });

  it("nunca pede pixel fora da imagem, em nenhuma combinacao", () => {
    const tamanhos = [
      { width: 4032, height: 3024 }, // foto de celular deitada
      { width: 3024, height: 4032 }, // a mesma, em pe
      { width: 640, height: 480 },
      { width: 1080, height: 1080 },
      { width: 200, height: 1500 }, // panoramica extrema
    ];
    const zooms = [1, 1.37, 2, 3.5, 4];
    const arrastos = [-100000, -500, -1, 0, 1, 500, 100000];

    for (const natural of tamanhos) {
      for (const zoom of zooms) {
        for (const x of arrastos) {
          for (const y of arrastos) {
            const rect = cropRect(natural, VIEW, zoom, { x, y });

            assert.ok(rect.sx >= 0, "sx negativo");
            assert.ok(rect.sy >= 0, "sy negativo");
            assert.ok(rect.size > 0, "recorte vazio");
            assert.ok(
              rect.sx + rect.size <= natural.width + 1e-9,
              `estourou a largura em ${natural.width}x${natural.height} zoom ${zoom}`,
            );
            assert.ok(
              rect.sy + rect.size <= natural.height + 1e-9,
              `estourou a altura em ${natural.width}x${natural.height} zoom ${zoom}`,
            );
          }
        }
      }
    }
  });

  it("o recorte corresponde ao que a janela mostra", () => {
    // Invariante central: mapear o canto da janela pela transformacao usada na
    // tela tem de cair no mesmo ponto que o recorte informa.
    const natural = { width: 1600, height: 900 };
    const zoom = 1.8;
    const offset = clampOffset({ x: -420, y: -160 }, natural, VIEW, zoom);

    const drawn = drawnSize(natural, VIEW, zoom);
    const scale = drawn.width / natural.width;

    const rect = cropRect(natural, VIEW, zoom, offset);

    // Canto superior esquerdo da janela, convertido para coordenadas da imagem.
    assert.ok(Math.abs(rect.sx - -offset.x / scale) < 1e-9);
    assert.ok(Math.abs(rect.sy - -offset.y / scale) < 1e-9);
    // E o lado da janela, na mesma escala.
    assert.ok(Math.abs(rect.size - VIEW / scale) < 1e-9);
  });
});
