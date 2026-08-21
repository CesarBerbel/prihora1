"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { IconClose } from "@/components/Icons";

/**
 * Repõe a pesquisa no estado inicial: sem termo, sem localidade e sem filtros.
 *
 * É o único botão de limpar: apaga o termo, a localidade, as coordenadas e
 * todos os filtros da coluna. Existe porque fazê-lo à mão exigia esvaziar dois
 * campos e repor cada filtro um a um — e, com a pesquisa guardada no endereço,
 * recarregar a página não chegava para começar de novo.
 */
export default function ClearSearch({ className = "" }: { className?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Só faz sentido quando há alguma coisa para limpar.
  const activos = [
    "q", "city", "category", "lat", "lng", "radius_km", "at_home", "featured", "sort",
  ].filter(
    (chave) => searchParams.get(chave),
  );
  if (activos.length === 0) return null;

  return (
    <button
      type="button"
      onClick={() => router.push("/buscar")}
      className={`btn-ghost btn-sm text-ink-500 ${className}`}
    >
      <IconClose className="h-3.5 w-3.5" />
      Limpar pesquisa
    </button>
  );
}
