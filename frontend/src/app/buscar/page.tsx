import SearchBar from "@/components/SearchBar";
import SearchFilters from "@/components/SearchFilters";
import SearchResults from "@/components/SearchResults";
import Pagination from "@/components/Pagination";
import SearchNotice from "@/components/SearchNotice";
import ClearSearch from "@/components/ClearSearch";
import { api } from "@/lib/api";
import type { Category, SearchResult } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Procurar profissionais",
  description:
    "Busque manicures, podologos, tatuadores e esteticistas perto de si. " +
    "Compare preços, avaliações e horários livres.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function BuscarPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;

  const q = first(params.q) ?? "";
  const city = first(params.city) ?? "";
  const category = first(params.category) ?? "";
  const sort = first(params.sort) ?? "relevance";
  const page = Number(first(params.page) ?? 1) || 1;
  const lat = first(params.lat);
  const lng = first(params.lng);
  const atHome = first(params.at_home);
  const featured = first(params.featured);
  const radiusKm = first(params.radius_km);

  const query = {
    q: q || undefined,
    city: city || undefined,
    category: category || undefined,
    sort,
    page,
    per_page: 12,
    lat,
    lng,
    at_home: atHome === "1" ? true : undefined,
    featured: featured === "1" ? true : undefined,
    radius_km: radiusKm,
  };

  let result: SearchResult = {
    items: [], total: 0, page: 1, per_page: 12, pages: 1,
    matched_city: null, radius_km: null, expanded: false, nearest_km: null,
    region_total: 0, elsewhere_total: 0, featured_total: 0,
  };
  let categories: Category[] = [];
  let failed = false;

  try {
    [result, categories] = await Promise.all([
      api.get<SearchResult>("/search", { params: query }),
      api.get<Category[]>("/categories", { revalidate: 300 }),
    ]);
  } catch {
    failed = true;
  }

  const activeCategory = categories.find((item) => item.slug === category);

  // Frase pronta, com preposicao: "em Manaus, AM" ou "perto de si". Montar
  // aqui evita textos como "em sua localização" nas mensagens.
  const naRegiao = result.region_total ?? 0;
  const foraDaRegiao = result.total - naRegiao;

  const locationPhrase = result.matched_city
    ? `em ${result.matched_city.name}${
        // Muitas capitais de distrito têm o nome do próprio distrito:
        // "em Lisboa, Lisboa" seria ruído.
        result.matched_city.state && result.matched_city.state !== result.matched_city.name
          ? `, ${result.matched_city.state}`
          : ""
      }`
    : city
      ? `em ${city}`
      : lat && lng
        ? "perto de si"
        : null;

  // "3 em Braga e mais 7 noutras localidades" diz mais do que um total solto.
  const resumo =
    result.total === 0
      ? "Nenhum resultado"
      : !locationPhrase
        ? `${result.total} ${result.total === 1 ? "profissional" : "profissionais"}`
        : naRegiao === 0
          ? `Ninguém ${locationPhrase}. ${foraDaRegiao} ${
              foraDaRegiao === 1 ? "profissional" : "profissionais"
            } noutras localidades.`
          : `${naRegiao} ${naRegiao === 1 ? "profissional" : "profissionais"} ${locationPhrase}` +
            (foraDaRegiao > 0 ? ` e mais ${foraDaRegiao} noutras localidades` : "");

  return (
    <div className="bg-ink-50">
      <div className="border-b border-ink-100 bg-white">
        <div className="container-page py-6">
          <SearchBar defaultQuery={q} defaultLocation={city} />
        </div>
      </div>

      <div className="container-page py-8">
        <div className="grid gap-8 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <SearchFilters categories={categories} />
          </aside>

          <div>
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
              <div className="min-w-0">
                <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
                  {activeCategory
                    ? activeCategory.name
                    : q
                      ? `Resultados para "${q}"`
                      : "Profissionais disponíveis"}
                </h1>
                <p className="mt-1 text-sm text-ink-500">{resumo}</p>
              </div>
              <ClearSearch className="shrink-0" />
            </div>

            {failed && (
              <p className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Não conseguimos carregar os resultados agora. Tente recarregar a página.
              </p>
            )}

            {!failed && result.expanded && result.items.length > 0 && (
              <SearchNotice
                where={locationPhrase}
                usedRadius={Boolean(result.matched_city) || Boolean(lat && lng)}
                radiusKm={result.radius_km}
                nearestKm={result.nearest_km}
                total={result.total}
              />
            )}

            {!failed && result.items.length === 0 && (
              <div className="mt-6 rounded-xl2 border border-dashed border-ink-200 bg-white px-6 py-16 text-center">
                <h2 className="text-lg font-semibold text-ink-900">
                  {page > 1 ? "Não há mais resultados" : "Não encontrámos ninguém com estes filtros"}
                </h2>
                <p className="mx-auto mt-2 max-w-md text-sm text-ink-500">
                  {page > 1
                    ? "Chegou ao fim da lista. Volte à primeira página para rever os resultados."
                    : "A localidade já não limita a pesquisa, por isso o que resta são os filtros: tente remover algum ou procurar por outra especialidade."}
                </p>
              </div>
            )}

            <SearchResults items={result.items} where={locationPhrase} />

            {result.pages > 1 && (
              <Pagination page={result.page} pages={result.pages} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
