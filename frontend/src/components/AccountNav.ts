import type { UserRole } from "@/lib/types";

/**
 * O menu da conta: o mesmo no cracha do cabecalho e na barra lateral da
 * pagina "Minha conta".
 *
 * Sao a mesma lista de proposito. O cracha acrescenta duas coisas nas pontas —
 * a propria "Minha conta" em cima e o "Sair" em baixo —, mas o miolo tem de
 * coincidir: um utilizador que aprendeu onde estao os "Serviços" no cracha tem
 * de os encontrar no mesmo sitio na barra lateral.
 */

export interface AccountItem {
  href: string;
  label: string;
}

/** Onde a conta comeca, para cada papel. */
export const CONTA = "/minha-conta";

const DO_PROFISSIONAL: AccountItem[] = [
  { href: "/painel/perfil", label: "Meu perfil" },
  { href: "/painel/servicos", label: "Serviços" },
  { href: "/painel/agenda", label: "Horários" },
  { href: "/painel/mensagens", label: "Mensagens" },
];

/** O miolo do menu, sem "Minha conta" nem "Sair". */
export function accountItems(role: UserRole | undefined): AccountItem[] {
  return role === "professional" ? DO_PROFISSIONAL : [];
}

/** O painel de trabalho de cada papel — o sitio de onde se veio. */
export function painelDe(role: UserRole | undefined): string | null {
  if (role === "admin") return "/admin";
  if (role === "professional") return "/painel";
  return null;
}
