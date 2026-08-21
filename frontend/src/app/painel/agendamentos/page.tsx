"use client";

import { useCallback, useEffect, useState } from "react";

import DashboardShell from "@/components/DashboardShell";
import InternalBookingForm from "@/components/InternalBookingForm";
import StatusChangeDialog from "@/components/StatusChangeDialog";
import { IconWhatsapp } from "@/components/Icons";
import { PANEL_NAV } from "@/components/PanelNav";
import { ApiError, api } from "@/lib/api";
import {
  BOOKING_STATUS_LABEL,
  BOOKING_STATUS_STYLE,
  formatDateTime,
  formatPrice,
  formatTime,
  whatsappLink, formatPhone } from "@/lib/format";
import type { Booking, BookingStatus } from "@/lib/types";

const FILTERS: { value: string; label: string }[] = [
  { value: "upcoming", label: "Próximos" },
  { value: "pending", label: "A aguardar" },
  { value: "confirmed", label: "Confirmados" },
  { value: "completed", label: "Concluídos" },
  { value: "cancelled", label: "Cancelados" },
  { value: "all", label: "Todos" },
];

/** Ações disponíveis a partir de cada situação. */
const TRANSITIONS: Record<string, { status: BookingStatus; label: string; style: string }[]> = {
  pending: [
    { status: "confirmed", label: "Confirmar", style: "btn-primary" },
    { status: "cancelled", label: "Recusar", style: "btn-ghost text-rose-600 hover:bg-rose-50" },
  ],
  confirmed: [
    { status: "completed", label: "Marcar como concluído", style: "btn-primary" },
    { status: "no_show", label: "Não compareceu", style: "btn-secondary" },
    { status: "cancelled", label: "Cancelar", style: "btn-ghost text-rose-600 hover:bg-rose-50" },
  ],
  completed: [],
  cancelled: [],
  no_show: [],
};

export default function AgendamentosPage() {
  const [filter, setFilter] = useState("upcoming");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [creating, setCreating] = useState(false);
  // Mudança de estado à espera de confirmação, com a pergunta do aviso.
  const [aMudar, setAMudar] = useState<{ booking: Booking; estado: BookingStatus } | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, unknown> = { limit: 200 };
      if (filter === "upcoming") params.upcoming = true;
      else if (filter !== "all") params.status = filter;

      const data = await api.get<Booking[]>("/me/bookings", { params, auth: true });
      // "Próximos" fica em ordem cronologica; o resto, do mais recente para tras.
      setBookings(
        filter === "upcoming"
          ? [...data].sort(
              (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
            )
          : data,
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível carregar.");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <DashboardShell
      title="Marcações"
      subtitle="Confirme, conclua ou cancele os atendimentos."
      nav={PANEL_NAV}
      allow={["professional"]}
      actions={
        !creating && (
          <button onClick={() => setCreating(true)} className="btn-primary btn-sm">
            Nova marcação
          </button>
        )
      }
    >
      {aMudar && (
        <StatusChangeDialog
          booking={aMudar.booking}
          novoEstado={aMudar.estado}
          onConcluir={() => {
            setAMudar(null);
            void load();
          }}
          onCancelar={() => setAMudar(null)}
        />
      )}

      {creating && (
        <InternalBookingForm
          onCreated={() => {
            setCreating(false);
            void load();
          }}
          onCancel={() => setCreating(false)}
        />
      )}

      {/* `-mx-1 px-1 py-1`: o contorno dos chips é desenhado fora da caixa,
          e uma faixa que rola corta os dois eixos — sem esta folga por dentro,
          o topo do contorno desaparecia. As margens negativas devolvem o
          alinhamento que a folga tirava. */}
      <div className="scroll-soft -mx-1 mb-6 flex gap-2 overflow-x-auto px-1 py-1">
        {FILTERS.map((item) => (
          <button
            key={item.value}
            onClick={() => setFilter(item.value)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${
              filter === item.value
                ? "bg-brand-600 text-white"
                : "bg-white text-ink-600 ring-1 ring-ink-200 hover:bg-ink-50"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="mb-6 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
      )}

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((index) => (
            <div key={index} className="h-28 animate-pulse rounded-xl2 bg-ink-100" />
          ))}
        </div>
      ) : bookings.length === 0 ? (
        <div className="rounded-xl2 border border-dashed border-ink-200 bg-white px-6 py-16 text-center">
          <h2 className="text-lg font-semibold">Nada por aqui</h2>
          <p className="mt-2 text-sm text-ink-500">
            Nenhuma marcação nesta situação no momento.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {bookings.map((booking) => {
            const actions = TRANSITIONS[booking.status] ?? [];
            const whatsapp = whatsappLink(booking.client_phone);
            return (
              <li key={booking.id} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-ink-900">{booking.client_name}</h3>
                      <span className={`chip ${BOOKING_STATUS_STYLE[booking.status]}`}>
                        {BOOKING_STATUS_LABEL[booking.status]}
                      </span>
                      {booking.at_home && (
                        <span className="chip bg-brand-50 text-brand-700 ring-brand-200">
                          Ao domicílio
                        </span>
                      )}
                      {booking.created_by_professional && (
                        <span className="chip bg-ink-100 text-ink-600 ring-ink-200">
                          lancado por você
                        </span>
                      )}
                    </div>

                    <p className="mt-1.5 text-sm text-ink-600">
                      {booking.service_name} | {formatPrice(booking.price_cents)}
                    </p>
                    <p className="mt-0.5 text-sm font-medium text-ink-800">
                      {formatDateTime(booking.starts_at)} as {formatTime(booking.ends_at)}
                    </p>

                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-500">
                      <span>Código: <span className="font-mono">{booking.code}</span></span>
                      <span>{formatPhone(booking.client_phone)}</span>
                      {booking.client_email && <span>{booking.client_email}</span>}
                    </div>

                    {booking.address_line && (
                      <p className="mt-2 rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-600">
                        Morada: {booking.address_line}
                      </p>
                    )}
                    {booking.notes && (
                      <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        Observação: {booking.notes}
                      </p>
                    )}
                    {booking.cancel_reason && (
                      <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
                        Motivo do cancelamento: {booking.cancel_reason}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-col gap-2">
                    {whatsapp && (
                      <a
                        href={whatsapp}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-secondary btn-sm"
                      >
                        <IconWhatsapp className="h-4 w-4 text-emerald-600" />
                        WhatsApp
                      </a>
                    )}
                    {actions.map((action) => (
                      <button
                        key={action.status}
                        onClick={() => setAMudar({ booking, estado: action.status })}
                        className={`${action.style} btn-sm`}
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </DashboardShell>
  );
}
