/**
 * Uma faixa que rola não pode ficar encostada ao que tem dentro.
 *
 * `overflow-x: auto` obriga o eixo vertical a acompanhar: o `visible` do outro
 * eixo passa a `auto` assim que um deles deixa de o ser. A partir daí, tudo o
 * que seja desenhado *fora* da caixa de um filho — o `ring` de um chip, o anel
 * de foco de um botão, uma sombra — fica cortado contra o limite.
 *
 * É a segunda vez que isto morde. Da primeira, o submenu do painel abria
 * inteiro no DOM e ninguém o via. Da segunda, os filtros da página de marcações
 * apareceram sem a metade de cima do contorno. Nenhuma das duas partiu nada:
 * a página desenha-se na mesma, só que errada.
 *
 * Não há como medir isto sem um navegador, mas dá para exigir a folga que o
 * evita: uma linha que rola na horizontal tem de ter espaço por dentro, em
 * cima e em baixo. As margens negativas (`-mx-1`, `-my-1`) devolvem depois o
 * alinhamento que a folga tirou.
 */

import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, sep } from "node:path";
import { describe, it } from "node:test";

function ficheiros(dir: string): string[] {
  const saida: string[] = [];
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) saida.push(...ficheiros(caminho));
    else if (nome.endsWith(".tsx")) saida.push(caminho);
  }
  return saida;
}

interface Achado {
  valor: string;
  origem: string;
  linha: number;
}

/** Cada `className="..."` literal do código, com a origem. */
function classes(): Achado[] {
  const achadas: Achado[] = [];
  for (const ficheiro of ficheiros("src")) {
    const linhas = readFileSync(ficheiro, "utf8").split("\n");
    linhas.forEach((texto, i) => {
      for (const m of texto.matchAll(/className="([^"]*)"/g)) {
        achadas.push({ valor: m[1], origem: ficheiro.split(sep).join("/"), linha: i + 1 });
      }
    });
  }
  return achadas;
}

function tokens(valor: string): string[] {
  return valor.split(/\s+/).filter(Boolean);
}

/**
 * Folga dos *dois* lados.
 *
 * Só em baixo não chega, e essa é a lição: o corte que deu origem a isto era
 * em cima, e a linha tinha `pb-1`. Uma rede que aceitasse `pb-1` sozinho
 * teria deixado passar exactamente o defeito que a motivou.
 */
function temFolgaVertical(valor: string): boolean {
  const tem = (prefixo: string) =>
    tokens(valor).some((t) => t.startsWith(`${prefixo}-`) && /\d/.test(t));
  return tem("p") || tem("py") || (tem("pt") && tem("pb"));
}

function rolaNaHorizontal(valor: string): boolean {
  return tokens(valor).includes("overflow-x-auto") && tokens(valor).includes("flex");
}

/**
 * A barra de separadores do painel é a excepção, e com motivo: o sublinhado do
 * separador activo é o `border-b` dele, e tem de assentar na linha que fecha o
 * cabeçalho. Uma folga em baixo descolava-o de lá. Fica com folga só em cima.
 *
 * Está escrita à mão de propósito — mexer-lhe faz o teste falhar, e obriga a
 * pensar outra vez em vez de a alargar por descuido.
 */
const EXCEPCOES = new Set(["scroll-soft mt-6 flex gap-1 overflow-x-auto pt-1"]);

describe("faixas que rolam na horizontal", () => {
  it("dão espaço por dentro ao que desenham fora da caixa", () => {
    // Só as linhas de itens: uma tabela larga não desenha nada fora de si e
    // acolchoá-la seria estragar o alinhamento por nada.
    const semFolga = classes()
      .filter((c) => rolaNaHorizontal(c.valor))
      .filter((c) => !EXCEPCOES.has(c.valor))
      .filter((c) => !temFolgaVertical(c.valor));

    assert.deepEqual(
      semFolga.map((c) => `${c.origem}:${c.linha} — ${c.valor}`),
      [],
      "sem folga vertical, o contorno e o anel de foco dos filhos ficam cortados",
    );
  });

  it("encontra mesmo as faixas que existem", () => {
    // Uma rede que não visse nenhuma linha passaria sempre, e não valia nada.
    const faixas = classes().filter((c) => rolaNaHorizontal(c.valor));
    assert.ok(faixas.length >= 3, `só encontrou ${faixas.length} faixas que rolam`);
  });

  it("não confunde folga vertical com folga horizontal", () => {
    for (const valor of [
      "flex overflow-x-auto py-1",
      "flex overflow-x-auto p-2",
      "flex overflow-x-auto pb-2 pt-1",
    ]) {
      assert.ok(temFolgaVertical(valor), `${valor} devia contar como folga`);
    }

    for (const valor of [
      "flex overflow-x-auto",
      "flex overflow-x-auto px-1",
      "flex overflow-x-auto mt-6",
      "flex overflow-x-auto -my-1",
      // O caso exacto que passou por aqui: folga só em baixo, corte em cima.
      "scroll-soft mb-6 flex gap-2 overflow-x-auto pb-1",
      "flex overflow-x-auto pt-1",
    ]) {
      assert.ok(!temFolgaVertical(valor), `${valor} não devia contar como folga`);
    }
  });
});
