"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import BookingActions from "@/components/BookingActions";
import { IconCalendar, IconSearch } from "@/components/Icons";
import { ApiError, api } from "@/lib/api";
import {
  BOOKING_STATUS_LABEL,
  BOOKING_STATUS_STYLE,
  formatDateTime,
  formatPrice,
} from "@/lib/format";
import type { BookingLookup } from "@/lib/types";

function Consulta() {
  const searchParams = useSearchParams();
  const [code, setCode] = useState(searchParams.get("code") ?? "");
  const [booking, setBooking] = useState<BookingLookup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function lookup(value: string) {
    const clean = value.trim().toUpperCase();
    if (!clean) return;
    setLoading(true);
    setError(null);
    try {
      setBooking(await api.get<BookingLookup>(`/bookings/${clean}`));
    } catch (err) {
      setBooking(null);
      setError(
        err instanceof ApiError && err.status === 404
          ? "Não encontramos nenhuma marcação com este código."
          : "Não foi possível consultar agora.",
      );
    } finally {
      setLoading(false);
    }
  }

  // Consulta automática quando o código chega pela URL.
  useEffect(() => {
    const initial = searchParams.get("code");
    if (initial) void lookup(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void lookup(code);
        }}
        className="flex gap-2"
      >
        <input
          className="input font-mono uppercase"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="PHA1B2C3"
          aria-label="Código da marcação"
        />
        <button type="submit" disabled={loading} className="btn-primary shrink-0">
          <IconSearch className="h-4 w-4" />
          {loading ? "A procurar..." : "Consultar"}
        </button>
      </form>

      {error && (
        <p className="mt-6 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
      )}

      {booking && (
        <div className="card mt-6 overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-ink-100 bg-ink-50/60 px-6 py-4">
            <p className="font-mono font-bold tracking-wide">{booking.code}</p>
            <span className={`chip ${BOOKING_STATUS_STYLE[booking.status]}`}>
              {BOOKING_STATUS_LABEL[booking.status]}
            </span>
          </div>

          <dl className="divide-y divide-ink-100 px-6 py-2 text-sm">
            <div className="flex justify-between gap-4 py-3">
              <dt className="text-ink-500">Serviço</dt>
              <dd className="text-right font-medium">{booking.service_name}</dd>
            </div>
            <div className="flex justify-between gap-4 py-3">
              <dt className="text-ink-500">Quando</dt>
              <dd className="text-right font-medium">{formatDateTime(booking.starts_at)}</dd>
            </div>
            <div className="flex justify-between gap-4 py-3">
              <dt className="text-ink-500">Cliente</dt>
              <dd className="text-right font-medium">{booking.client_name}</dd>
            </div>
            <div className="flex justify-between gap-4 py-3">
              <dt className="text-ink-500">Valor</dt>
              <dd className="text-right font-semibold">{formatPrice(booking.price_cents)}</dd>
            </div>
            {booking.address_line && (
              <div className="flex justify-between gap-4 py-3">
                <dt className="text-ink-500">Morada</dt>
                <dd className="text-right font-medium">{booking.address_line}</dd>
              </div>
            )}
            {booking.cancel_reason && (
              <div className="flex justify-between gap-4 py-3">
                <dt className="text-ink-500">Motivo</dt>
                <dd className="text-right text-rose-600">{booking.cancel_reason}</dd>
              </div>
            )}
          </dl>

          <BookingActions booking={booking} onChanged={setBooking} />
        </div>
      )}
    </>
  );
}

export default function AgendamentoPage() {
  return (
    <div className="container-page py-16">
      <div className="mx-auto max-w-lg">
        <div className="text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-brand-600 text-white">
            <IconCalendar className="h-6 w-6" />
          </span>
          <h1 className="mt-4 text-2xl font-bold tracking-tight">Consultar marcação</h1>
          <p className="mt-2 text-sm text-ink-500">
            Escreva o código que recebeu ao reservar o horário. Também lho enviámos por WhatsApp.
          </p>
        </div>

        <div className="mt-8">
          <Suspense fallback={<div className="h-12 animate-pulse rounded-xl bg-ink-100" />}>
            <Consulta />
          </Suspense>
        </div>

        <p className="mt-8 text-center text-sm text-ink-500">
          Tem conta no prihora?{" "}
          <Link href="/minha-conta" className="font-semibold text-brand-600 hover:text-brand-700">
            Ver todas as suas marcações
          </Link>
        </p>
      </div>
    </div>
  );
}
