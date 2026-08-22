import Link from "next/link";

import { IconSparkles } from "@/components/Icons";

const COLUMNS = [
  {
    title: "Para clientes",
    links: [
      // Só o que também é menu. As especialidades mudam com o catálogo e
      // ficavam desalinhadas do que a administração edita.
      { href: "/buscar", label: "Procurar profissionais" },
      { href: "/agendamento", label: "A minha marcação" },
      { href: "/como-funciona", label: "Como funciona" },
    ],
  },
  {
    title: "Para profissionais",
    links: [
      { href: "/para-profissionais/como-funciona", label: "Como funciona" },
      { href: "/para-profissionais/registo", label: "Registar o meu trabalho" },
      { href: "/planos", label: "Planos e preços" },
      { href: "/painel", label: "Entrar no painel" },
    ],
  },
  {
    title: "prihora",
    links: [
      { href: "/sobre", label: "Sobre" },
      { href: "/termos", label: "Termos de utilização" },
      { href: "/privacidade", label: "Privacidade" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="mt-20 border-t border-ink-100 bg-white">
      <div className="container-page py-12">
        <div className="grid gap-10 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-2 text-lg font-bold">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-brand-600 text-white">
                <IconSparkles className="h-4 w-4" />
              </span>
              <span>
                pri<span className="text-brand-600">hora</span>
              </span>
            </div>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-ink-500">
              A forma simples de encontrar e marcar profissionais de estética perto de si.
            </p>
          </div>

          {COLUMNS.map((column) => (
            <div key={column.title}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                {column.title}
              </h3>
              <ul className="mt-3 space-y-2">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-ink-600 transition hover:text-brand-700"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-ink-100 pt-6 text-xs text-ink-400 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} prihora. Todos os direitos reservados.</p>
          <p>Feito para profissionais liberais da área da estética.</p>
        </div>
      </div>
    </footer>
  );
}
