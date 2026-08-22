/**
 * O menu do crachá não pode voltar para dentro do cabeçalho.
 *
 * Nasceu de um erro real e invisível, no submenu que o painel tinha antes: a
 * barra de separadores tinha `overflow-x-auto` para rolar em ecrãs estreitos,
 * e o CSS obriga o eixo vertical a acompanhar — `overflow-y: visible` passa a
 * `auto` assim que o outro eixo deixa de ser visível. Tudo o que passasse do
 * fundo ficava cortado. O menu abria, existia no DOM, e ninguém o via nem lhe
 * conseguia carregar.
 *
 * O crachá corre o mesmo risco por outro motivo: o cabeçalho tem
 * `backdrop-blur`, e um filtro faz de bloco de contenção para o que está
 * dentro dele. Um menu posicionado ali ficaria preso ao cabeçalho.
 *
 * Não há aqui como montar o ecrã e medir: o defeito é de CSS e só aparece num
 * navegador a sério. O que dá para prender é a decisão que o resolve — o menu
 * ser desenhado fora da árvore — e o motivo pelo qual ela existe.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import { CONTA, accountItems } from "./AccountNav.ts";
import { PANEL_NAV } from "./PanelNav.ts";

const FONTE = readFileSync(join("src", "components", "UserBadge.tsx"), "utf8");
const MOLDURA = readFileSync(join("src", "components", "AccountShell.tsx"), "utf8");

describe("menu do crachá", () => {
  it("é desenhado fora da árvore, e não dentro do cabeçalho", () => {
    assert.match(
      FONTE,
      /createPortal\(/,
      "sem portal, o backdrop-blur do cabeçalho prende e corta o menu",
    );
    assert.match(FONTE, /document\.body/, "o portal tem de sair para fora do cabeçalho");
  });

  it("continua a ser posicionado em coordenadas do ecrã", () => {
    assert.match(FONTE, /className="fixed/, "o menu solto precisa de posição fixa");
    assert.match(FONTE, /getBoundingClientRect/, "a posição vem do crachá que o abre");
  });

  it("abre ao passar o rato e deixa atravessar até ele", () => {
    assert.match(FONTE, /onMouseEnter/, "tem de abrir com o rato em cima");
    // Entre o crachá e o menu há uma frincha: sem atraso no fecho, o menu
    // fugia a meio do caminho do rato.
    assert.match(FONTE, /setTimeout\(\(\) => setCaixa\(null\), ATRASO_MS\)/);
    assert.match(FONTE, /onMouseEnter=\{cancelarFecho\}/, "o menu tem de segurar-se sozinho");
  });

  it("não fecha antes de o clique chegar à ligação", () => {
    assert.match(
      FONTE,
      /menuRef\.current\?\.contains/,
      "o teste de clique-fora tem de conhecer também o menu",
    );
  });

  it("fecha com Escape e ao carregar fora", () => {
    assert.match(FONTE, /"Escape"/);
    assert.match(FONTE, /addEventListener\("mousedown"/);
  });

  it("acompanha o crachá quando a página rola", () => {
    assert.match(FONTE, /addEventListener\("scroll"/);
    assert.match(FONTE, /addEventListener\("resize"/);
  });

  it("carregar no crachá leva à conta", () => {
    assert.match(FONTE, /href=\{CONTA\}/, "o crachá é uma ligação, não só um botão");
    assert.equal(CONTA, "/minha-conta");
  });
});

describe("área da conta", () => {
  it("a barra lateral tem as mesmas entradas do crachá", () => {
    // A mesma lista nos dois sítios: quem aprendeu onde estão os serviços no
    // crachá tem de os encontrar no mesmo sítio na lateral.
    assert.match(MOLDURA, /accountItems\(user\.role\)/);
    assert.match(FONTE, /accountItems\(user\.role\)/);
  });

  it("'Minha conta' é a moldura, e não mais um destino da lista", () => {
    const hrefs = accountItems("professional").map((item) => item.href);
    assert.ok(!hrefs.includes(CONTA), "a conta não pode ser filha de si própria");
    assert.deepEqual(hrefs, [
      "/painel/perfil",
      "/painel/servicos",
      "/painel/agenda",
      "/painel/mensagens",
    ]);
  });

  it("o plano deixou de ser uma página do menu", () => {
    const hrefs = accountItems("professional").map((item) => item.href);
    assert.ok(!hrefs.includes("/painel/plano"), "o plano vive agora dentro de Meu perfil");
  });

  it("quem não é profissional não vê as páginas de profissional", () => {
    assert.deepEqual(accountItems("client"), []);
    assert.deepEqual(accountItems("admin"), []);
  });

  it("dá sempre caminho de volta ao painel", () => {
    assert.match(MOLDURA, /painelDe\(user\.role\)/);
  });
});

describe("menu do painel", () => {
  it("guarda só o trabalho do dia a dia", () => {
    const hrefs = PANEL_NAV.map((item) => item.href);
    assert.deepEqual(hrefs, [
      "/painel",
      "/painel/calendario",
      "/painel/agendamentos",
      "/painel/clientes",
      "/painel/pacotes",
      "/painel/avaliacoes",
      "/painel/financeiro",
      "/painel/relatorios",
    ]);
  });

  it("não repete o que já vive na área da conta", () => {
    // Perfil, serviços, horários e mensagens mudaram-se para debaixo do
    // crachá. Estarem nos dois sítios deixaria duas portas para a mesma sala.
    const noPainel = new Set(
      PANEL_NAV.flatMap((item) => [
        ...(item.href ? [item.href] : []),
        ...(item.children ?? []).map((filho) => filho.href),
      ]),
    );
    for (const item of accountItems("professional")) {
      assert.ok(!noPainel.has(item.href), `${item.href} está nos dois menus`);
    }
  });

  it("não deixa a mesma página em dois sítios do menu", () => {
    const todos = PANEL_NAV.flatMap((item) => [
      ...(item.href ? [item.href] : []),
      ...(item.children ?? []).map((filho) => filho.href),
    ]);
    assert.equal(new Set(todos).size, todos.length, "há uma página repetida no menu");
  });

  it("um separador abre um submenu em vez de navegar", () => {
    for (const item of PANEL_NAV) {
      assert.ok(
        (item.href && !item.children) || (item.children?.length && !item.href),
        `${item.label} tem de ser uma coisa ou a outra`,
      );
    }
  });
});
