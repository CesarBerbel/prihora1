import { IconPin } from "@/components/Icons";
import { formatDistance } from "@/lib/format";

interface Props {
  /** Frase pronta com preposicao: "em Manaus, AM" ou "perto de si". */
  where: string | null;
  /**
   * True quando a pesquisa realmente aplicou um raio, ou seja, quando havia
   * coordenadas de referência. Procurar por uma cidade desconhecida cai no
   * casamento por texto, sem raio nenhum: mencionar km ali seria mentira.
   */
  usedRadius: boolean;
  radiusKm?: number | null;
  nearestKm?: number | null;
  total: number;
}

/**
 * Aviso de pesquisa ampliada: não há ninguém na área pedida, entao estamos
 * mostrando os mais próximos que existem, em ordem de distância.
 */
export default function SearchNotice({
  where,
  usedRadius,
  radiusKm,
  nearestKm,
  total,
}: Props) {
  const onde = where ?? "nesta região";
  const nearest = formatDistance(nearestKm);
  const umSo = total === 1;

  return (
    <div className="mt-6 flex items-start gap-3 rounded-xl2 border border-amber-200 bg-amber-50 p-4 sm:p-5">
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-700">
        <IconPin className="h-4 w-4" />
      </span>

      <div className="min-w-0">
        <h2 className="font-semibold text-amber-900">
          Ainda não temos profissionais {onde}
          {usedRadius && radiusKm ? ` num raio de ${Math.round(radiusKm)} km` : ""}
        </h2>

        <p className="mt-1 text-sm leading-relaxed text-amber-800">
          {nearest ? (
            umSo ? (
              <>
                Abaixo esta o profissional mais próximo, a <strong>{nearest}</strong> daqui.
              </>
            ) : (
              <>
                Abaixo estao os <strong>{total} mais próximos</strong>, em ordem de distância.
                O primeiro fica a <strong>{nearest}</strong> daqui.
              </>
            )
          ) : (
            <>
              Abaixo estao os profissionais disponíveis em outras regiões. Se algum atender
              ao domicílio, pode valer a pena consultar.
            </>
          )}
        </p>
      </div>
    </div>
  );
}
