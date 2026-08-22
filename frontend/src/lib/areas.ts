/**
 * As duas metades publicas do prihora.
 *
 * O site atende dois publicos que nao se misturam: quem procura um servico e
 * quem o presta. Cada um tem a sua entrada, o seu menu e a sua chamada para
 * accao. A area sai do caminho da pagina — e nao de um estado guardado — para
 * que o cabecalho renderizado no servidor seja sempre igual ao do navegador e
 * para que qualquer endereco possa ser partilhado tal como esta.
 */

export type Area = "cliente" | "profissional";

/** Onde o logotipo aterra em cada area. */
export const INICIO: Record<Area, string> = {
  cliente: "/",
  profissional: "/para-profissionais",
};

/** Prefixos que pertencem ao lado profissional. O resto e do cliente. */
const RAIZES_PROFISSIONAL = ["/para-profissionais", "/planos", "/painel"];

/** Zonas de trabalho: ja se esta dentro do produto, o menu de vitrine sai. */
const RAIZES_APLICACAO = ["/painel", "/admin"];

function dentroDe(caminho: string, raizes: string[]): boolean {
  const limpo = caminho.replace(/\/+$/, "") || "/";
  return raizes.some((raiz) => limpo === raiz || limpo.startsWith(`${raiz}/`));
}

export function areaDaRota(caminho: string): Area {
  return dentroDe(caminho, RAIZES_PROFISSIONAL) ? "profissional" : "cliente";
}

/** No painel e na administracao o menu publico so faria ruido. */
export function mostraMenuPublico(caminho: string): boolean {
  return !dentroDe(caminho, RAIZES_APLICACAO);
}

export interface ItemMenu {
  href: string;
  label: string;
  /** O ultimo item leva a outra area: e o atalho entre as duas metades. */
  troca?: boolean;
}

export const MENU: Record<Area, ItemMenu[]> = {
  cliente: [
    { href: "/buscar", label: "Procurar profissionais" },
    // Quem marcou sem conta so tem o codigo. Estava a um so link, no rodape.
    { href: "/agendamento", label: "A minha marcação" },
    { href: "/como-funciona", label: "Como funciona" },
    { href: "/para-profissionais", label: "Sou profissional", troca: true },
  ],
  profissional: [
    { href: "/para-profissionais/como-funciona", label: "Como funciona" },
    { href: "/planos", label: "Planos" },
    { href: "/", label: "Sou cliente", troca: true },
  ],
};

/** A accao principal do cabecalho, para quem ainda nao entrou. */
export const CHAMADA: Record<Area, { href: string; label: string } | null> = {
  cliente: null,
  profissional: { href: "/para-profissionais/registo", label: "Registar o meu trabalho" },
};

export function estaAtivo(caminho: string, href: string): boolean {
  if (href === "/") return caminho === "/";
  return caminho === href || caminho.startsWith(`${href}/`);
}
