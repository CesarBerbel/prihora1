"use client";

import { useEffect, useState } from "react";

import { IconClose, IconWhatsapp } from "@/components/Icons";
import { ApiError, api } from "@/lib/api";
import { BOOKING_STATUS_LABEL } from "@/lib/format";
import type { Booking, BookingStatus, StatusChangePreview } from "@/lib/types";

interface Props {
  booking: Booking;
  novoEstado: BookingStatus;
  onConcluir: () => void;
  onCancelar: () => void;
}

/**
 * Pergunta antes de mudar o estado de uma marcação.
 *
 * Mostra o texto exato que o cliente vai receber, em vez de um sim/não às
 * cegas: assim dá para reparar num engano antes de a mensagem sair. O aviso vai
 * sempre só para o cliente — quem carregou no botão foi o profissional.
 */
export default function StatusChangeDialog({
  booking,
  novoEstado,
  onConcluir,
  onCancelar,
}: Props) {
  const [previsao, setPrevisao] = useState<StatusChangePreview | null>(null);
  const [avisar, setAvisar] = useState(true);
  const [motivo, setMotivo] = useState("");
  const [aAplicar, setAAplicar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const precisaMotivo = novoEstado === "cancelled";

  useEffect(() => {
    api
      .get<StatusChangePreview>(`/me/bookings/${booking.id}/preview/${novoEstado}`, {
        auth: true,
      })
      .then((p) => {
        setPrevisao(p);
        setAvisar(p.will_notify);
      })
      .catch(() => setPrevisao({ status: novoEstado, will_notify: false }));
  }, [booking.id, novoEstado]);

  async function aplicar() {
    setAAplicar(true);
    setErro(null);
    try {
      await api.patch(
        `/me/bookings/${booking.id}`,
        {
          status: novoEstado,
          cancel_reason: precisaMotivo ? motivo.trim() || null : null,
          notify: avisar,
        },
        { auth: true },
      );
      onConcluir();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível alterar.");
      setAAplicar(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-ink-950/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Confirmar a mudança de estado"
    >
      <div className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-xl2 bg-white shadow-lift">
        <div className="flex items-start justify-between gap-3 border-b border-ink-100 px-6 py-4">
          <div className="min-w-0">
            <h2 className="text-lg font-bold">
              Marcar como {BOOKING_STATUS_LABEL[novoEstado].toLowerCase()}
            </h2>
            <p className="truncate text-sm text-ink-500">
              {booking.client_name} · {booking.service_name}
            </p>
          </div>
          <button
            onClick={onCancelar}
            className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
            aria-label="Fechar"
          >
            <IconClose className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-6">
          {erro && (
            <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{erro}</p>
          )}

          {precisaMotivo && (
            <div>
              <label className="label" htmlFor="motivo-cancelamento">
                Motivo do cancelamento
              </label>
              <input
                id="motivo-cancelamento"
                className="input"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Opcional. Aparece na mensagem se usar a variável {motivo}."
              />
            </div>
          )}

          {!previsao ? (
            <div className="h-32 animate-pulse rounded-xl bg-ink-100" />
          ) : previsao.will_notify ? (
            <>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-ink-200 p-4 transition hover:bg-ink-50">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                  checked={avisar}
                  onChange={(e) => setAvisar(e.target.checked)}
                />
                <span className="min-w-0 text-sm">
                  <span className="block font-semibold text-ink-900">
                    Avisar {previsao.recipient_name ?? "o cliente"} por WhatsApp
                  </span>
                  <span className="mt-0.5 block text-ink-500">
                    A mensagem vai só para o cliente. Você não recebe cópia.
                  </span>
                </span>
              </label>

              {avisar && (
                <div className="rounded-xl bg-ink-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                    O que o cliente vai receber
                  </p>
                          <p className="mt-1 whitespace-pre-line text-sm text-ink-700">
                    {previsao.body}
                  </p>
                </div>
              )}
            </>
          ) : (
            <p className="flex items-start gap-2.5 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <IconWhatsapp className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {previsao.reason ?? "Nenhuma mensagem sai nesta mudança."} Pode alterar isto em{" "}
                <strong>Mensagens &rsaquo; Automáticas</strong>.
              </span>
            </p>
          )}
        </div>

        <div className="flex gap-2 border-t border-ink-100 px-6 py-4">
          <button onClick={aplicar} disabled={aAplicar} className="btn-primary flex-1">
            {aAplicar
              ? "A aplicar..."
              : previsao?.will_notify && avisar
                ? "Alterar e avisar"
                : "Alterar sem avisar"}
          </button>
          <button onClick={onCancelar} disabled={aAplicar} className="btn-ghost">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
