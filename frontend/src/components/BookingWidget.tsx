"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { IconCalendar, IconCheck, IconClock } from "@/components/Icons";
import { ApiError, api } from "@/lib/api";
import { useSession } from "@/lib/auth";
import {
  WEEKDAYS_SHORT,
  formatDayLabel,
  formatDuration,
  formatPrice,
  relativeDay,
} from "@/lib/format";
import type { Agenda, Booking, DayAgenda, ProfessionalPublic, Service } from "@/lib/types";

type Step = "serviço" | "horário" | "dados" | "pronto";

export default function BookingWidget({ professional }: { professional: ProfessionalPublic }) {
  const { user } = useSession();
  const services = useMemo(
    () => professional.services.filter((item) => item.is_active),
    [professional.services],
  );

  const [step, setStep] = useState<Step>("serviço");
  const [service, setService] = useState<Service | null>(services[0] ?? null);
  const [agenda, setAgenda] = useState<Agenda | null>(null);
  const [loadingAgenda, setLoadingAgenda] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);

  const [form, setForm] = useState({
    client_name: "",
    client_phone: "",
    client_email: "",
    at_home: false,
    address_line: "",
    notes: "",
  });

  // Preenche os dados de contato de quem já esta logado.
  useEffect(() => {
    if (!user) return;
    setForm((current) => ({
      ...current,
      client_name: current.client_name || user.name,
      client_email: current.client_email || user.email,
      client_phone: current.client_phone || (user.phone ?? ""),
    }));
  }, [user]);

  const loadAgenda = useCallback(async () => {
    if (!service) return;
    setLoadingAgenda(true);
    setError(null);
    try {
      const data = await api.get<Agenda>(`/professionals/${professional.slug}/agenda`, {
        params: { service_id: service.id, days: 21 },
      });
      setAgenda(data);
      const firstOpen = data.days.find((day) => day.slots.length > 0);
      setSelectedDay(firstOpen?.date ?? null);
      setSelectedSlot(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível carregar a agenda.");
    } finally {
      setLoadingAgenda(false);
    }
  }, [professional.slug, service]);

  useEffect(() => {
    if (step === "horário") void loadAgenda();
  }, [step, loadAgenda]);

  const daysWithSlots = useMemo(
    () => (agenda?.days ?? []).filter((day) => day.slots.length > 0),
    [agenda],
  );
  const currentDay: DayAgenda | undefined = useMemo(
    () => daysWithSlots.find((day) => day.date === selectedDay),
    [daysWithSlots, selectedDay],
  );

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!service || !selectedSlot) return;

    setSubmitting(true);
    setError(null);
    try {
      const created = await api.post<Booking>(
        `/professionals/${professional.slug}/bookings`,
        {
          service_id: service.id,
          starts_at: selectedSlot,
          client_name: form.client_name.trim(),
          client_phone: form.client_phone.trim(),
          client_email: form.client_email.trim() || null,
          at_home: form.at_home,
          address_line: form.at_home ? form.address_line.trim() : null,
          notes: form.notes.trim() || null,
        },
        { auth: Boolean(user) },
      );
      setBooking(created);
      setStep("pronto");
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Não foi possível concluir a marcação.";
      setError(message);
      // Horário tomado por outra pessoa: volta para a agenda já atualizada.
      if (err instanceof ApiError && err.status === 409) {
        setStep("horário");
        setSelectedSlot(null);
        void loadAgenda();
      }
    } finally {
      setSubmitting(false);
    }
  }

  function restart() {
    setBooking(null);
    setSelectedSlot(null);
    setStep("serviço");
  }

  if (services.length === 0) {
    return (
      <div className="card p-6 text-center">
        <IconCalendar className="mx-auto h-8 w-8 text-ink-300" />
        <h2 className="mt-3 font-bold">Agenda indisponível</h2>
        <p className="mt-1.5 text-sm text-ink-500">
          Este profissional ainda não publicou serviços para marcação online.
        </p>
      </div>
    );
  }

  // ------------------------------------------------------------ confirmado ---
  if (step === "pronto" && booking) {
    return (
      <div className="card overflow-hidden">
        <div className="bg-emerald-50 px-6 py-8 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-600 text-white">
            <IconCheck className="h-6 w-6" />
          </span>
          <h2 className="mt-4 text-lg font-bold text-emerald-900">
            {booking.status === "confirmed"
              ? "Marcação confirmado!"
              : "Solicitação enviada!"}
          </h2>
          <p className="mx-auto mt-1.5 max-w-xs text-sm text-emerald-800">
            {booking.status === "confirmed"
              ? "Seu horário esta reservado. Até breve!"
              : `${professional.display_name} vai confirmar em instantes.`}
          </p>
        </div>

        <dl className="divide-y divide-ink-100 px-6 py-2 text-sm">
          <div className="flex justify-between gap-4 py-3">
            <dt className="text-ink-500">Código</dt>
            <dd className="font-mono font-bold tracking-wide">{booking.code}</dd>
          </div>
          <div className="flex justify-between gap-4 py-3">
            <dt className="text-ink-500">Serviço</dt>
            <dd className="text-right font-medium">{booking.service_name}</dd>
          </div>
          <div className="flex justify-between gap-4 py-3">
            <dt className="text-ink-500">Quando</dt>
            <dd className="text-right font-medium">
              {new Date(booking.starts_at).toLocaleString("pt-BR", {
                weekday: "short",
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </dd>
          </div>
          <div className="flex justify-between gap-4 py-3">
            <dt className="text-ink-500">Valor</dt>
            <dd className="font-semibold">{formatPrice(booking.price_cents)}</dd>
          </div>
        </dl>

        <div className="space-y-2 border-t border-ink-100 p-6">
          <p className="text-xs leading-relaxed text-ink-500">
            Guarde o código <strong className="font-mono">{booking.code}</strong>: com ele você
            acompanha ou avalia o atendimento sem precisar de conta.
          </p>
          <Link href={`/agendamento?code=${booking.code}`} className="btn-secondary w-full">
            Acompanhar marcação
          </Link>
          <button onClick={restart} className="btn-ghost btn-sm w-full">
            Marcar outro horário
          </button>
        </div>
      </div>
    );
  }

  const steps: { key: Step; label: string }[] = [
    { key: "serviço", label: "Serviço" },
    { key: "horário", label: "Horário" },
    { key: "dados", label: "Dados" },
  ];
  const currentIndex = steps.findIndex((item) => item.key === step);

  return (
    <div className="card overflow-hidden">
      <div className="border-b border-ink-100 bg-ink-50/60 px-6 py-4">
        <h2 className="flex items-center gap-2 font-bold">
          <IconCalendar className="h-5 w-5 text-brand-600" />
          Marcar online
        </h2>
        <ol className="mt-3 flex items-center gap-1.5 text-xs">
          {steps.map((item, index) => (
            <li key={item.key} className="flex items-center gap-1.5">
              <span
                className={`grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold ${
                  index <= currentIndex ? "bg-brand-600 text-white" : "bg-ink-200 text-ink-500"
                }`}
              >
                {index + 1}
              </span>
              <span className={index <= currentIndex ? "font-semibold text-ink-800" : "text-ink-400"}>
                {item.label}
              </span>
              {index < steps.length - 1 && <span className="mx-1 text-ink-300">/</span>}
            </li>
          ))}
        </ol>
      </div>

      {error && (
        <p className="border-b border-rose-100 bg-rose-50 px-6 py-3 text-sm text-rose-700">
          {error}
        </p>
      )}

      {/* ---------------------------------------------------- passo serviço --- */}
      {step === "serviço" && (
        <div className="p-6">
          <p className="label">Escolha o serviço</p>
          <ul className="space-y-2">
            {services.map((item) => (
              <li key={item.id}>
                <button
                  onClick={() => setService(item)}
                  className={`flex w-full items-start justify-between gap-3 rounded-xl border px-4 py-3 text-left transition ${
                    service?.id === item.id
                      ? "border-brand-400 bg-brand-50 ring-1 ring-brand-200"
                      : "border-ink-200 hover:bg-ink-50"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-ink-900">{item.name}</span>
                    <span className="mt-0.5 inline-flex items-center gap-1 text-xs text-ink-500">
                      <IconClock className="h-3 w-3" />
                      {formatDuration(item.duration_min)}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold text-ink-900">
                    {formatPrice(item.price_cents)}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <button
            onClick={() => setStep("horário")}
            disabled={!service}
            className="btn-primary mt-5 w-full"
          >
            Ver horários livres
          </button>
        </div>
      )}

      {/* ---------------------------------------------------- passo horário --- */}
      {step === "horário" && (
        <div className="p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-ink-700">{service?.name}</p>
            <button onClick={() => setStep("serviço")} className="text-xs font-semibold text-brand-600">
              Trocar
            </button>
          </div>

          {loadingAgenda ? (
            <div className="space-y-2">
              {[0, 1, 2].map((index) => (
                <div key={index} className="h-10 animate-pulse rounded-xl bg-ink-100" />
              ))}
            </div>
          ) : daysWithSlots.length === 0 ? (
            <div className="rounded-xl border border-dashed border-ink-200 px-4 py-10 text-center">
              <p className="text-sm font-medium text-ink-700">Sem horários livres por aqui</p>
              <p className="mt-1 text-xs text-ink-500">
                Não há vagas nos próximos dias para este serviço. Tente falar direto pelo WhatsApp.
              </p>
            </div>
          ) : (
            <>
              <div className="scroll-soft -mx-1 flex gap-2 overflow-x-auto px-1 pb-2 pt-1">
                {daysWithSlots.map((day) => {
                  const active = day.date === selectedDay;
                  const relative = relativeDay(day.date);
                  return (
                    <button
                      key={day.date}
                      onClick={() => {
                        setSelectedDay(day.date);
                        setSelectedSlot(null);
                      }}
                      className={`shrink-0 rounded-xl border px-3 py-2 text-center transition ${
                        active
                          ? "border-brand-500 bg-brand-600 text-white"
                          : "border-ink-200 bg-white text-ink-700 hover:bg-ink-50"
                      }`}
                    >
                      <span className="block text-[10px] font-semibold uppercase tracking-wide opacity-80">
                        {relative ?? WEEKDAYS_SHORT[day.weekday]}
                      </span>
                      <span className="mt-0.5 block text-sm font-bold">
                        {formatDayLabel(day.date)}
                      </span>
                      <span className="mt-0.5 block text-[10px] opacity-70">
                        {day.slots.length} vagas
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {currentDay?.slots.map((slot) => (
                  <button
                    key={slot.start}
                    onClick={() => setSelectedSlot(slot.start)}
                    className={`rounded-xl border py-2.5 text-sm font-semibold transition ${
                      selectedSlot === slot.start
                        ? "border-brand-500 bg-brand-600 text-white"
                        : "border-ink-200 bg-white text-ink-700 hover:border-brand-300 hover:bg-brand-50"
                    }`}
                  >
                    {slot.label}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setStep("dados")}
                disabled={!selectedSlot}
                className="btn-primary mt-5 w-full"
              >
                Continuar
              </button>
            </>
          )}
        </div>
      )}

      {/* ------------------------------------------------------ passo dados --- */}
      {step === "dados" && (
        <form onSubmit={submit} className="space-y-4 p-6">
          <div className="rounded-xl bg-brand-50 p-4 text-sm">
            <p className="font-semibold text-brand-900">{service?.name}</p>
            <p className="mt-0.5 text-brand-800">
              {selectedSlot &&
                new Date(selectedSlot).toLocaleString("pt-BR", {
                  weekday: "long",
                  day: "2-digit",
                  month: "long",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
            </p>
            <p className="mt-1 font-semibold text-brand-900">
              {formatPrice(service?.price_cents)}
            </p>
            <button
              type="button"
              onClick={() => setStep("horário")}
              className="mt-2 text-xs font-semibold text-brand-700 underline"
            >
              Trocar horário
            </button>
          </div>

          <div>
            <label className="label" htmlFor="booking-name">
              Seu nome *
            </label>
            <input
              id="booking-name"
              className="input"
              required
              minLength={2}
              value={form.client_name}
              onChange={(event) => setForm({ ...form, client_name: event.target.value })}
              placeholder="O seu nome"
            />
          </div>

          <div>
            <label className="label" htmlFor="booking-phone">
              WhatsApp / telefone *
            </label>
            <input
              id="booking-phone"
              className="input"
              required
              minLength={8}
              value={form.client_phone}
              onChange={(event) => setForm({ ...form, client_phone: event.target.value })}
              placeholder="912 345 678"
            />
          </div>

          <div>
            <label className="label" htmlFor="booking-email">
              E-mail
            </label>
            <input
              id="booking-email"
              type="email"
              className="input"
              value={form.client_email}
              onChange={(event) => setForm({ ...form, client_email: event.target.value })}
              placeholder="opcional, para receber a confirmação"
            />
          </div>

          {professional.serves_at_home && (
            <div className="space-y-3 rounded-xl border border-ink-200 p-4">
              <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium text-ink-700">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                  checked={form.at_home}
                  onChange={(event) => setForm({ ...form, at_home: event.target.checked })}
                />
                Quero atendimento ao domicílio
              </label>

              {form.at_home && (
                <div>
                  <label className="label" htmlFor="booking-address">
                    Morada do atendimento *
                  </label>
                  <input
                    id="booking-address"
                    className="input"
                    required
                    value={form.address_line}
                    onChange={(event) => setForm({ ...form, address_line: event.target.value })}
                    placeholder="Rua, número, andar e freguesia"
                  />
                  <p className="field-hint">
                    Atende até {professional.home_service_radius_km} km da região dele.
                  </p>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="label" htmlFor="booking-notes">
              Observações
            </label>
            <textarea
              id="booking-notes"
              className="input min-h-20 resize-y"
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
              placeholder="Alguma alergia, preferência ou pormenor importante?"
            />
          </div>

          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? "A enviar..." : "Confirmar marcação"}
          </button>

          {!user && (
            <p className="text-center text-xs text-ink-400">
              Não precisa de conta.{" "}
              <Link href="/entrar" className="font-semibold text-brand-600 underline">
                Entrar
              </Link>{" "}
              deixa tudo salvo no seu histórico.
            </p>
          )}
        </form>
      )}
    </div>
  );
}
