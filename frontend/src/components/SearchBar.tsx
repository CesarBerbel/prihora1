"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

import { IconClose, IconPin, IconSearch } from "@/components/Icons";
import { api } from "@/lib/api";
import { camposASeguir, pesquisaEscrita, pesquisaPorLocalizacao } from "@/lib/search";
import type { City } from "@/lib/types";

interface Props {
  defaultQuery?: string;
  defaultLocation?: string;
  /** Visual maior, usado no hero da home. */
  size?: "hero" | "compact";
}

function Barra({
  defaultQuery = "",
  defaultLocation = "",
  size = "compact",
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(defaultQuery);
  const [location, setLocation] = useState(defaultLocation);
  const [suggestions, setSuggestions] = useState<City[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [locating, setLocating] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  /**
   * Os campos seguem o endereço.
   *
   * Sem isto, "Limpar pesquisa" esvaziava o endereço e as caixas ficavam com
   * o texto antigo — o estado do componente sobrevive a uma navegação do lado
   * do cliente. Compara-se com o valor anterior *do endereço*, e não com o que
   * está escrito: assim o que a pessoa está a escrever não é apagado por uma
   * mudança de filtro na coluna ao lado.
   */
  const qUrl = searchParams.get("q") ?? "";
  const cityUrl = searchParams.get("city") ?? "";
  const anterior = useRef({ q: qUrl, city: cityUrl });

  useEffect(() => {
    const mudancas = camposASeguir(anterior.current, { q: qUrl, city: cityUrl });
    anterior.current = { q: qUrl, city: cityUrl };

    if (mudancas.q !== undefined) setQuery(mudancas.q);
    if (mudancas.city !== undefined) {
      setLocation(mudancas.city);
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [qUrl, cityUrl]);

  // Autocomplete de cidades, com debounce para não inundar a API.
  useEffect(() => {
    const term = location.trim();
    if (term.length < 2) {
      setSuggestions([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      api
        .get<City[]>("/cities", { params: { q: term, limit: 6 }, signal: controller.signal })
        .then(setSuggestions)
        .catch(() => setSuggestions([]));
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [location]);

  // Fecha a lista ao clicar fora.
  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  /** "Almada, Setúbal" — sem repetir quando a localidade dá nome ao distrito. */
  function rotuloCidade(city: City): string {
    return city.state && city.state !== city.name ? `${city.name}, ${city.state}` : city.name;
  }

  function submit(event?: React.FormEvent) {
    event?.preventDefault();
    const params = pesquisaEscrita(searchParams.toString(), {
      q: query,
      city: location,
    });
    router.push(`/buscar?${params.toString()}`);
  }

  /**
   * Coordenadas do navegador, traduzidas na localidade mais próxima que
   * conhecemos, para o campo não ficar vazio quando o resultado aparece.
   *
   * O nome vem da nossa tabela de localidades e não de um serviço externo:
   * é o unico que a pesquisa sabe reconhecer se o visitante carregar em
   * "Procurar" outra vez, ja sem a localização do dispositivo.
   */
  async function useMyLocation() {
    if (!navigator.geolocation) return;
    setLocating(true);

    const position = await new Promise<GeolocationPosition | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), { timeout: 8000 });
    });
    if (!position) {
      setLocating(false);
      return;
    }

    const lat = position.coords.latitude.toFixed(6);
    const lng = position.coords.longitude.toFixed(6);

    let perto: City | null = null;
    try {
      perto = await api.get<City | null>("/cities/nearest", { params: { lat, lng } });
    } catch {
      // Sem nome nao ficamos sem pesquisa: as coordenadas bastam para ordenar.
      perto = null;
    }

    const rotulo = perto ? rotuloCidade(perto) : "";
    if (perto) {
      setLocation(rotulo);
      setSuggestions([]);
      setShowSuggestions(false);
    }

    const params = pesquisaPorLocalizacao(searchParams.toString(), {
      q: query,
      city: rotulo,
      lat,
      lng,
    });

    setLocating(false);
    router.push(`/buscar?${params.toString()}`);
  }

  const hero = size === "hero";

  return (
    <div className="w-full">
      {/* Fora do campo: dentro dele espremia o texto ate o cortar a meio. */}
      <div className="mb-2 flex justify-end">
        <button
          type="button"
          onClick={useMyLocation}
          disabled={locating}
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-ink-500 transition hover:bg-white/70 hover:text-brand-700 disabled:opacity-50"
        >
          <IconPin className="h-3.5 w-3.5" />
          {locating ? "A localizar..." : "Usar a minha localização"}
        </button>
      </div>

      <form
        onSubmit={submit}
        className={`flex w-full flex-col gap-2 rounded-xl2 border border-ink-100 bg-white p-2 shadow-lift sm:flex-row sm:items-center ${
          hero ? "sm:p-2.5" : ""
        }`}
      >
        <div className="flex flex-1 items-center gap-2 px-3">
          <IconSearch className="h-5 w-5 shrink-0 text-ink-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Manicure, tatuagem, podologia..."
            aria-label="Serviço ou especialidade"
            className={`w-full bg-transparent py-2.5 text-ink-900 placeholder:text-ink-400 focus:outline-none ${
              hero ? "text-base" : "text-sm"
            }`}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="shrink-0 rounded-full p-1 text-ink-400 transition hover:bg-ink-100 hover:text-ink-700"
              aria-label="Limpar o serviço"
            >
              <IconClose className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="hidden h-8 w-px bg-ink-100 sm:block" />

        <div ref={boxRef} className="relative flex flex-1 items-center gap-2 px-3">
          <IconPin className="h-5 w-5 shrink-0 text-ink-400" />
          <input
            value={location}
            onChange={(event) => {
              setLocation(event.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            placeholder="Localidade ou freguesia"
            aria-label="Localidade"
            autoComplete="off"
            className={`w-full bg-transparent py-2.5 text-ink-900 placeholder:text-ink-400 focus:outline-none ${
              hero ? "text-base" : "text-sm"
            }`}
          />
          {location && (
            <button
              type="button"
              onClick={() => {
                setLocation("");
                setShowSuggestions(false);
              }}
              className="shrink-0 rounded-full p-1 text-ink-400 transition hover:bg-ink-100 hover:text-ink-700"
              aria-label="Limpar a localidade"
            >
              <IconClose className="h-4 w-4" />
            </button>
          )}
          {showSuggestions && suggestions.length > 0 && (
            <ul className="absolute left-0 top-full z-20 mt-2 w-full overflow-hidden rounded-xl border border-ink-100 bg-white py-1 shadow-lift">
              {suggestions.map((city) => (
                <li key={city.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setLocation(rotuloCidade(city));
                      setShowSuggestions(false);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink-700 hover:bg-brand-50"
                  >
                    <IconPin className="h-4 w-4 text-ink-400" />
                    {rotuloCidade(city)}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button type="submit" className={`btn-primary ${hero ? "sm:px-8 sm:py-3" : ""}`}>
          Procurar
        </button>
      </form>
    </div>
  );
}

/**
 * A barra le os parametros do endereco para os filtros se somarem, e isso
 * obriga a uma fronteira de Suspense em paginas geradas de antemao. Fica aqui
 * dentro: assim qualquer pagina a pode usar sem ter de se lembrar disto.
 */
export default function SearchBar(props: Props) {
  const hero = props.size === "hero";
  return (
    <Suspense
      fallback={
        <div className="w-full">
          <div className="mb-2 h-6" />
          <div
            className={`w-full animate-pulse rounded-xl2 border border-ink-100 bg-white shadow-lift ${
              hero ? "h-[68px]" : "h-[60px]"
            }`}
          />
        </div>
      }
    >
      <Barra {...props} />
    </Suspense>
  );
}
