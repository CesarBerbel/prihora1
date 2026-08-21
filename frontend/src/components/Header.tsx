"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { CONTA, accountItems, painelDe } from "@/components/AccountNav";
import { IconClose, IconMenu, IconSparkles } from "@/components/Icons";
import UserBadge from "@/components/UserBadge";
import { CHAMADA, INICIO, MENU, areaDaRota, estaAtivo, mostraMenuPublico } from "@/lib/areas";
import { useSession } from "@/lib/auth";

export default function Header() {
  const { user, logout, loading } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // Fecha o menu mobile ao trocar de página.
  useEffect(() => setOpen(false), [pathname]);

  const area = areaDaRota(pathname);
  const menu = mostraMenuPublico(pathname) ? MENU[area] : [];
  const chamada = CHAMADA[area];

  function handleLogout() {
    logout();
    router.push(INICIO[area]);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-ink-100 bg-white/85 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Link
          href={INICIO[area]}
          className="flex items-center gap-2 text-lg font-bold tracking-tight"
        >
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-brand-600 text-white">
            <IconSparkles className="h-4 w-4" />
          </span>
          <span>
            pri<span className="text-brand-600">hora</span>
          </span>
          {/* O selo diz de que lado do site se esta, sem precisar de ler o menu. */}
          {area === "profissional" && (
            <span className="hidden rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-brand-700 sm:inline">
              profissionais
            </span>
          )}
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {menu.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-full px-3.5 py-2 text-sm font-medium transition ${
                estaAtivo(pathname, item.href)
                  ? "bg-brand-50 text-brand-700"
                  : item.troca
                    ? "text-ink-500 hover:bg-ink-100 hover:text-ink-900"
                    : "text-ink-600 hover:bg-ink-100 hover:text-ink-900"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {loading ? (
            <div className="h-9 w-28 animate-pulse rounded-full bg-ink-100" />
          ) : user ? (
            <UserBadge />
          ) : (
            <>
              <Link href="/entrar" className={chamada ? "btn-ghost btn-sm" : "btn-secondary btn-sm"}>
                Entrar
              </Link>
              {chamada && (
                <Link href={chamada.href} className="btn-primary btn-sm">
                  {chamada.label}
                </Link>
              )}
            </>
          )}
        </div>

        <button
          className="rounded-lg p-2 text-ink-700 hover:bg-ink-100 md:hidden"
          onClick={() => setOpen((value) => !value)}
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          aria-expanded={open}
        >
          {open ? <IconClose className="h-5 w-5" /> : <IconMenu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-ink-100 bg-white md:hidden">
          <div className="container-page flex flex-col gap-1 py-3">
            {menu.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-ink-700 hover:bg-ink-100"
              >
                {item.label}
              </Link>
            ))}
            <div className="my-2 h-px bg-ink-100" />
            {user ? (
              <>
                {painelDe(user.role) && (
                  <Link
                    href={painelDe(user.role)!}
                    className="rounded-lg px-3 py-2.5 text-sm font-semibold text-brand-700"
                  >
                    {user.role === "admin" ? "Administração" : "Painel"}
                  </Link>
                )}
                <Link href={CONTA} className="rounded-lg px-3 py-2.5 text-sm font-medium text-ink-700">
                  Minha conta
                </Link>
                {accountItems(user.role).map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded-lg px-3 py-2.5 text-sm font-medium text-ink-700"
                  >
                    {item.label}
                  </Link>
                ))}
                <button onClick={handleLogout} className="rounded-lg px-3 py-2.5 text-left text-sm text-ink-600">
                  Sair
                </button>
              </>
            ) : (
              <>
                <Link href="/entrar" className="rounded-lg px-3 py-2.5 text-sm font-medium text-ink-700">
                  Entrar
                </Link>
                {chamada && (
                  <Link href={chamada.href} className="btn-primary mt-1">
                    {chamada.label}
                  </Link>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
