"use client";

/**
 * A area da conta: menu a esquerda, conteudo a direita.
 *
 * Sao as mesmas entradas do cracha do cabecalho, tiradas da mesma lista —
 * menos a propria "Minha conta", que aqui e a moldura e nao um destino.
 *
 * Serve as paginas que se afinam uma vez e raramente se voltam a tocar. O
 * trabalho do dia a dia fica no painel, com a sua propria barra de separadores.
 */

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { CONTA, accountItems, painelDe } from "@/components/AccountNav";
import { useSession } from "@/lib/auth";
import type { UserRole } from "@/lib/types";

interface Props {
  title: string;
  subtitle?: string;
  allow: UserRole[];
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export default function AccountShell({ title, subtitle, allow, actions, children }: Props) {
  const { user, loading, logout } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace(`/entrar?next=${encodeURIComponent(pathname)}`);
    else if (!allow.includes(user.role)) router.replace("/");
  }, [loading, user, allow, router, pathname]);

  if (loading || !user || !allow.includes(user.role)) {
    return (
      <div className="container-page py-16">
        <div className="h-8 w-56 animate-pulse rounded-lg bg-ink-100" />
        <div className="mt-6 h-64 animate-pulse rounded-xl2 bg-ink-100" />
      </div>
    );
  }

  const itens = accountItems(user.role);
  const painel = painelDe(user.role);

  function sair() {
    logout();
    router.push("/");
  }

  return (
    <div className="bg-ink-50 pb-16">
      <div className="container-page py-8">
        <div className="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start">
          {/* ------------------------------------------------------ lateral --- */}
          {/* `min-w-0`: sem ele o item da grelha nao encolhe abaixo do conteudo,
              e em ecra estreito a lista estica a pagina em vez de rolar. */}
          <aside className="min-w-0 lg:sticky lg:top-24">
            {painel && (
              <Link
                href={painel}
                className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 transition hover:text-brand-700"
              >
                <span aria-hidden>‹</span>
                {user.role === "admin" ? "Administração" : "Voltar ao painel"}
              </Link>
            )}

            <nav className="scroll-soft flex gap-1 overflow-x-auto rounded-xl2 border border-ink-100 bg-white p-2 lg:flex-col lg:overflow-visible">
              <Link
                href={CONTA}
                className={`shrink-0 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  pathname === CONTA
                    ? "bg-brand-50 text-brand-700"
                    : "text-ink-600 hover:bg-ink-50 hover:text-ink-900"
                }`}
              >
                Minha conta
              </Link>

              {itens.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`shrink-0 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                    pathname === item.href || pathname.startsWith(`${item.href}/`)
                      ? "bg-brand-50 text-brand-700"
                      : "text-ink-600 hover:bg-ink-50 hover:text-ink-900"
                  }`}
                >
                  {item.label}
                </Link>
              ))}

              <div className="hidden h-px bg-ink-100 lg:my-1 lg:block" />

              <button
                onClick={sair}
                className="shrink-0 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-ink-500 transition hover:bg-rose-50 hover:text-rose-700"
              >
                Sair
              </button>
            </nav>
          </aside>

          {/* ----------------------------------------------------- conteudo --- */}
          <div className="min-w-0">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
                {subtitle && <p className="mt-1 text-sm text-ink-500">{subtitle}</p>}
              </div>
              {actions}
            </div>

            <div className="mt-6">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
