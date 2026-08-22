"use client";

/**
 * O que o cliente ainda pode fazer com a marcação dele, sem ter conta.
 *
 * Dentro do prazo, remarca ou cancela sozinho. Fora dele, os botões ficam
 * desligados — mas visíveis, e com o motivo escrito: um botão que desaparece
 * deixa a pessoa a pensar que o site está partido, e um que não diz porquê
 * deixa-a a carregar nele. Ao lado fica o WhatsApp do profissional, que é o
 * caminho que sobra.
 *
 * Quem decide é o servidor: esta página só mostra o que ele respondeu.
 */

import { useCallback, useEffect, useState } from "react";

import Modal from "@/components/Modal";
import { IconCalendar, IconClock, IconStar, IconWhatsapp } from "@/components/Icons";
import ReviewDialog from "@/components/ReviewDialog";
import { ApiError, api } from "@/lib/api";
import { formatDateTime, formatDayLabel, whatsappLink } from "@/lib/format";
import type { Agenda, BookingLookup } from "@/lib/types";

interface Props {
  booking: BookingLookup;
  onChanged: (booking: BookingLookup) => void;
}

export default function BookingActions({ booking, onChanged }: Props) {
  const [aCancelar, setACancelar] = useState(false);
  const [aRemarcar, setARemarcar] = useState(false);
  const [aAvaliar, setAAvaliar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const whatsapp = whatsappLink(booking.professional_whatsapp);
  const podeMudar = booking.can_change;

  // O que já terminou não se remarca — mas um atendimento concluído ainda
  // pode ser avaliado, e é para aqui que a mensagem de conclusão aponta.
  const terminada = ["cancelled", "completed", "no_show"].includes(booking.status);
  if (terminada) {
    return (
      <div className="space-y-3 border-t border-ink-100 px-6 py-5">
        {booking.can_review && booking.professional_slug && (
          <>
            <button onClick={() => setAAvaliar(true)} className="btn-primary w-full">
              <IconStar className="h-4 w-4" />
              Avaliar o atendimento
            </button>
            {aAvaliar && (
              <ReviewDialog
                professionalName={booking.professional_name ?? "o profissional"}
                professionalSlug={booking.professional_slug}
                bookingCode={booking.code}
                serviceName={booking.service_name}
                onDone={() => {
                  setAAvaliar(false);
                  onChanged({ ...booking, can_review: false, already_reviewed: true });
                }}
                onClose={() => setAAvaliar(false)}
              />
            )}
          </>
        )}

        {booking.already_reviewed && (
          <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Obrigado — já deixou a sua avaliação deste atendimento.
          </p>
        )}

        {whatsapp && (
          <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="btn-secondary w-full">
            <IconWhatsapp className="h-4 w-4 text-emerald-600" />
            Falar com {booking.professional_name ?? "o profissional"}
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3 border-t border-ink-100 px-6 py-5">
      {erro && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{erro}</p>}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setARemarcar(true)}
          disabled={!podeMudar}
          className="btn-secondary flex-1 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <IconCalendar className="h-4 w-4" />
          Remarcar
        </button>
        <button
          onClick={() => setACancelar(true)}
          disabled={!podeMudar}
          className="btn-ghost flex-1 text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Cancelar marcação
        </button>
      </div>

      {podeMudar ? (
        booking.change_deadline && (
          <p className="flex items-start gap-1.5 text-xs text-ink-400">
            <IconClock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Pode remarcar ou cancelar até {formatDateTime(booking.change_deadline)}.
          </p>
        )
      ) : (
        <div className="rounded-xl bg-amber-50 px-4 py-3">
          <p className="text-sm text-amber-900">{booking.change_blocked_reason}</p>
          {whatsapp && (
            <a
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary btn-sm mt-3 w-full"
            >
              <IconWhatsapp className="h-4 w-4 text-emerald-600" />
              Falar com {booking.professional_name ?? "o profissional"}
            </a>
          )}
        </div>
      )}

      {aCancelar && (
        <ConfirmarCancelamento
          booking={booking}
          onFechar={() => setACancelar(false)}
          onFeito={(actualizada) => {
            setACancelar(false);
            onChanged(actualizada);
          }}
          onErro={setErro}
        />
      )}

      {aRemarcar && (
        <EscolherNovoHorario
          booking={booking}
          onFechar={() => setARemarcar(false)}
          onFeito={(actualizada) => {
            setARemarcar(false);
            onChanged(actualizada);
          }}
          onErro={setErro}
        />
      )}
    </div>
  );
}

function ConfirmarCancelamento({
  booking,
  onFechar,
  onFeito,
  onErro,
}: {
  booking: BookingLookup;
  onFechar: () => void;
  onFeito: (b: BookingLookup) => void;
  onErro: (mensagem: string) => void;
}) {
  const [aEnviar, setAEnviar] = useState(false);

  async function cancelar() {
    setAEnviar(true);
    try {
      onFeito(
        await api.post<BookingLookup>(`/bookings/${booking.code}/cancel`, undefined),
      );
    } catch (err) {
      onErro(err instanceof ApiError ? err.message : "Não foi possível cancelar agora.");
      onFechar();
    } finally {
      setAEnviar(false);
    }
  }

  return (
    <Modal title="Cancelar a marcação?" size="sm" onClose={onFechar}>
      <p className="text-sm leading-relaxed text-ink-600">
        {booking.service_name}, {formatDateTime(booking.starts_at)}.
      </p>
      <p className="mt-2 text-xs text-ink-400">
        O profissional é avisado. Se mudar de ideias, terá de marcar de novo — o horário
        volta a ficar livre para outra pessoa.
      </p>

      <div className="mt-6 flex gap-2">
        <button
          onClick={() => void cancelar()}
          disabled={aEnviar}
          className="btn-primary flex-1 bg-rose-600 hover:bg-rose-700"
        >
          {aEnviar ? "A cancelar..." : "Sim, cancelar"}
        </button>
        <button onClick={onFechar} disabled={aEnviar} className="btn-ghost">
          Manter
        </button>
      </div>
    </Modal>
  );
}

function EscolherNovoHorario({
  booking,
  onFechar,
  onFeito,
  onErro,
}: {
  booking: BookingLookup;
  onFechar: () => void;
  onFeito: (b: BookingLookup) => void;
  onErro: (mensagem: string) => void;
}) {
  const [agenda, setAgenda] = useState<Agenda | null>(null);
  const [dia, setDia] = useState<string | null>(null);
  const [aEnviar, setAEnviar] = useState<string | null>(null);
  const [falhou, setFalhou] = useState(false);

  const carregar = useCallback(async () => {
    if (!booking.professional_slug) return;
    try {
      const dados = await api.get<Agenda>(
        `/professionals/${booking.professional_slug}/agenda`,
        { params: { days: 30, service_id: booking.service_id ?? undefined } },
      );
      setAgenda(dados);
      setDia(dados.days.find((d) => d.slots.length > 0)?.date ?? null);
    } catch {
      setFalhou(true);
    }
  }, [booking.professional_slug, booking.service_id]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function remarcar(inicio: string) {
    setAEnviar(inicio);
    try {
      onFeito(
        await api.patch<BookingLookup>(`/bookings/${booking.code}`, { starts_at: inicio }),
      );
    } catch (err) {
      onErro(err instanceof ApiError ? err.message : "Não foi possível remarcar agora.");
      onFechar();
    } finally {
      setAEnviar(null);
    }
  }

  const comVagas = agenda?.days.filter((d) => d.slots.length > 0) ?? [];
  const escolhido = comVagas.find((d) => d.date === dia);

  return (
    <Modal
      title="Escolher outro horário"
      subtitle={`${booking.service_name} — atualmente ${formatDateTime(booking.starts_at)}`}
      onClose={onFechar}
    >
      {falhou ? (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
          Não foi possível carregar os horários. Tente daqui a pouco.
        </p>
      ) : !agenda ? (
        <div className="h-40 animate-pulse rounded-xl bg-ink-100" />
      ) : comVagas.length === 0 ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Não há horários livres nos próximos 30 dias. Fale com o profissional para
          combinarem outra data.
        </p>
      ) : (
        <>
          {/* `-mx-1 px-1 py-1`: o contorno dos botões é desenhado fora da caixa
              e uma faixa que rola corta os dois eixos. */}
          <div className="scroll-soft -mx-1 flex gap-2 overflow-x-auto px-1 py-1">
            {comVagas.map((d) => (
              <button
                key={d.date}
                onClick={() => setDia(d.date)}
                className={`shrink-0 rounded-xl border px-3 py-2 text-center text-sm transition ${
                  d.date === dia
                    ? "border-brand-500 bg-brand-600 text-white"
                    : "border-ink-200 bg-white text-ink-700 hover:bg-ink-50"
                }`}
              >
                <span className="block font-semibold">{formatDayLabel(d.date)}</span>
                <span className="block text-[10px] opacity-75">{d.slots.length} vagas</span>
              </button>
            ))}
          </div>

          {escolhido && (
            <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {escolhido.slots.map((slot) => (
                <button
                  key={slot.start}
                  onClick={() => void remarcar(slot.start)}
                  disabled={aEnviar !== null}
                  className="rounded-lg border border-ink-200 py-2 text-sm font-medium text-ink-700 transition hover:border-brand-400 hover:bg-brand-50 disabled:opacity-50"
                >
                  {aEnviar === slot.start ? "..." : slot.label}
                </button>
              ))}
            </div>
          )}

          <p className="mt-4 text-xs text-ink-400">
            Ao remarcar, o profissional volta a receber o pedido para confirmar.
          </p>
        </>
      )}
    </Modal>
  );
}
