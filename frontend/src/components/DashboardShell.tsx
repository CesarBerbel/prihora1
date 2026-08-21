"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import type { NavItem } from "@/components/PanelNav";
import { useSession } from "@/lib/auth";
import type { UserRole } from "@/lib/types";

interface Props {
  title: string;
  subtitle?: string;
  nav: NavItem[];
  /** Papeis autorizados a ver esta área. */
  allow: UserRole[];
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export default function DashboardShell({
  title,
  subtitle,
  nav,
  allow,
  actions,
  children,
}: Props) {
  const { user, loading } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  // Guarda de rota no cliente: sem sessao valida, volta para o login.
  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/entrar?next=${encodeURIComponent(pathname)}`);
    } else if (!allow.includes(user.role)) {
      router.replace("/");
    }
  }, [loading, user, allow, router, pathname]);

  if (loading || !user || !allow.includes(user.role)) {
    return (
      <div className="container-page py-16">
        <div className="h-8 w-56 animate-pulse rounded-lg bg-ink-100" />
        <div className="mt-6 h-64 animate-pulse rounded-xl2 bg-ink-100" />
      </div>
    );
  }

  return (
    <div className="bg-ink-50 pb-16">
      <div className="border-b border-ink-100 bg-white">
        <div className="container-page pt-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
              {subtitle && <p className="mt-1 text-sm text-ink-500">{subtitle}</p>}
            </div>
            {actions}
          </div>

          <nav className="scroll-soft mt-6 flex gap-1 overflow-x-auto pt-1">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href!}
                className={`${ABA} ${
                  estaNaAba(pathname, item.href!, item.href === nav[0]?.href)
                    ? ABA_ATIVA
                    : ABA_INATIVA
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      <div className="container-page py-8">{children}</div>
    </div>
  );
}

const ABA = "shrink-0 border-b-2 px-4 py-3 text-sm font-medium transition";
const ABA_ATIVA = "border-brand-600 text-brand-700";
const ABA_INATIVA = "border-transparent text-ink-500 hover:border-ink-200 hover:text-ink-800";

/** A primeira aba e a raiz do painel: so acende no caminho exacto. */
function estaNaAba(pathname: string, href: string, raiz: boolean): boolean {
  if (raiz) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}
