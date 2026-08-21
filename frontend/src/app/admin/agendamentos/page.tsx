"use client";

import { useCallback, useEffect, useState } from "react";

import DashboardShell from "@/components/DashboardShell";
import { ADMIN_NAV } from "@/components/PanelNav";
import { api } from "@/lib/api";
import {
  BOOKING_STATUS_LABEL,
  BOOKING_STATUS_STYLE,
  formatDateTime,
  formatPrice, formatPhone } from "@/lib/format";
import type { Booking, Paged } from "@/lib/types";

const FILTERS = [
  { value: "", label: "Todos" },
  { value: "pending", label: "A aguardar" },
  { value: "confirmed", label: "Confirmados" },
  { value: "completed", label: "Concluídos" },
  { value: "cancelled", label: "Cancelados" },
  { value: "no_show", label: "Não compareceu" },
];

export default function AdminAgendamentosPage() {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paged<Booking> | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.get<Paged<Booking>>("/admin/bookings", {
        params: { status: status || undefined, page, per_page: 25 },
        auth: true,
      });
      setData(result);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [status, page]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <DashboardShell
      title="Marcações"
      subtitle="Todos os atendimentos registrados na plataforma."
      nav={ADMIN_NAV}
      allow={["admin"]}
    >
      <div className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <button
            key={item.value}
            onClick={() => {
              setStatus(item.value);
              setPage(1);
            }}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              status === item.value
                ? "bg-brand-600 text-white"
                : "bg-white text-ink-600 ring-1 ring-ink-200 hover:bg-ink-50"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="h-96 animate-pulse rounded-xl2 bg-ink-100" />
      ) : !data || data.items.length === 0 ? (
        <div className="rounded-xl2 border border-dashed border-ink-200 bg-white px-6 py-16 text-center">
          <p className="font-semibold">Nenhuma marcação encontrado</p>
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl2 border border-ink-100 bg-white shadow-card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-ink-100 bg-ink-50/60 text-left">
                  <tr>
                    <th className="px-5 py-3 font-semibold text-ink-600">Código</th>
                    <th className="px-5 py-3 font-semibold text-ink-600">Cliente</th>
                    <th className="px-5 py-3 font-semibold text-ink-600">Serviço</th>
                    <th className="px-5 py-3 font-semibold text-ink-600">Quando</th>
                    <th className="px-5 py-3 font-semibold text-ink-600">Valor</th>
                    <th className="px-5 py-3 font-semibold text-ink-600">Situação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {data.items.map((booking) => (
                    <tr key={booking.id} className="hover:bg-ink-50/40">
                      <td className="px-5 py-4 font-mono text-xs text-ink-500">{booking.code}</td>
                      <td className="px-5 py-4">
                        <p className="font-medium text-ink-900">{booking.client_name}</p>
                        <p className="text-xs text-ink-400">{formatPhone(booking.client_phone)}</p>
                      </td>
                      <td className="px-5 py-4 text-ink-600">
                        {booking.service_name}
                        {booking.at_home && (
                          <span className="ml-2 chip bg-brand-50 text-brand-700 ring-brand-200">
                            domicílio
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-ink-600">
                        {formatDateTime(booking.starts_at)}
                      </td>
                      <td className="px-5 py-4 font-medium text-ink-900">
                        {formatPrice(booking.price_cents)}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`chip ${BOOKING_STATUS_STYLE[booking.status]}`}>
                          {BOOKING_STATUS_LABEL[booking.status]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {data.pages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                disabled={page <= 1}
                className="btn-secondary btn-sm"
              >
                Anterior
              </button>
              <span className="text-sm text-ink-500">
                Página {data.page} de {data.pages} | {data.total} registros
              </span>
              <button
                onClick={() => setPage((value) => Math.min(data.pages, value + 1))}
                disabled={page >= data.pages}
                className="btn-secondary btn-sm"
              >
                Próxima
              </button>
            </div>
          )}
        </>
      )}
    </DashboardShell>
  );
}
