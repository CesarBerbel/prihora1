"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export default function Pagination({ page, pages }: { page: number; pages: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function goTo(target: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (target <= 1) params.delete("page");
    else params.set("page", String(target));
    router.push(`${pathname}?${params.toString()}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Janela de no máximo 5 numeros ao redor da página atual.
  const start = Math.max(1, Math.min(page - 2, pages - 4));
  const visible = Array.from({ length: Math.min(5, pages) }, (_, i) => start + i).filter(
    (n) => n >= 1 && n <= pages,
  );

  return (
    <nav className="mt-10 flex items-center justify-center gap-1.5" aria-label="Paginação">
      <button
        onClick={() => goTo(page - 1)}
        disabled={page <= 1}
        className="btn-secondary btn-sm disabled:opacity-40"
      >
        Anterior
      </button>

      {visible.map((number) => (
        <button
          key={number}
          onClick={() => goTo(number)}
          aria-current={number === page ? "page" : undefined}
          className={`h-9 w-9 rounded-full text-sm font-semibold transition ${
            number === page
              ? "bg-brand-600 text-white"
              : "text-ink-600 hover:bg-ink-100"
          }`}
        >
          {number}
        </button>
      ))}

      <button
        onClick={() => goTo(page + 1)}
        disabled={page >= pages}
        className="btn-secondary btn-sm disabled:opacity-40"
      >
        Próxima
      </button>
    </nav>
  );
}
