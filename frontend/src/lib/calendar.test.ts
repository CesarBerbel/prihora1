/**
 * As contas do calendario.
 *
 * Um bloco no sitio errado nao rebenta nada: a pagina continua a desenhar-se
 * e so um atendimento aparece a hora que nao e a dele. Estes testes existem
 * para esse tipo de erro dar cara.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  avancar,
  colocarEventos,
  diasDaVista,
  encaixarNaGrelha,
  faixaDeHoras,
  inicioDaSemana,
  janelaDaVista,
  mesmoDia,
  minutosDoDia,
  tituloDaVista,
} from "./calendar.ts";

/** Atalho: um evento no dia 21/08/2026 entre duas horas locais. */
function ev(id: number, inicio: string, fim: string, dia = "2026-08-21") {
  return { id, inicio: new Date(`${dia}T${inicio}:00`), fim: new Date(`${dia}T${fim}:00`) };
}

const DIA = new Date("2026-08-21T00:00:00"); // sexta-feira

describe("navegacao do calendario", () => {
  it("a semana comeca a segunda, tambem quando se olha ao domingo", () => {
    // 23/08/2026 e um domingo: a semana dele comecou a 17.
    assert.equal(inicioDaSemana(new Date("2026-08-23T15:00:00")).getDate(), 17);
    // E na propria segunda nao recua uma semana inteira.
    assert.equal(inicioDaSemana(new Date("2026-08-17T00:00:00")).getDate(), 17);
  });

  it("a vista de semana tem sete dias seguidos", () => {
    const dias = diasDaVista("semana", DIA);
    assert.equal(dias.length, 7);
    assert.equal(dias[0].getDate(), 17);
    assert.equal(dias[6].getDate(), 23);
    for (const dia of dias) assert.equal(dia.getHours(), 0);
  });

  it("a vista de mes desenha semanas inteiras", () => {
    const dias = diasDaVista("mes", DIA);
    assert.equal(dias.length % 7, 0, "tem de fechar em semanas completas");
    assert.ok(dias.length === 35 || dias.length === 42);
    // Agosto de 2026 comeca a um sabado, logo a grelha abre na segunda dia 27/07.
    assert.equal(dias[0].getMonth(), 6);
    assert.equal(dias[0].getDate(), 27);
    // E tem de conter todos os dias de agosto.
    for (const numero of [1, 15, 31]) {
      assert.ok(
        dias.some((d) => d.getMonth() === 7 && d.getDate() === numero),
        `falta ${numero} de agosto`,
      );
    }
  });

  it("somar um mes a 31 de marco nao salta para maio", () => {
    const saida = avancar("mes", new Date("2026-03-31T00:00:00"), 1);
    assert.equal(saida.getMonth(), 3, "tem de ficar em abril");
  });

  it("andar para tras e para a frente volta ao mesmo sitio", () => {
    for (const vista of ["dia", "semana", "mes"] as const) {
      const ida = avancar(vista, DIA, 1);
      const volta = avancar(vista, ida, -1);
      assert.equal(
        janelaDaVista(vista, volta).de.getTime(),
        janelaDaVista(vista, DIA).de.getTime(),
        vista,
      );
    }
  });

  it("a janela pedida ao servidor cobre a vista inteira", () => {
    for (const vista of ["dia", "semana", "mes"] as const) {
      const dias = diasDaVista(vista, DIA);
      const { de, ate } = janelaDaVista(vista, DIA);
      assert.equal(de.getTime(), dias[0].getTime(), vista);
      assert.ok(ate > dias[dias.length - 1], `${vista}: o fim tem de passar o ultimo dia`);
    }
  });
});

