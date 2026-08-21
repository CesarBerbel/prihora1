/**
 * As contas do calendario, longe do desenho.
 *
 * Sobreposicao de atendimentos e posicao na grelha sao o tipo de coisa que
 * falha em silencio: o ecra continua bonito e so um bloco fica no sitio
 * errado. Por isso vivem aqui, em funcoes puras que os testes conseguem
 * apertar sem montar o ecra inteiro.
 *
 * Toda a aritmetica e feita na hora local do navegador, que e a hora em que o
 * profissional pensa quando olha para a agenda dele.
 */

export type Vista = "dia" | "semana" | "mes";

/** Minutos desde a meia-noite do dia de `referencia`. */
export function minutosDoDia(instante: Date, referencia: Date): number {
  const meiaNoite = new Date(referencia);
  meiaNoite.setHours(0, 0, 0, 0);
  return (instante.getTime() - meiaNoite.getTime()) / 60000;
}

export function mesmoDia(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function inicioDoDia(data: Date): Date {
  const saida = new Date(data);
  saida.setHours(0, 0, 0, 0);
  return saida;
}

export function somarDias(data: Date, dias: number): Date {
  const saida = new Date(data);
  saida.setDate(saida.getDate() + dias);
  return saida;
}

/** Segunda-feira da semana de `data`. Em Portugal a semana comeca a segunda. */
export function inicioDaSemana(data: Date): Date {
  const saida = inicioDoDia(data);
  // getDay(): 0 = domingo. Recuar ate segunda significa recuar 6 dias no domingo.
  const recuo = (saida.getDay() + 6) % 7;
  return somarDias(saida, -recuo);
}

/** Os dias visiveis em cada vista, ja na ordem em que aparecem. */
export function diasDaVista(vista: Vista, ancora: Date): Date[] {
  if (vista === "dia") return [inicioDoDia(ancora)];
  if (vista === "semana") {
    const segunda = inicioDaSemana(ancora);
    return Array.from({ length: 7 }, (_, i) => somarDias(segunda, i));
  }
  // O mes desenha semanas inteiras: comeca na segunda anterior ao dia 1 e
  // segue ate fechar a semana do ultimo dia. Sao sempre 5 ou 6 linhas.
  const primeiro = new Date(ancora.getFullYear(), ancora.getMonth(), 1);
  const ultimo = new Date(ancora.getFullYear(), ancora.getMonth() + 1, 0);
  const comeco = inicioDaSemana(primeiro);
  const dias: Date[] = [];
  for (let d = comeco; d <= ultimo || dias.length % 7 !== 0; d = somarDias(d, 1)) {
    dias.push(d);
    if (dias.length > 42) break; // rede de seguranca: nunca mais de 6 semanas
  }
  return dias;
}

/** O intervalo a pedir ao servidor para uma vista. Fim exclusivo. */
export function janelaDaVista(vista: Vista, ancora: Date): { de: Date; ate: Date } {
  const dias = diasDaVista(vista, ancora);
  return { de: dias[0], ate: somarDias(dias[dias.length - 1], 1) };
}

export function avancar(vista: Vista, ancora: Date, passos: number): Date {
  if (vista === "dia") return somarDias(ancora, passos);
  if (vista === "semana") return somarDias(ancora, passos * 7);
  const saida = new Date(ancora);
  // Dia 1 antes de somar meses: em 31 de marco, "+1 mes" daria 1 de maio.
  saida.setDate(1);
  saida.setMonth(saida.getMonth() + passos);
  return saida;
}

// --- eventos ----------------------------------------------------------------

export interface Evento {
  id: number;
  inicio: Date;
  fim: Date;
}

/** Um evento ja colocado: onde comeca, que altura tem e que fatia da coluna ocupa. */
export interface Colocado<T extends Evento> {
  evento: T;
  /** Minutos desde a meia-noite do dia em que e desenhado. */
  topo: number;
  /** Altura em minutos, nunca menor que `minimoMinutos`. */
  altura: number;
  /** Indice da coluna dentro do grupo que se sobrepoe, a partir de 0. */
  coluna: number;
  /** Quantas colunas o grupo precisou. */
  colunas: number;
}

/**
 * Recorta um evento ao dia pedido.
 *
 * Um atendimento pode atravessar a meia-noite. Nesse caso aparece nos dois
 * dias, cortado em cada um, em vez de transbordar da grelha ou desaparecer.
 * Devolve null quando o evento nao toca o dia.
 */
function recortarAoDia<T extends Evento>(evento: T, dia: Date): { topo: number; fim: number } | null {
  const abre = inicioDoDia(dia);
  const fecha = somarDias(abre, 1);
  if (evento.fim <= abre || evento.inicio >= fecha) return null;
  return {
    topo: Math.max(0, minutosDoDia(evento.inicio, dia)),
    fim: Math.min(1440, minutosDoDia(evento.fim, dia)),
  };
}

/**
 * Distribui por colunas os eventos que se sobrepoem no tempo.
 *
 * O algoritmo e o do Google Calendar: percorre os eventos por ordem de
 * inicio e junta num "grupo" todos os que se tocam em cadeia. Dentro do
 * grupo, cada evento vai para a primeira coluna que esteja livre a hora dele,
 * e todos partilham a largura pelo numero de colunas que o grupo precisou —
 * assim os blocos de um mesmo grupo ficam alinhados em vez de escadinha.
 *
 * `minimoMinutos` evita que um atendimento de 10 minutos fique numa fatia
 * ilegivel: ocupa o minimo no ecra sem mentir sobre a hora a que comeca.
 */
export function colocarEventos<T extends Evento>(
  eventos: T[],
  dia: Date,
  minimoMinutos = 30,
): Colocado<T>[] {
  const recortados = eventos
    .map((evento) => ({ evento, corte: recortarAoDia(evento, dia) }))
    .filter((item): item is { evento: T; corte: { topo: number; fim: number } } => item.corte !== null)
    .map(({ evento, corte }) => ({
      evento,
      topo: corte.topo,
      altura: Math.max(minimoMinutos, corte.fim - corte.topo),
    }))
    // Mais cedo primeiro; em empate, o mais longo a esquerda.
    .sort((a, b) => a.topo - b.topo || b.altura - a.altura || a.evento.id - b.evento.id);

  const saida: Colocado<T>[] = [];
  let grupo: typeof recortados = [];
  let fimDoGrupo = -1;

  const fecharGrupo = () => {
    if (grupo.length === 0) return;
    // Fim ocupado de cada coluna, para saber qual esta livre.
    const colunas: number[] = [];
    const atribuidas = grupo.map((item) => {
      let indice = colunas.findIndex((fim) => fim <= item.topo);
      if (indice === -1) {
        indice = colunas.length;
        colunas.push(0);
      }
      colunas[indice] = item.topo + item.altura;
      return { ...item, coluna: indice };
    });
    for (const item of atribuidas) {
      saida.push({ ...item, colunas: colunas.length });
    }
    grupo = [];
    fimDoGrupo = -1;
  };

  for (const item of recortados) {
    // Deixou de tocar em qualquer um do grupo anterior: comeca grupo novo.
    if (grupo.length > 0 && item.topo >= fimDoGrupo) fecharGrupo();
    grupo.push(item);
    fimDoGrupo = Math.max(fimDoGrupo, item.topo + item.altura);
  }
  fecharGrupo();

  return saida;
}

/**
 * A faixa de horas a desenhar.
 *
 * Comeca no horario de trabalho e alarga-se para caber tudo o que exista fora
 * dele — uma marcacao lancada pelo painel pode cair as 7h de um dia em que o
 * profissional so abre as 10h, e escondê-la seria pior do que a grelha ficar
 * mais alta. Arredonda a hora inteira e guarda uma folga de meia hora.
 */
export function faixaDeHoras(
  janelas: { inicioMin: number; fimMin: number }[],
  eventos: { topo: number; altura: number }[],
  { minimo = 6 } = {},
): { primeiraHora: number; ultimaHora: number } {
  const marcos = [
    ...janelas.flatMap((j) => [j.inicioMin, j.fimMin]),
    ...eventos.flatMap((e) => [e.topo, e.topo + e.altura]),
  ].filter((valor) => Number.isFinite(valor));

  if (marcos.length === 0) return { primeiraHora: 8, ultimaHora: 20 };

  let primeira = Math.floor(Math.min(...marcos) / 60);
  let ultima = Math.ceil(Math.max(...marcos) / 60);

  primeira = Math.max(0, primeira - 1);
  ultima = Math.min(24, ultima + 1);

  // Uma grelha de duas horas nao se le: garante uma altura minima decente.
  while (ultima - primeira < minimo) {
    if (ultima < 24) ultima += 1;
    else if (primeira > 0) primeira -= 1;
    else break;
  }
  return { primeiraHora: primeira, ultimaHora: ultima };
}

/** "18 – 24 de agosto de 2026", "quinta, 21 de agosto" ou "agosto de 2026". */
export function tituloDaVista(vista: Vista, ancora: Date): string {
  const mesAno = new Intl.DateTimeFormat("pt-PT", { month: "long", year: "numeric" });
  if (vista === "mes") return mesAno.format(ancora);

  if (vista === "dia") {
    return new Intl.DateTimeFormat("pt-PT", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(ancora);
  }

  const dias = diasDaVista("semana", ancora);
  const primeiro = dias[0];
  const ultimo = dias[6];
  const dia = new Intl.DateTimeFormat("pt-PT", { day: "numeric" });
  const diaMes = new Intl.DateTimeFormat("pt-PT", { day: "numeric", month: "long" });

  // Semana dentro do mesmo mes: "18 – 24 de agosto de 2026".
  if (primeiro.getMonth() === ultimo.getMonth()) {
    return `${dia.format(primeiro)} – ${diaMes.format(ultimo)} de ${ultimo.getFullYear()}`;
  }
  // Semana a cavalo: "29 de setembro – 5 de outubro de 2026".
  return `${diaMes.format(primeiro)} – ${diaMes.format(ultimo)} de ${ultimo.getFullYear()}`;
}

/**
 * Encaixa um instante do dia na grelha de horas do profissional.
 *
 * Um clique na grelha cai onde calha — 15h07, 15h23 —, mas o profissional so
 * atende de `passo` em `passo` minutos. Deixar cair as 15h07 daria uma
 * marcacao que a agenda publica nunca ofereceria a ninguem, e que empurraria
 * todas as horas livres do resto do dia para fora da grelha.
 *
 * Arredonda para o encaixe mais proximo e nunca sai do dia: o ultimo encaixe
 * possivel e o que ainda comeca antes da meia-noite.
 */
export function encaixarNaGrelha(minutos: number, passo: number): number {
  // Um valor em falta ou sem sentido volta ao intervalo por omissao. Cortar
  // pelo minimo em vez disso daria encaixes de 5 em 5 minutos a quem tem o
  // perfil mal preenchido — o contrario do que se quer.
  const bruto = Math.round(passo);
  const salto = Number.isFinite(bruto) && bruto > 0 ? Math.max(5, bruto) : 30;
  const encaixado = Math.round(minutos / salto) * salto;
  const ultimo = Math.floor((1440 - 1) / salto) * salto;
  return Math.min(Math.max(0, encaixado), ultimo);
}
