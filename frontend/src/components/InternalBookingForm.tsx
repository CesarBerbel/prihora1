"use client";

import { useEffect, useMemo, useState } from "react";

import { ApiError, api } from "@/lib/api";
import { formatDuration, formatPrice, formatPhone } from "@/lib/format";
import type { Booking, Client, Paged, Service } from "@/lib/types";

interface Props {
  onCreated: () => void;
  onCancel: () => void;
  /** Instante já escolhido — o calendário passa a hora onde se carregou. */
  inicio?: Date | null;
}

/** Data e hora locais no formato que o input datetime-local espera. */
/** Nome de partida para um atendimento que não está no catálogo. */
const AVULSO = "Serviço avulso";

function agoraLocal(offsetHoras = 1): string {
  const d = new Date();
  d.setHours(d.getHours() + offsetHoras, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** O mesmo formato, a partir de um instante escolhido noutro sitio. */
function paraLocal(data: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${data.getFullYear()}-${pad(data.getMonth() + 1)}-${pad(data.getDate())}T${pad(data.getHours())}:${pad(data.getMinutes())}`;
}

export default function InternalBookingForm({ onCreated, onCancel, inicio }: Props) {
  const [services, setServices] = useState<Service[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    starts_at: inicio ? paraLocal(inicio) : agoraLocal(),
    service_id: "" as string,
    service_name: AVULSO,
    duration_min: 60,
    price_cents: "",
    client_id: "" as string,
    client_name: "",
    client_phone: "",
    client_email: "",
    save_client: true,
    status: "confirmed",
    at_home: false,
    address_line: "",
    notes: "",
  });

  useEffect(() => {
    Promise.all([
      api.get<Service[]>("/me/services", { auth: true }),
      api.get<Paged<Client>>("/me/clients", { params: { per_page: 100 }, auth: true }),
    ])
      .then(([servicesData, clientsData]) => {
        setServices(servicesData.filter((s) => s.is_active));
        setClients(clientsData.items);
      })
      .catch(() => undefined);
  }, []);

  const selectedService = useMemo(
    () => services.find((s) => String(s.id) === form.service_id),
    [services, form.service_id],
  );

  // Escolher um serviço do catalogo traz duração e preço junto.
  function pickService(value: string) {
    const service = services.find((s) => String(s.id) === value);
    setForm((current) => ({
      ...current,
      service_id: value,
      // Voltar ao encaixe repõe o nome de partida, mas nunca por cima de um
      // nome escrito à mão: quem já tinha "Retoque rápido" não o perde.
      service_name: service ? current.service_name : current.service_name.trim() || AVULSO,
      duration_min: service ? service.duration_min : current.duration_min,
      price_cents: service ? String((service.price_cents / 100).toFixed(2)) : current.price_cents,
    }));
  }

  function pickClient(value: string) {
    const client = clients.find((c) => String(c.id) === value);
    setForm((current) => ({
      ...current,
      client_id: value,
      client_name: client ? client.name : "",
      client_phone: client ? (client.phone ?? "") : "",
      client_email: client ? (client.email ?? "") : "",
      address_line: client?.address_line ?? current.address_line,
    }));
  }

  function parsePrice(text: string): number | null {
    if (!text.trim()) return null;
    const parsed = Number.parseFloat(text.replace(/[^\d,.-]/g, "").replace(",", "."));
    return Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        // O input entrega hora local; o backend trabalha em UTC.
        starts_at: new Date(form.starts_at).toISOString(),
        status: form.status,
        at_home: form.at_home,
        address_line: form.at_home ? form.address_line.trim() || null : null,
        notes: form.notes.trim() || null,
        duration_min: Number(form.duration_min),
        price_cents: parsePrice(form.price_cents),
      };

      if (form.service_id) payload.service_id = Number(form.service_id);
      else payload.service_name = form.service_name.trim() || AVULSO;

      if (form.client_id) {
        payload.client_id = Number(form.client_id);
      } else {
        payload.client_name = form.client_name.trim();
        payload.client_phone = form.client_phone.trim() || null;
        payload.client_email = form.client_email.trim() || null;
        payload.save_client = form.save_client;
      }

      await api.post<Booking>("/me/bookings", payload, { auth: true });
      onCreated();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Não foi possível criar a marcação.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="card mb-6 p-6">
      <h2 className="font-bold">Nova marcação</h2>
      <p className="mt-1 text-sm text-ink-500">
        Lancamento seu: vale fora do horário de atendimento e por cima de bloqueios. A única
        trava e não ter outro atendimento no mesmo horário.
      </p>

      {error && (
        <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
      )}

      {/* -------------------------------------------------------- cliente --- */}
      <fieldset className="mt-5">
        <legend className="label">Cliente</legend>
        <select
          className="input"
          value={form.client_id}
          onChange={(event) => pickClient(event.target.value)}
          aria-label="Cliente registado"
        >
          <option value="">Novo cliente / avulso</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
              {client.phone ? ` — ${formatPhone(client.phone)}` : ""}
            </option>
          ))}
        </select>

        {!form.client_id && (
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="ag-nome">
                Nome *
              </label>
              <input
                id="ag-nome"
                required
                className="input"
                value={form.client_name}
                onChange={(event) => setForm({ ...form, client_name: event.target.value })}
              />
            </div>
            <div>
              <label className="label" htmlFor="ag-tel">
                Telefone
              </label>
              <input
                id="ag-tel"
                className="input"
                value={form.client_phone}
                onChange={(event) => setForm({ ...form, client_phone: event.target.value })}
                placeholder="912 345 678"
              />
            </div>
            <div>
              <label className="label" htmlFor="ag-email">
                E-mail
              </label>
              <input
                id="ag-email"
                type="email"
                className="input"
                value={form.client_email}
                onChange={(event) => setForm({ ...form, client_email: event.target.value })}
              />
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-600 sm:col-span-3">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                checked={form.save_client}
                onChange={(event) => setForm({ ...form, save_client: event.target.checked })}
              />
              Guardar na minha lista de clientes
            </label>
          </div>
        )}
      </fieldset>

      {/* -------------------------------------------------------- serviço --- */}
      <fieldset className="mt-6">
        <legend className="label">Serviço</legend>
        <select
          className="input"
          value={form.service_id}
          onChange={(event) => pickService(event.target.value)}
          aria-label="Serviço do catálogo"
        >
          <option value="">Encaixe / serviço avulso</option>
          {services.map((service) => (
            <option key={service.id} value={service.id}>
              {service.name} - {formatDuration(service.duration_min)} -{" "}
              {formatPrice(service.price_cents)}
            </option>
          ))}
        </select>

        {!form.service_id && (
          <div className="mt-3">
            <label className="label" htmlFor="ag-servico">
              Nome do atendimento *
            </label>
            <input
              id="ag-servico"
              required
              className="input"
              value={form.service_name}
              onChange={(event) => setForm({ ...form, service_name: event.target.value })}
              // Deixar o campo vazio bloqueava o formulário sem dizer porquê.
              // Sair dele em branco repõe o nome de partida.
              onBlur={(event) => {
                if (!event.target.value.trim()) {
                  setForm((current) => ({ ...current, service_name: AVULSO }));
                }
              }}
              placeholder="Ex.: Encaixe — retoque rápido"
            />
          </div>
        )}
      </fieldset>

      {/* --------------------------------------------------------- quando --- */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="ag-quando">
            Data e hora *
          </label>
          <input
            id="ag-quando"
            type="datetime-local"
            required
            className="input"
            value={form.starts_at}
            onChange={(event) => setForm({ ...form, starts_at: event.target.value })}
          />
        </div>
        <div>
          <label className="label" htmlFor="ag-duracao">
            Duração (min) *
          </label>
          <input
            id="ag-duracao"
            type="number"
            min={5}
            max={600}
            step={5}
            required
            className="input"
            value={form.duration_min}
            onChange={(event) => setForm({ ...form, duration_min: Number(event.target.value) })}
          />
        </div>
        <div>
          <label className="label" htmlFor="ag-preço">
            Valor (R$)
          </label>
          <input
            id="ag-preço"
            className="input"
            value={form.price_cents}
            onChange={(event) => setForm({ ...form, price_cents: event.target.value })}
            placeholder={selectedService ? undefined : "0,00"}
          />
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="ag-status">
            Situação
          </label>
          <select
            id="ag-status"
            className="input"
            value={form.status}
            onChange={(event) => setForm({ ...form, status: event.target.value })}
          >
            <option value="confirmed">Confirmado</option>
            <option value="pending">A aguardar confirmação</option>
            <option value="completed">Já realizado</option>
          </select>
          <p className="field-hint">
            Use "já realizado" para registrar um atendimento que aconteceu.
          </p>
        </div>

        <div className="flex items-end">
          <label className="flex cursor-pointer items-center gap-2.5 pb-2.5 text-sm text-ink-700">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
              checked={form.at_home}
              onChange={(event) => setForm({ ...form, at_home: event.target.checked })}
            />
            Atendimento ao domicílio
          </label>
        </div>
      </div>

      {form.at_home && (
        <div className="mt-4">
          <label className="label" htmlFor="ag-end">
            Morada *
          </label>
          <input
            id="ag-end"
            required
            className="input"
            value={form.address_line}
            onChange={(event) => setForm({ ...form, address_line: event.target.value })}
          />
        </div>
      )}

      <div className="mt-4">
        <label className="label" htmlFor="ag-obs">
          Observações
        </label>
        <textarea
          id="ag-obs"
          className="input min-h-20 resize-y"
          value={form.notes}
          onChange={(event) => setForm({ ...form, notes: event.target.value })}
        />
      </div>

      <div className="mt-5 flex gap-2">
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? "A guardar..." : "Criar marcação"}
        </button>
        <button type="button" onClick={onCancel} className="btn-ghost">
          Cancelar
        </button>
      </div>
    </form>
  );
}
