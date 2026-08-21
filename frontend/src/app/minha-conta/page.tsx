"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import AccountShell from "@/components/AccountShell";
import { IconCalendar, IconStar } from "@/components/Icons";
import { ApiError, api } from "@/lib/api";
import { useSession } from "@/lib/auth";
import {
  BOOKING_STATUS_LABEL,
  BOOKING_STATUS_STYLE,
  avatarUrl,
  formatDateTime,
  formatPrice,
} from "@/lib/format";
import type { Booking } from "@/lib/types";

export default function MinhaContaPage() {
  const { user, professionalSlug } = useSession();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [review, setReview] = useState<{ booking: Booking; rating: number; comment: string } | null>(
    null,
  );
  const [message, setMessage] = useState<{ kind: "ok" | "erro"; text: string } | null>(null);

  async function reload() {
    setBookings(await api.get<Booking[]>("/me/appointments", { auth: true }));
  }

  useEffect(() => {
    reload()
      .catch(() => setMessage({ kind: "erro", text: "Não foi possível carregar." }))
      .finally(() => setLoading(false));
  }, []);

  async function sendReview(event: React.FormEvent) {
    event.preventDefault();
    if (!review) return;
    try {
      await api.post(
        `/professionals/${review.booking.professional_slug}/reviews`,
        {
          booking_code: review.booking.code,
          rating: review.rating,
          comment: review.comment || null,
        },
        { auth: true },
      );
      setReview(null);
      await reload();
      setMessage({ kind: "ok", text: "Obrigado pela avaliação!" });
    } catch (error) {
      setMessage({
        kind: "erro",
        text: error instanceof ApiError ? error.message : "Não foi possível avaliar.",
      });
    }
  }

  const now = Date.now();
  const upcoming = bookings.filter(
    (item) => new Date(item.starts_at).getTime() >= now && item.status !== "cancelled",
  );
  const past = bookings.filter(
    (item) => new Date(item.starts_at).getTime() < now || item.status === "cancelled",
  );

  function card(booking: Booking, canReview = false) {
    return (
      <li key={booking.id} className="card flex items-start gap-4 p-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={avatarUrl(booking.professional_name ?? "?", booking.professional_avatar)}
          alt=""
          width={48}
          height={48}
          className="h-12 w-12 shrink-0 rounded-xl object-cover ring-1 ring-ink-100"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {booking.professional_slug ? (
              <Link
                href={`/p/${booking.professional_slug}`}
                className="font-semibold text-ink-900 hover:text-brand-700"
              >
                {booking.professional_name}
              </Link>
            ) : (
              <span className="font-semibold">{booking.professional_name}</span>
            )}
            <span className={`chip ${BOOKING_STATUS_STYLE[booking.status]}`}>
              {BOOKING_STATUS_LABEL[booking.status]}
            </span>
          </div>
          <p className="mt-1 text-sm text-ink-600">
            {booking.service_name} | {formatPrice(booking.price_cents)}
          </p>
          <p className="mt-0.5 text-sm font-medium text-ink-800">
            {formatDateTime(booking.starts_at)}
          </p>
          <p className="mt-1 text-xs text-ink-400">
            Código <span className="font-mono">{booking.code}</span>
          </p>

          {canReview && booking.status === "completed" && (
            <button
              onClick={() => setReview({ booking, rating: 5, comment: "" })}
              className="btn-secondary btn-sm mt-3"
            >
              <IconStar className="h-3.5 w-3.5 text-amber-500" />
              Avaliar atendimento
            </button>
          )}
        </div>
      </li>
    );
  }

  return (
    <AccountShell
      title="Minha conta"
      subtitle="Os seus dados e as marcações que fez como cliente."
      allow={["client", "professional", "admin"]}
      actions={
        <Link href="/buscar" className="btn-primary btn-sm">
          Marcar novo serviço
        </Link>
      }
    >
      {/* Quem sou eu aqui dentro. Curto de propósito: é a moldura de todo o
          resto, não uma página de definições. */}
      {user && (
        <div className="card mb-6 p-6">
          <h2 className="font-bold">A sua conta</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-xs text-ink-400">Nome</dt>
              <dd className="mt-0.5 text-sm font-medium text-ink-800">{user.name}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-ink-400">E-mail</dt>
              <dd className="mt-0.5 truncate text-sm font-medium text-ink-800">{user.email}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-400">Tipo de conta</dt>
              <dd className="mt-0.5 text-sm font-medium text-ink-800">
                {user.role === "professional"
                  ? "Profissional"
                  : user.role === "admin"
                    ? "Administração"
                    : "Cliente"}
              </dd>
            </div>
          </dl>

          {professionalSlug && (
            <Link
              href={`/p/${professionalSlug}`}
              className="btn-secondary btn-sm mt-5"
            >
              Ver o meu perfil público
            </Link>
          )}
        </div>
      )}

      {message && (
        <p
          className={`mb-6 rounded-xl px-4 py-3 text-sm ${
            message.kind === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-700"
          }`}
        >
          {message.text}
        </p>
      )}

      {review && (
        <form onSubmit={sendReview} className="card mb-6 p-6">
          <h2 className="font-bold">Avaliar {review.booking.professional_name}</h2>
          <p className="mt-1 text-sm text-ink-500">{review.booking.service_name}</p>

          <div className="mt-4 flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setReview({ ...review, rating: star })}
                aria-label={`${star} estrelas`}
              >
                <IconStar
                  className={`h-7 w-7 ${
                    star <= review.rating ? "text-amber-500" : "text-ink-200"
                  }`}
                />
              </button>
            ))}
          </div>

          <textarea
            className="input mt-4 min-h-24 resize-y"
            value={review.comment}
            onChange={(event) => setReview({ ...review, comment: event.target.value })}
            placeholder="Conte como correu o atendimento (opcional)"
          />

          <div className="mt-4 flex gap-2">
            <button type="submit" className="btn-primary">
              Enviar avaliação
            </button>
            <button type="button" onClick={() => setReview(null)} className="btn-ghost">
              Cancelar
            </button>
          </div>
        </form>
      )}

      <h2 className="mb-3 font-bold">As minhas marcações</h2>

      {loading ? (
        <div className="h-64 animate-pulse rounded-xl2 bg-ink-100" />
      ) : bookings.length === 0 ? (
        <div className="rounded-xl2 border border-dashed border-ink-200 bg-white px-6 py-16 text-center">
          <IconCalendar className="mx-auto h-8 w-8 text-ink-300" />
          <h2 className="mt-3 text-lg font-semibold">Você ainda não tem marcações</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-ink-500">
            Encontre um profissional na sua região e reserve o seu horário.
          </p>
          <Link href="/buscar" className="btn-primary mt-5">
            Procurar profissionais
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {upcoming.length > 0 && (
            <section>
              <h2 className="mb-3 font-bold">Próximos</h2>
              <ul className="space-y-3">{upcoming.map((booking) => card(booking))}</ul>
            </section>
          )}

          {past.length > 0 && (
            <section>
              <h2 className="mb-3 font-bold">Histórico</h2>
              <ul className="space-y-3">{past.map((booking) => card(booking, true))}</ul>
            </section>
          )}
        </div>
      )}
    </AccountShell>
  );
}