describe("colocacao dos atendimentos", () => {
  it("poe cada bloco na hora certa e com a duracao certa", () => {
    const [posto] = colocarEventos([ev(1, "09:30", "10:30")], DIA);
    assert.equal(posto.topo, 570); // 9h30 = 570 minutos
    assert.equal(posto.altura, 60);
    assert.equal(posto.colunas, 1);
    assert.equal(posto.coluna, 0);
  });

  it("dois atendimentos ao mesmo tempo dividem a coluna", () => {
    const postos = colocarEventos([ev(1, "10:00", "11:00"), ev(2, "10:30", "11:30")], DIA);
    assert.equal(postos.length, 2);
    for (const p of postos) assert.equal(p.colunas, 2);
    assert.deepEqual(postos.map((p) => p.coluna).sort(), [0, 1]);
  });

  it("atendimentos seguidos nao dividem nada", () => {
    // Um acaba exactamente quando o outro comeca: nao se sobrepoem.
    const postos = colocarEventos([ev(1, "10:00", "11:00"), ev(2, "11:00", "12:00")], DIA);
    for (const p of postos) {
      assert.equal(p.colunas, 1, "lado a lado seria mentira: nao coincidem");
    }
  });

  it("um grupo em cadeia partilha a mesma largura", () => {
    // A toca B, B toca C, mas A nao toca C. Os tres pertencem ao mesmo grupo,
    // logo os tres tem de ficar com a mesma largura, sem escadinha.
    const postos = colocarEventos(
      [ev(1, "10:00", "11:00"), ev(2, "10:30", "11:30"), ev(3, "11:15", "12:15")],
      DIA,
    );
    assert.equal(new Set(postos.map((p) => p.colunas)).size, 1);
    assert.equal(postos[0].colunas, 2, "duas colunas chegam: A e C podem partilhar");
  });

  it("reaproveita a coluna que ficou livre", () => {
    const postos = colocarEventos(
      [ev(1, "09:00", "12:00"), ev(2, "09:00", "10:00"), ev(3, "10:00", "11:00")],
      DIA,
    );
    const porId = new Map(postos.map((p) => [p.evento.id, p]));
    // O terceiro entra na coluna que o segundo largou.
    assert.equal(porId.get(2)!.coluna, porId.get(3)!.coluna);
    assert.equal(porId.get(1)!.colunas, 2);
  });

  it("nunca poe dois blocos na mesma coluna a mesma hora", () => {
    // Uma mistura desarrumada de propósito, incluindo horas repetidas.
    const eventos = [
      ev(1, "09:00", "10:00"), ev(2, "09:00", "09:30"), ev(3, "09:15", "11:00"),
      ev(4, "10:00", "10:30"), ev(5, "10:00", "12:00"), ev(6, "11:30", "12:30"),
      ev(7, "08:00", "09:10"), ev(8, "13:00", "14:00"),
    ];
    const postos = colocarEventos(eventos, DIA, 0);
    for (const a of postos) {
      for (const b of postos) {
        if (a.evento.id >= b.evento.id || a.coluna !== b.coluna) continue;
        const sobrepoe = a.topo < b.topo + b.altura && b.topo < a.topo + a.altura;
        assert.ok(!sobrepoe, `${a.evento.id} e ${b.evento.id} colidem na coluna ${a.coluna}`);
      }
    }
  });

  it("um atendimento curto ocupa uma altura legivel sem mentir na hora", () => {
    const [posto] = colocarEventos([ev(1, "09:00", "09:10")], DIA, 30);
    assert.equal(posto.topo, 540, "a hora de inicio nao pode mudar");
    assert.equal(posto.altura, 30);
  });

  it("ignora o que nao toca o dia", () => {
    assert.equal(colocarEventos([ev(1, "09:00", "10:00", "2026-08-20")], DIA).length, 0);
  });

  it("um atendimento pela meia-noite aparece cortado nos dois dias", () => {
    const evento = {
      id: 1,
      inicio: new Date("2026-08-21T23:00:00"),
      fim: new Date("2026-08-22T01:00:00"),
    };
    const [sexta] = colocarEventos([evento], DIA, 0);
    assert.equal(sexta.topo, 1380);
    assert.equal(sexta.altura, 60, "na sexta so se ve ate a meia-noite");

    const [sabado] = colocarEventos([evento], new Date("2026-08-22T00:00:00"), 0);
    assert.equal(sabado.topo, 0);
    assert.equal(sabado.altura, 60, "no sabado ve-se o resto");
  });
});

