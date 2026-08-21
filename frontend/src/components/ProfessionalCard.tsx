import Link from "next/link";

import { IconHome, IconPin, IconStar, IconVerified } from "@/components/Icons";
import { avatarUrl, formatDistance, formatPrice } from "@/lib/format";
import type { ProfessionalCard as Card } from "@/lib/types";

export default function ProfessionalCardItem({ pro }: { pro: Card }) {
  const distance = formatDistance(pro.distance_km);

  return (
    <Link
      href={`/p/${pro.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl2 border border-ink-100 bg-white shadow-card transition hover:-translate-y-0.5 hover:shadow-lift"
    >
      <div className="flex items-start gap-4 p-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={avatarUrl(pro.display_name, pro.avatar_url)}
          alt=""
          width={64}
          height={64}
          className="h-16 w-16 shrink-0 rounded-2xl object-cover ring-1 ring-ink-100"
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate font-semibold text-ink-900 group-hover:text-brand-700">
              {pro.display_name}
            </h3>
            {pro.is_verified && (
              <span title="Perfil verificado" className="shrink-0 text-brand-600">
                <IconVerified className="h-4 w-4" />
              </span>
            )}
          </div>

          {pro.headline && (
            <p className="mt-0.5 line-clamp-2 text-sm text-ink-500">{pro.headline}</p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500">
            {pro.rating_count > 0 ? (
              <span className="inline-flex items-center gap-1 font-medium text-ink-700">
                <IconStar className="h-3.5 w-3.5 text-amber-500" />
                {pro.rating_avg.toFixed(1).replace(".", ",")}
                <span className="font-normal text-ink-400">({pro.rating_count})</span>
              </span>
            ) : (
              <span className="text-ink-400">Sem avaliações ainda</span>
            )}

            {(pro.neighborhood || pro.city) && (
              <span className="inline-flex items-center gap-1">
                <IconPin className="h-3.5 w-3.5" />
                {pro.neighborhood ? `${pro.neighborhood}, ` : ""}
                {pro.city}
                {/* Evita "Lisboa, Lisboa" nas capitais de distrito. */}
                {pro.state && pro.state !== pro.city ? ` (${pro.state})` : ""}
              </span>
            )}

            {distance && (
              <span className="font-medium text-brand-700">a {distance} de si</span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-ink-100 bg-ink-50/60 px-5 py-3">
        {pro.categories.slice(0, 3).map((category) => (
          <span key={category.id} className="chip bg-white text-ink-600 ring-ink-200">
            {category.name}
          </span>
        ))}
        {pro.serves_at_home && (
          <span className="chip bg-brand-50 text-brand-700 ring-brand-200">
            <IconHome className="h-3 w-3" />
            Ao domicílio
          </span>
        )}

        <span className="ml-auto text-sm font-semibold text-ink-900">
          {pro.price_from_cents !== null && pro.price_from_cents !== undefined ? (
            <>
              <span className="text-xs font-normal text-ink-400">a partir de </span>
              {formatPrice(pro.price_from_cents)}
            </>
          ) : (
            <span className="text-xs font-normal text-ink-400">Consultar valores</span>
          )}
        </span>
      </div>
    </Link>
  );
}
