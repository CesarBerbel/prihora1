"use client";

/**
 * O cracha do utilizador, no cabecalho.
 *
 * Abre ao passar o rato e leva a "Minha conta" ao carregar — as duas coisas no
 * mesmo sitio. O fecho tem um atraso curto porque entre o cracha e o menu ha
 * uma frincha de pixeis, e sem esse atraso o menu fugia a meio do caminho.
 *
 * Como no submenu do painel, o menu e desenhado colado ao body: o cabecalho
 * tem `backdrop-blur`, e um filtro faz de bloco de contencao para o que esta
 * dentro dele, prendendo ali qualquer coisa posicionada.
 */

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { CONTA, accountItems, painelDe } from "@/components/AccountNav";
import { IconUser } from "@/components/Icons";
import { useSession } from "@/lib/auth";

const LARGURA = 208;
/** Tempo para atravessar a frincha entre o cracha e o menu. */
const ATRASO_MS = 180;

export default function UserBadge() {
  const { user, logout } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const [caixa, setCaixa] = useState<{ top: number; left: number } | null>(null);
  const ancoraRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aberto = caixa !== null;

  const cancelarFecho = () => {
    if (temporizador.current) {
      clearTimeout(temporizador.current);
      temporizador.current = null;
    }
  };

  const medir = useCallback(() => {
    const ancora = ancoraRef.current;
    if (!ancora) return;
    const r = ancora.getBoundingClientRect();
    // Alinhado a direita do cracha: e ai que ele vive no cabecalho.
    const left = Math.min(r.right - LARGURA, window.innerWidth - LARGURA - 8);
    setCaixa({ top: r.bottom + 6, left: Math.max(8, left) });
  }, []);

  const abrir = useCallback(() => {
    cancelarFecho();
    medir();
  }, [medir]);

  const fecharComAtraso = useCallback(() => {
    cancelarFecho();
    temporizador.current = setTimeout(() => setCaixa(null), ATRASO_MS);
  }, []);

  useEffect(() => {
    setCaixa(null);
    cancelarFecho();
  }, [pathname]);

  useEffect(() => cancelarFecho, []);

  useEffect(() => {
    if (!aberto) return;
    function escape(evento: KeyboardEvent) {
      if (evento.key === "Escape") setCaixa(null);
    }
    function fora(evento: MouseEvent) {
      const alvo = evento.target as Node;
      if (ancoraRef.current?.contains(alvo) || menuRef.current?.contains(alvo)) return;
      setCaixa(null);
    }
    document.addEventListener("keydown", escape);
    document.addEventListener("mousedown", fora);
    window.addEventListener("resize", medir);
    window.addEventListener("scroll", medir, true);
    return () => {
      document.removeEventListener("keydown", escape);
      document.removeEventListener("mousedown", fora);
      window.removeEventListener("resize", medir);
      window.removeEventListener("scroll", medir, true);
    };
  }, [aberto, medir]);

  if (!user) return null;

  const itens = accountItems(user.role);
  const painel = painelDe(user.role);

  function sair() {
    setCaixa(null);
    logout();
    router.push("/");
  }

  return (
    <div
      ref={ancoraRef}
      className="relative"
      onMouseEnter={abrir}
      onMouseLeave={fecharComAtraso}
      onFocus={abrir}
      onBlur={(evento) => {
        if (!evento.currentTarget.contains(evento.relatedTarget as Node)) fecharComAtraso();
      }}
    >
      <Link
        href={CONTA}
        aria-haspopup="menu"
        aria-expanded={aberto}
        className={`btn-secondary btn-sm ${aberto ? "bg-ink-100" : ""}`}
      >
        <IconUser className="h-4 w-4" />
        {user.name.split(" ")[0]}
        <span aria-hidden className={`text-[10px] transition ${aberto ? "rotate-180" : ""}`}>
          ▾
        </span>
      </Link>

      {caixa &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{ top: caixa.top, left: caixa.left, width: LARGURA }}
            onMouseEnter={cancelarFecho}
            onMouseLeave={fecharComAtraso}
            className="fixed z-50 overflow-hidden rounded-xl border border-ink-100 bg-white py-1 shadow-lift"
          >
            {/* A frincha entre o cracha e o menu, coberta para o rato poder
                atravessa-la sem o menu se fechar a meio. */}
            <span aria-hidden className="absolute -top-2 left-0 h-2 w-full" />

            <div className="border-b border-ink-100 px-4 py-2.5">
              <p className="truncate text-sm font-semibold text-ink-900">{user.name}</p>
              <p className="truncate text-xs text-ink-400">{user.email}</p>
            </div>

            <ItemMenu href={CONTA} pathname={pathname} fechar={() => setCaixa(null)}>
              Minha conta
            </ItemMenu>

            {itens.map((item) => (
              <ItemMenu
                key={item.href}
                href={item.href}
                pathname={pathname}
                fechar={() => setCaixa(null)}
              >
                {item.label}
              </ItemMenu>
            ))}

            {/* Nao estava na lista pedida, mas sem ele quem esta na conta —
                ou a navegar no site publico — fica sem caminho de volta. */}
            {painel && (
              <ItemMenu href={painel} pathname={pathname} fechar={() => setCaixa(null)}>
                {user.role === "admin" ? "Administração" : "Painel"}
              </ItemMenu>
            )}

            <div className="my-1 h-px bg-ink-100" />
            <button
              type="button"
              role="menuitem"
              onClick={sair}
              className="block w-full px-4 py-2.5 text-left text-sm text-ink-700 transition hover:bg-ink-50"
            >
              Sair
            </button>
          </div>,
          document.body,
        )}
    </div>
  );
}

function ItemMenu({
  href,
  pathname,
  fechar,
  children,
}: {
  href: string;
  pathname: string;
  fechar: () => void;
  children: React.ReactNode;
}) {
  const ativo = pathname === href;
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={fechar}
      className={`block px-4 py-2.5 text-sm transition hover:bg-ink-50 ${
        ativo ? "font-semibold text-brand-700" : "text-ink-700"
      }`}
    >
      {children}
    </Link>
  );
}
