"use client";

/**
 * Vista de mes: uma grelha de semanas, cada dia com as suas marcacoes em
 * miniatura. Nao mostra o tempo como altura — nesta escala nao caberia —, mas
 * mantem a ordem cronologica dentro de cada dia.
 */

import { useMemo } from "react";

import { mesmoDia } from "@/lib/calendar";
import { formatTime } from "@/lib/format";
import type { Booking } from "@/lib/types";
import { WEEKDAYS_SHORT } from "@/lib/format";

const PONTOS: Record<string, string> = {
  pending: "bg-amber-400",
  confirmed: "bg-emerald-500",
  completed: "bg-sky-500",
  cancelled: "bg-ink-300",
  no_show: "bg-rose-500",
};

/** Quantas marcacoes cabem numa celula antes do "+N". */
const CABEM = 3;

interface Props {
  dias: Date[];
  mesVisivel: number;
  bookings: Booking[];
  aberto: Booking | null;
  onAbrir: (booking: Booking) => void;
  /** Carregar no numero do dia salta para a vista de dia. */
  onVerDia: (dia: Date) => void;
}

export default function CalendarMonth({
  dias,
  mesVisivel,
  bookings,
  aberto,
  onAbrir,
  onVerDia,
}: Props) {
  const hoje = new Date();

  // Agrupa uma vez por dia, em vez de varrer a lista toda em cada celula.
  const porDia = useMemo(() => {
    const mapa = new Map<string, Booking[]>();
    for (const booking of bookings) {
      const data = new Date(booking.starts_at);
      const chave = `${data.getFullYear()}-${data.getMonth()}-${data.getDate()}`;
      const lista = mapa.get(chave);
      if (lista) lista.push(booking);
      else mapa.set(chave, [booking]);
    }
    for (const lista of mapa.values()) {
      lista.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    }
    return mapa;
  }, [bookings]);

  return (
    <div className="overflow-hidden rounded-xl2 border border-ink-100 bg-white">
      <div className="grid grid-cols-7 border-b border-ink-100">
        {WEEKDAYS_SHORT.map((nome) => (
          <div
            key={nome}
            className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-ink-400"
          >
            {nome}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {dias.map((dia) => {
          const chave = `${dia.getFullYear()}-${dia.getMonth()}-${dia.getDate()}`;
          const doDia = porDia.get(chave) ?? [];
          const eHoje = mesmoDia(dia, hoje);
          const doMes = dia.getMonth() === mesVisivel;

          return (
            <div
              key={dia.toISOString()}
              className={`min-h-28 border-b border-r border-ink-100 p-1.5 ${
                doMes ? "" : "bg-ink-50/60"
              }`}
            >
              <button
                type="button"
                onClick={() => onVerDia(dia)}
                title="Ver este dia"
                className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold transition ${
                  eHoje
                    ? "bg-brand-600 text-white"
                    : doMes
                      ? "text-ink-700 hover:bg-ink-100"
                      : "text-ink-300 hover:bg-ink-100"
                }`}
              >
                {dia.getDate()}
              </button>

              <div className="mt-1 space-y-0.5">
                {doDia.slice(0, CABEM).map((booking) => (
                  <button
                    key={booking.id}
                    type="button"
                    onClick={() => onAbrir(booking)}
                    className={`flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-[11px] leading-tight transition hover:bg-ink-100 ${
                      aberto?.id === booking.id ? "bg-ink-100 ring-1 ring-ink-900" : ""
                    } ${booking.status === "cancelled" ? "text-ink-400 line-through" : "text-ink-700"}`}
                  >
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                        PONTOS[booking.status] ?? PONTOS.confirmed
                      }`}
                    />
                    <span className="shrink-0 font-semibold">{formatTime(booking.starts_at)}</span>
                    <span className="truncate">{booking.client_name}</span>
                  </button>
                ))}

                {doDia.length > CABEM && (
                  <button
                    type="button"
                    onClick={() => onVerDia(dia)}
                    className="w-full rounded px-1 py-0.5 text-left text-[11px] font-semibold text-brand-600 hover:bg-brand-50"
                  >
                    mais {doDia.length - CABEM}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
