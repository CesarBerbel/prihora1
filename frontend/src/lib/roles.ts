/**
 * Que papel pode entrar onde, e para onde vai depois de entrar.
 *
 * Sem dependencias de proposito: e uma decisao de encaminhamento que se parte
 * em silencio — a pessoa acaba noutra pagina em vez de ver um erro — e assim
 * os testes chegam-lhe sem arrastar a sessao nem a camada de rede atras.
 */

import type { UserRole } from "@/lib/types";

/** Painel inicial de cada papel, usado após o login e no registo. */
export function homeForRole(role: UserRole): string {
  if (role === "admin") return "/admin";
  if (role === "professional") return "/painel";
  return "/minha-conta";
}

/**
 * Para onde ir depois de entrar.
 *
 * O `next` vem de quem foi barrado à porta de uma página. Se o papel também
 * não puder entrar *nessa*, seguir para lá era mandar a pessoa para um sítio
 * de onde ia ser expulsa outra vez — e um administrador que fosse barrado no
 * painel do profissional acabava na home, e não na administração dele.
 */
export function destinoAposLogin(role: UserRole, next: string | null): string {
  if (next && next.startsWith("/") && !next.startsWith("//") && podeEntrarEm(role, next)) {
    return next;
  }
  return homeForRole(role);
}

/** As duas áreas fechadas do produto, cada uma com o seu dono. */
export function podeEntrarEm(role: UserRole, caminho: string): boolean {
  const limpo = caminho.split("?")[0];
  const dentro = (raiz: string) => limpo === raiz || limpo.startsWith(`${raiz}/`);
  if (dentro("/admin")) return role === "admin";
  if (dentro("/painel")) return role === "professional";
  return true;
}