describe("faixa de horas desenhada", () => {
  it("cobre o horario de trabalho com uma folga", () => {
    const faixa = faixaDeHoras([{ inicioMin: 9 * 60, fimMin: 18 * 60 }], []);
    assert.equal(faixa.primeiraHora, 8);
    assert.equal(faixa.ultimaHora, 19);
  });

  it("alarga-se para nao esconder o que caiu fora do horario", () => {
    // Marcacao das 7h num dia que so abre as 10h: tem de aparecer.
    const faixa = faixaDeHoras(
      [{ inicioMin: 10 * 60, fimMin: 18 * 60 }],
      [{ topo: 7 * 60, altura: 60 }],
    );
    assert.ok(faixa.primeiraHora <= 7, `${faixa.primeiraHora} esconderia as 7h`);
    assert.ok(faixa.ultimaHora >= 19);
  });

  it("uma agenda vazia ainda desenha um dia util", () => {
    const faixa = faixaDeHoras([], []);
    assert.ok(faixa.ultimaHora - faixa.primeiraHora >= 6);
  });

  it("nunca sai do dia", () => {
    const faixa = faixaDeHoras([{ inicioMin: 0, fimMin: 1440 }], []);
    assert.equal(faixa.primeiraHora, 0);
    assert.equal(faixa.ultimaHora, 24);
  });
});

describe("auxiliares de data", () => {
  it("conta os minutos desde a meia-noite", () => {
    assert.equal(minutosDoDia(new Date("2026-08-21T00:00:00"), DIA), 0);
    assert.equal(minutosDoDia(new Date("2026-08-21T14:45:00"), DIA), 885);
  });

  it("distingue dias iguais de dias so parecidos", () => {
    assert.ok(mesmoDia(new Date("2026-08-21T23:59:00"), DIA));
    assert.ok(!mesmoDia(new Date("2026-08-22T00:01:00"), DIA));
    assert.ok(!mesmoDia(new Date("2025-08-21T12:00:00"), DIA));
  });

  it("da um titulo legivel a cada vista", () => {
    assert.match(tituloDaVista("mes", DIA), /agosto/i);
    assert.match(tituloDaVista("dia", DIA), /21/);
    // Semana dentro do mesmo mes: um so nome de mes.
    const semana = tituloDaVista("semana", DIA);
    assert.match(semana, /17/);
    assert.match(semana, /23/);
    assert.equal(semana.match(/agosto/gi)?.length, 1);
    // Semana a cavalo de dois meses: os dois nomes aparecem.
    const cavalo = tituloDaVista("semana", new Date("2026-10-01T00:00:00"));
    assert.match(cavalo, /setembro/i);
    assert.match(cavalo, /outubro/i);
  });
});

describe("encaixe na grelha de horas", () => {
  it("um clique cai na hora marcável mais próxima", () => {
    // Meia em meia hora: 15h07 é 15h00, 15h23 é 15h30.
    assert.equal(encaixarNaGrelha(15 * 60 + 7, 30), 15 * 60);
    assert.equal(encaixarNaGrelha(15 * 60 + 23, 30), 15 * 60 + 30);
  });

  it("de hora a hora só há horas certas", () => {
    for (const minuto of [0, 7, 23, 29, 31, 47, 59]) {
      const saida = encaixarNaGrelha(15 * 60 + minuto, 60);
      assert.equal(saida % 60, 0, `15h${minuto} caiu fora da hora certa`);
    }
  });

  it("o intervalo do profissional é quem manda", () => {
    // O mesmo clique, três agendas diferentes.
    const clique = 12 * 60 + 20;
    assert.equal(encaixarNaGrelha(clique, 15), 12 * 60 + 15);
    assert.equal(encaixarNaGrelha(clique, 30), 12 * 60 + 30);
    assert.equal(encaixarNaGrelha(clique, 60), 12 * 60);
  });

  it("nunca sai do dia", () => {
    // Carregar no fundo da grelha não pode dar uma marcação à meia-noite do
    // dia seguinte, que desapareceria da vista onde se carregou.
    for (const passo of [15, 30, 45, 60, 90]) {
      const fim = encaixarNaGrelha(1439, passo);
      assert.ok(fim < 1440, `${passo} min transbordou para o dia seguinte`);
      assert.equal(fim % passo, 0);
      assert.equal(encaixarNaGrelha(-40, passo), 0, "nem para trás da meia-noite");
    }
  });

  it("um intervalo em falta ou absurdo não parte a grelha", () => {
    assert.equal(encaixarNaGrelha(12 * 60 + 20, 0), 12 * 60 + 30, "sem intervalo, meia hora");
    assert.equal(encaixarNaGrelha(12 * 60 + 20, -5), 12 * 60 + 30);
    // Um passo minúsculo continua a dar um múltiplo válido.
    assert.equal(encaixarNaGrelha(12 * 60 + 7, 1) % 5, 0);
  });
});
