/**
 * Dinheiro em texto.
 *
 * Sem dependencias de proposito: e a peca mais facil de partir sem dar por
 * nada — um zero mal traduzido, um sinal a mais — e assim os testes chegam-lhe
 * sem arrastar a camada de rede atras.
 */

/** Locale e moeda de Portugal, usados em todas as formatacoes. */
export const LOCALE = "pt-PT";
export const CURRENCY = "EUR";

export function formatPrice(cents?: number | null): string {
  if (cents === null || cents === undefined) return "Sob consulta";
  if (cents === 0) return "Gratuito";
  return (cents / 100).toLocaleString(LOCALE, {
    style: "currency",
    currency: CURRENCY,
  });
}

/**
 * Dinheiro em relatórios: um zero é zero.
 *
 * `formatPrice` diz "Gratuito" a zero, o que faz sentido numa tabela de preços
 * e nenhum numa conta — "Despesas: Gratuito" não quer dizer nada.
 */
export function formatMoney(cents?: number | null): string {
  // `|| 0` colapsa o zero negativo: sem isto, negar um zero dá "-0,00 €".
  return (((cents ?? 0) / 100) || 0).toLocaleString(LOCALE, {
    style: "currency",
    currency: CURRENCY,
  });
}

export function formatPriceShort(cents?: number | null): string {
  if (cents === null || cents === undefined) return "-";
  return `${(cents / 100).toFixed(2).replace(".", ",")} €`;
}
