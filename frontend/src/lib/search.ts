/**
 * Como uma pesquisa nova se junta a que ja estava.
 *
 * Os filtros somam-se. Quem esta a ver manicures e depois diz onde esta
 * continua a ver manicures — so que na sua zona. Antes disto, cada caixa
 * montava os parametros de raiz e deitava fora tudo o que nao fosse seu: a
 * categoria desaparecia sem aviso e o resultado parecia apenas... outro.
 *
 * Funcoes puras de proposito: e uma perda silenciosa, do genero que nao
 * rebenta nada e so da uma lista diferente.
 */

export interface Pesquisa {
  /** Termo escrito. Vazio apaga o que la estava. */
  q?: string;
  /** Localidade escrita ou detetada. Vazia apaga. */
  city?: string;
}

export interface Coordenadas {
  lat: string;
  lng: string;
}

/** Escreve uma chave, ou apaga-a quando o valor esta vazio. */
function definir(params: URLSearchParams, chave: string, valor: string | undefined) {
  const limpo = (valor ?? "").trim();
  if (limpo) params.set(chave, limpo);
  else params.delete(chave);
}

/** Ponto de partida: o que ja esta no endereco, menos a paginacao. */
function base(atuais: URLSearchParams | string): URLSearchParams {
  const params = new URLSearchParams(
    typeof atuais === "string" ? atuais : atuais.toString(),
  );
  // Um resultado novo nao continua na pagina 3 do anterior.
  params.delete("page");
  return params;
}

/**
 * Pesquisa escrita: termo e localidade.
 *
 * Escrever a localidade e dizer "e aqui que quero", por isso as coordenadas de
 * uma detecao anterior deixam de mandar — se ficassem, o texto era ignorado,
 * porque as coordenadas tem prioridade na resolucao do local.
 */
export function pesquisaEscrita(
  atuais: URLSearchParams | string,
  { q, city }: Pesquisa,
): URLSearchParams {
  const params = base(atuais);
  definir(params, "q", q);
  definir(params, "city", city);
  params.delete("lat");
  params.delete("lng");
  return params;
}

/**
 * Pesquisa a partir da localizacao do dispositivo.
 *
 * Sugere ordenar por distancia, mas nao pisa uma ordenacao que a pessoa tenha
 * escolhido de proposito.
 */
export function pesquisaPorLocalizacao(
  atuais: URLSearchParams | string,
  { q, city, lat, lng }: Pesquisa & Coordenadas,
): URLSearchParams {
  const params = base(atuais);
  definir(params, "q", q);
  definir(params, "city", city);
  params.set("lat", lat);
  params.set("lng", lng);

  const ordem = params.get("sort");
  if (!ordem || ordem === "relevance") params.set("sort", "distance");
  return params;
}

/**
 * O que as caixas passam a mostrar quando o endereco muda.
 *
 * Devolve so os campos que tem de ser substituidos. A comparacao e com o
 * *endereco anterior*, e nao com o que esta escrito: sem isto, "Limpar
 * pesquisa" esvaziava o endereco e as caixas ficavam com o texto antigo — o
 * estado do componente sobrevive a uma navegacao do lado do cliente. E com a
 * comparacao feita ao contrario, escolher uma categoria na coluna ao lado
 * apagava o que a pessoa estivesse a escrever.
 */
export function camposASeguir(
  anterior: Pesquisa,
  atual: Pesquisa,
): { q?: string; city?: string } {
  const mudancas: { q?: string; city?: string } = {};
  if ((anterior.q ?? "") !== (atual.q ?? "")) mudancas.q = atual.q ?? "";
  if ((anterior.city ?? "") !== (atual.city ?? "")) mudancas.city = atual.city ?? "";
  return mudancas;
}
