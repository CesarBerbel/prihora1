/**
 * Guarda contra ligacoes para paginas que nao existem.
 *
 * Nasceu de um erro real: uma passagem automatica de texto reescreveu
 * `/buscar` para `/procurar` dentro de template literals, e a pesquisa passou
 * a levar a uma pagina inexistente sem que nada falhasse na compilacao. O
 * TypeScript nao verifica rotas: sao apenas strings.
 */

import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, sep } from "node:path";
import { describe, it } from "node:test";

const APP = join("src", "app");

/** Rotas que existem de facto, lidas da arvore de ficheiros. */
function rotasExistentes(dir: string = APP, prefixo = ""): string[] {
  const encontradas: string[] = [];
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (!statSync(caminho).isDirectory()) {
      if (nome === "page.tsx") encontradas.push(prefixo || "/");
      continue;
    }
    // Pastas entre parenteses sao grupos: nao entram no caminho publico.
    const segmento = nome.startsWith("(") ? "" : `/${nome}`;
    encontradas.push(...rotasExistentes(caminho, prefixo + segmento));
  }
  return encontradas;
}

function ficheiros(dir: string): string[] {
  const saida: string[] = [];
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) saida.push(...ficheiros(caminho));
    else if (nome.endsWith(".tsx") || nome.endsWith(".ts")) saida.push(caminho);
  }
  return saida;
}

/** Rotas internas citadas no codigo, com a origem para a mensagem de erro. */
function rotasCitadas(): { rota: string; origem: string }[] {
  const padroes = [
    /href=\{?[`"']([^`"'{}]*)[`"']/g,
    /router\.(?:push|replace)\(\s*[`"']([^`"']*)[`"']/g,
  ];
  const achadas: { rota: string; origem: string }[] = [];

  for (const ficheiro of ficheiros("src")) {
    if (ficheiro.endsWith(".test.ts")) continue;
    const conteudo = readFileSync(ficheiro, "utf8");

    for (const padrao of padroes) {
      for (const m of conteudo.matchAll(padrao)) {
        const bruto = m[1];
        // So interessam caminhos internos.
        if (!bruto.startsWith("/") || bruto.startsWith("//")) continue;
        // Recursos servidos como ficheiro, nao paginas.
        if (/\.(svg|png|jpe?g|ico|webmanifest)$/.test(bruto)) continue;

        const semQuery = bruto.split("?")[0].split("#")[0];
        achadas.push({ rota: semQuery || "/", origem: ficheiro.split(sep).join("/") });
      }
    }
  }
  return achadas;
}

/** Um caminho citado corresponde a um padrao de rota? */
function corresponde(citada: string, padrao: string): boolean {
  const a = citada.split("/").filter(Boolean);
  const b = padrao.split("/").filter(Boolean);
  if (a.length !== b.length) return false;

  return b.every((segmento, i) => {
    // Segmento dinamico da pasta: [slug] aceita qualquer valor.
    if (segmento.startsWith("[")) return true;
    // Interpolacao no codigo: `/p/${slug}` so encaixa em segmento dinamico.
    if (a[i].includes("${")) return false;
    return segmento === a[i];
  });
}

describe("rotas internas", () => {
  const existentes = rotasExistentes();

  it("a arvore de paginas foi lida", () => {
    assert.ok(existentes.length > 10, `so foram encontradas ${existentes.length} rotas`);
    assert.ok(existentes.includes("/buscar"), "a pagina de pesquisa tem de existir");
    assert.ok(existentes.includes("/p/[slug]"), "o perfil publico tem de existir");
  });

  it("todas as ligacoes apontam para paginas que existem", () => {
    const quebradas = rotasCitadas().filter(({ rota }) => {
      // `/p/${slug}` encaixa em /p/[slug]; comparamos por padrao.
      const alvo = rota.replace(/\$\{[^}]*\}/g, "[dyn]");
      return !existentes.some((padrao) => corresponde(alvo, padrao));
    });

    const detalhe = quebradas.map((q) => `${q.rota} (em ${q.origem})`).join("\n  ");
    assert.equal(quebradas.length, 0, `ligacoes para paginas inexistentes:\n  ${detalhe}`);
  });

  it("as ancoras internas apontam para um id que existe", () => {
    // Mesma classe de erro das rotas: a reescrita de texto trocou `#agendar`
    // por `#marcar` no botao e deixou o id por mudar. Nada falhava.
    const partidas: string[] = [];

    for (const ficheiro of ficheiros("src")) {
      if (ficheiro.endsWith(".test.ts")) continue;
      const conteudo = readFileSync(ficheiro, "utf8");

      for (const m of conteudo.matchAll(/href="#([a-z0-9-]+)"/g)) {
        const alvo = m[1];
        // O id pode viver noutro ficheiro da mesma pagina; procuramos em todos.
        const existe = ficheiros("src").some((outro) =>
          readFileSync(outro, "utf8").includes(`id="${alvo}"`),
        );
        if (!existe) partidas.push(`#${alvo} (em ${ficheiro.split(sep).join("/")})`);
      }
    }

    assert.equal(partidas.length, 0, `ancoras sem destino: ${partidas.join(" | ")}`);
  });

  it("a pesquisa leva mesmo para a pagina de pesquisa", () => {
    const barra = readFileSync("src/components/SearchBar.tsx", "utf8");
    const destinos = [...barra.matchAll(/router\.push\(`([^`]*)`/g)].map((m) => m[1]);

    assert.ok(destinos.length >= 2, "a barra deve navegar por texto e por localizacao");
    for (const destino of destinos) {
      assert.ok(
        destino.startsWith("/buscar?"),
        `a barra de pesquisa aponta para ${destino}`,
      );
    }
  });
});
