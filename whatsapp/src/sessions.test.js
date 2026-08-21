import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { paraJid } from "./sessions.js";

describe("numero para JID do WhatsApp", () => {
  it("acrescenta o indicativo de Portugal a numeros nacionais", () => {
    assert.equal(paraJid("912345678"), "351912345678@s.whatsapp.net");
    assert.equal(paraJid("912 345 678"), "351912345678@s.whatsapp.net");
  });

  it("respeita o indicativo quando ja vem no numero", () => {
    assert.equal(paraJid("+351 912 345 678"), "351912345678@s.whatsapp.net");
    assert.equal(paraJid("00351912345678"), "351912345678@s.whatsapp.net");
    assert.equal(paraJid("351912345678"), "351912345678@s.whatsapp.net");
  });

  it("nao estraga numeros de outros paises", () => {
    assert.equal(paraJid("+55 11 91234-5678"), "5511912345678@s.whatsapp.net");
  });

  it("recusa o que nao chega a ser um numero", () => {
    assert.equal(paraJid(""), null);
    assert.equal(paraJid(null), null);
    assert.equal(paraJid("sem numero"), null);
    assert.equal(paraJid("12345"), null);
  });
});
