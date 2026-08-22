"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";

import type { Category } from "@/lib/types";

const SORT_OPTIONS = [
  { value: "relevance", label: "Mais relevantes" },
  { value: "distance", label: "Mais próximos" },
  { value: "rating", label: "Melhor avaliados" },
  { value: "price", label: "Menor preço" },
  { value: "newest", label: "Novos no prihora" },
];

/** Quantas especialidades ficam à vista antes de se pedir o resto. */
const VISIVEIS_POR_OMISSAO = 6;

const RADIUS_OPTIONS = [
  { value: "5", label: "Até 5 km" },
  { value: "10", label: "Até 10 km" },
  { value: "25", label: "Até 25 km" },
  { value: "50", label: "Até 50 km" },
  { value: "100", label: "Até 100 km" },
];

export default function SearchFilters({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const update = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === null || value === "") params.delete(key);
      else params.set(key, value);
      // Qualquer mudanca de filtro reinicia a paginacao.
      params.delete("page");
      router.push(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams],
  );

  const category = searchParams.get("category") ?? "";
  const sort = searchParams.get("sort") ?? "relevance";
  const radius = searchParams.get("radius_km") ?? "";
  const atHome = searchParams.get("at_home") === "1";
  const emDestaque = searchParams.get("featured") === "1";

  const [todas, setTodas] = useState(false);
  // A especialidade escolhida tem de estar sempre à vista, mesmo que fique
  // fora das primeiras: escondê-la fazia o filtro activo parecer desligado.
  const escolhidaEstaFora =
    Boolean(category) &&
    categories.findIndex((item) => item.slug === category) >= VISIVEIS_POR_OMISSAO;
  const visiveis =
    todas || escolhidaEstaFora ? categories : categories.slice(0, VISIVEIS_POR_OMISSAO);

  return (
    <div className="space-y-6 rounded-xl2 border border-ink-100 bg-white p-5 shadow-card">
      <div>
        <label className="label" htmlFor="filtro-ordem">
          Ordenar por
        </label>
        <select
          id="filtro-ordem"
          className="input"
          value={sort}
          onChange={(event) => update("sort", event.target.value)}
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="label" htmlFor="filtro-raio">
          Distância
        </label>
        <select
          id="filtro-raio"
          className="input"
          value={radius}
          onChange={(event) => update("radius_km", event.target.value || null)}
        >
          <option value="">Qualquer distância</option>
          {RADIUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <p className="field-hint">Vale quando há cidade ou localização na pesquisa.</p>
      </div>

      <div>
        <span className="label">Atendimento</span>
        <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-ink-200 px-3 py-2.5 text-sm text-ink-700 transition hover:bg-ink-50">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
            checked={atHome}
            onChange={(event) => update("at_home", event.target.checked ? "1" : null)}
          />
          Atende ao domicílio
        </label>

        <label className="mt-2 flex cursor-pointer items-start gap-2.5 rounded-xl border border-ink-200 px-3 py-2.5 text-sm text-ink-700 transition hover:bg-ink-50">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
            checked={emDestaque}
            onChange={(event) => update("featured", event.target.checked ? "1" : null)}
          />
          <span>
            Em destaque
            <span className="block text-xs text-ink-400">
              Perfis destacados pelo prihora.
            </span>
          </span>
        </label>
      </div>

      <div>
        <span className="label">Especialidade</span>
        {/* Sem barra de rolagem dentro da coluna: uma lista que rola dentro de
            uma página que também rola faz o rato apanhar a errada. Mostra-se
            um punhado e o resto abre a pedido. */}
        <div className="space-y-0.5">
          <button
            onClick={() => update("category", null)}
            className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${
              category === ""
                ? "bg-brand-50 font-semibold text-brand-700"
                : "text-ink-600 hover:bg-ink-50"
            }`}
          >
            Todas
          </button>
          {visiveis.map((item) => (
            <button
              key={item.id}
              onClick={() => update("category", item.slug)}
              className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                category === item.slug
                  ? "bg-brand-50 font-semibold text-brand-700"
                  : "text-ink-600 hover:bg-ink-50"
              }`}
            >
              <span className="truncate">{item.name}</span>
              <span className="shrink-0 text-xs text-ink-400">{item.professional_count ?? 0}</span>
            </button>
          ))}

          {categories.length > VISIVEIS_POR_OMISSAO && (
            <button
              onClick={() => setTodas((valor) => !valor)}
              aria-expanded={todas}
              className="flex w-full items-center justify-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold text-brand-600 transition hover:bg-brand-50"
            >
              {todas
                ? "Mostrar menos"
                : `Mostrar mais ${categories.length - VISIVEIS_POR_OMISSAO}`}
              <span aria-hidden className={`text-[10px] transition ${todas ? "rotate-180" : ""}`}>
                ▾
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
