/**
 * A janela sobreposta tem de continuar a fazer as três coisas certas.
 *
 * Nenhuma delas dá erro quando se perde: sem portal, a caixa fica presa a um
 * `overflow` ou a um `backdrop-blur` de um antepassado e aparece cortada; sem
 * prisão do Tab, o foco sai para campos que o utilizador não vê por baixo do
 * fundo escuro; sem devolução do foco, quem navega com o teclado acaba no
 * cimo do documento. A página desenha-se na mesma em todos os casos.
 *
 * Não há como montar o ecrã e medir isto sem um navegador. O que dá para
 * prender é a decisão que cada uma resolve, e — mais importante — que ninguém
 * volte a escrever uma quarta cópia da caixa em vez de usar esta.
 */

import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, sep } from "node:path";
import { describe, it } from "node:test";

const FONTE = readFileSync(join("src", "components", "Modal.tsx"), "utf8");

function ficheiros(dir: string): string[] {
  const saida: string[] = [];
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) saida.push(...ficheiros(caminho));
    else if (caminho.endsWith(".tsx")) saida.push(caminho);
  }
  return saida;
}

describe("janela sobreposta", () => {
  it("é desenhada fora da árvore", () => {
    assert.match(FONTE, /createPortal\(/);
    assert.match(FONTE, /document\.body/);
  });

  it("prende o Tab lá dentro", () => {
    assert.match(FONTE, /evento\.key !== "Tab"/, "o ciclo do Tab tem de ser tratado");
    assert.match(FONTE, /shiftKey/, "e nos dois sentidos");
    assert.match(FONTE, /preventDefault/);
  });

  it("devolve o foco a quem a abriu", () => {
    assert.match(FONTE, /anterior\.current = document\.activeElement/);
    assert.match(FONTE, /anterior\.current\?\.focus/);
  });

  it("põe o foco no conteúdo, e não no botão de fechar", () => {
    // O X é o primeiro elemento alcançável da caixa. Procurar a partir do
    // corpo evita que abrir um formulário comece com o foco em "fechar".
    assert.match(FONTE, /corpoRef\.current\?\.querySelector/);
  });

  it("trava o scroll da página por trás e repõe-no ao sair", () => {
    assert.match(FONTE, /document\.body\.style\.overflow = "hidden"/);
    assert.match(FONTE, /document\.body\.style\.overflow = overflowAnterior/);
  });

  it("fecha no mousedown do fundo, e não no click", () => {
    // Com `click`, arrastar de dentro para fora ao seleccionar texto fechava
    // a caixa e deitava fora o que estivesse escrito.
    assert.match(FONTE, /onMouseDown=/);
    assert.doesNotMatch(FONTE, /onClick=\{\(evento\) => \{\s*if \(evento\.target === evento\.currentTarget\)/);
  });

  it("é anunciada como diálogo", () => {
    assert.match(FONTE, /role="dialog"/);
    assert.match(FONTE, /aria-modal="true"/);
    assert.match(FONTE, /aria-labelledby=/);
  });
});

describe("quem monta caixas sobrepostas", () => {
  it("usa esta, em vez de escrever outra", () => {
    // O sinal de uma cópia à mão: `fixed inset-0` com um fundo escuro.
    const suspeitos = ficheiros("src")
      .filter((f) => !f.endsWith(`components${sep}Modal.tsx`))
      .filter((f) => {
        const texto = readFileSync(f, "utf8");
        return /fixed inset-0[^"]*bg-ink-950\//.test(texto);
      })
      .map((f) => f.split(sep).join("/"));

    assert.deepEqual(suspeitos, [], "há uma janela escrita à mão; use o Modal");
  });
});
