export interface NavItem {
  label: string;
  /** Ausente nos separadores: eles abrem um submenu em vez de navegar. */
  href?: string;
  children?: { href: string; label: string }[];
}

/**
 * O menu do painel: só o trabalho do dia a dia.
 *
 * O que se afina uma vez e raramente se volta a tocar — perfil, serviços,
 * horários, mensagens automáticas, plano — mudou-se para a área da conta, sob
 * o crachá do utilizador. Ver `AccountNav`.
 */
export const PANEL_NAV: NavItem[] = [
  { href: "/painel", label: "Visao geral" },
  { href: "/painel/calendario", label: "Calendário" },
  { href: "/painel/agendamentos", label: "Marcações" },
  { href: "/painel/clientes", label: "Clientes" },
  { href: "/painel/financeiro", label: "Financeiro" },
];

export const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Visao geral" },
  { href: "/admin/profissionais", label: "Profissionais" },
  { href: "/admin/usuarios", label: "Contas" },
  { href: "/admin/planos", label: "Planos" },
  { href: "/admin/agendamentos", label: "Marcações" },
  { href: "/admin/auditoria", label: "Auditoria" },
];
