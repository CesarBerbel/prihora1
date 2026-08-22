/**
 * Para onde cada papel vai depois de entrar.
 *
 * O `next` do endereço vem de quem foi barrado à porta de uma página. Seguir
 * para lá às cegas mandava a pessoa para um sítio de onde ia ser expulsa outra
 * vez — e não dava erro nenhum: um administrador barrado no painel do
 * profissional acabava calado na página inicial, em vez de na administração.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { destinoAposLogin, homeForRole, podeEntrarEm } from "./roles.ts";

describe("áreas fechadas", () => {
  it("cada uma tem o seu dono", () => {
    assert.equal(podeEntrarEm("admin", "/admin"), true);
    assert.equal(podeEntrarEm("admin", "/admin/planos"), true);
    assert.equal(podeEntrarEm("professional", "/admin"), false);
    assert.equal(podeEntrarEm("client", "/admin/usuarios"), false);

    assert.equal(podeEntrarEm("professional", "/painel/agenda"), true);
    assert.equal(podeEntrarEm("admin", "/painel"), false);
    assert.equal(podeEntrarEm("client", "/painel"), false);
  });

  it("o resto do site é de toda a gente", () => {
    for (const papel of ["admin", "professional", "client"] as const) {
      assert.equal(podeEntrarEm(papel, "/"), true);
      assert.equal(podeEntrarEm(papel, "/buscar"), true);
      assert.equal(podeEntrarEm(papel, "/minha-conta"), true);
      assert.equal(podeEntrarEm(papel, "/p/ana-sousa"), true);
    }
  });

  it("um prefixo parecido não abre a porta", () => {
    // "/administracao" não é "/admin".
    assert.equal(podeEntrarEm("client", "/administracao"), true);
    assert.equal(podeEntrarEm("client", "/paineis"), true);
  });
});

describe("destino depois de entrar", () => {
  it("sem next, vai para o painel do papel", () => {
    assert.equal(destinoAposLogin("admin", null), "/admin");
    assert.equal(destinoAposLogin("professional", null), "/painel");
    assert.equal(destinoAposLogin("client", null), "/minha-conta");
  });

  it("respeita o next quando o papel lá pode entrar", () => {
    assert.equal(destinoAposLogin("professional", "/painel/agenda"), "/painel/agenda");
    assert.equal(destinoAposLogin("client", "/agendamento"), "/agendamento");
    assert.equal(destinoAposLogin("admin", "/admin/planos"), "/admin/planos");
  });

  it("ignora o next quando levaria a uma porta fechada", () => {
    // O caso que deu origem a isto: o administrador acabava na home.
    assert.equal(destinoAposLogin("admin", "/painel/perfil"), "/admin");
    assert.equal(destinoAposLogin("professional", "/admin"), "/painel");
    assert.equal(destinoAposLogin("client", "/painel"), "/minha-conta");
  });

  it("não sai do site por um next forjado", () => {
    for (const forjado of ["//outro-site.pt", "https://outro-site.pt", "javascript:alert(1)"]) {
      assert.equal(destinoAposLogin("client", forjado), homeForRole("client"), forjado);
    }
  });
});
