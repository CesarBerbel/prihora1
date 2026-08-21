"use client";

import { useCallback, useEffect, useState } from "react";

import DashboardShell from "@/components/DashboardShell";
import { IconCalendar, IconTrash, IconUser, IconWhatsapp } from "@/components/Icons";
import { PANEL_NAV } from "@/components/PanelNav";
import { ApiError, api } from "@/lib/api";
import { formatDate, formatDateTime, formatPhone, formatPrice, whatsappLink } from "@/lib/format";
import type { Client, ClientDetail, Paged } from "@/lib/types";

const EMPTY = {
  name: "",
  phone: "",
  email: "",
  birth_date: "",
  address_line: "",
  notes: "",
  is_active: true,
};

export default function ClientesPage() {
  const [query, setQuery] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paged<Client> | null>(null);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({ ...EMPTY });
  const [editing, setEditing] = useState<Client | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<ClientDetail | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "erro"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(
        await api.get<Paged<Client>>("/me/clients", {
          params: {
            q: query || undefined,
            include_inactive: includeInactive || undefined,
            page,
            per_page: 20,
          },
          auth: true,
        }),
      );
    } catch (error) {
      setMessage({
        kind: "erro",
        text: error instanceof ApiError ? error.message : "Não foi possível carregar.",
      });
    } finally {
      setLoading(false);
    }
  }, [query, includeInactive, page]);

  // Pesquisa com respiro, para não consultar a cada tecla.
  useEffect(() => {
    const timer = setTimeout(() => void load(), 250);
    return () => clearTimeout(timer);
  }, [load]);

  function startCreate() {
    setEditing(null);
    setForm({ ...EMPTY });
    setOpen(true);
    setMessage(null);
  }

  function startEdit(client: Client) {
    setEditing(client);
    setForm({
      name: client.name,
      phone: client.phone ?? "",
      email: client.email ?? "",
      birth_date: client.birth_date ?? "",
      address_line: client.address_line ?? "",
      notes: client.notes ?? "",
      is_active: client.is_active,
    });
    setOpen(true);
    setMessage(null);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const payload = {
        ...form,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        birth_date: form.birth_date || null,
        address_line: form.address_line.trim() || null,
        notes: form.notes.trim() || null,
      };
      if (editing) await api.put(`/me/clients/${editing.id}`, payload, { auth: true });
      else await api.post("/me/clients", payload, { auth: true });

      setOpen(false);
      await load();
      setMessage({ kind: "ok", text: editing ? "Ficha atualizada." : "Cliente registado." });
    } catch (error) {
      setMessage({
        kind: "erro",
        text: error instanceof ApiError ? error.message : "Não foi possível guardar.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function remove(client: Client) {
    if (!window.confirm(`Remover ${client.name} da sua lista?`)) return;
    try {
      const result = await api.delete<{ detail: string }>(`/me/clients/${client.id}`, {
        auth: true,
      });
      await load();
      setMessage({ kind: "ok", text: result.detail });
    } catch (error) {
      setMessage({
        kind: "erro",
        text: error instanceof ApiError ? error.message : "Não foi possível remover.",
      });
    }
  }

  async function openDetail(client: Client) {
    setDetail(null);
    try {
      setDetail(await api.get<ClientDetail>(`/me/clients/${client.id}`, { auth: true }));
    } catch {
      setMessage({ kind: "erro", text: "Não foi possível abrir a ficha." });
    }
  }

  return (
    <DashboardShell
      title="Clientes"
      subtitle="A sua agenda de contatos. Quem agenda pelo site entra aqui sozinho."
      nav={PANEL_NAV}
      allow={["professional"]}
      actions={
        <button onClick={startCreate} className="btn-primary btn-sm">
          Novo cliente
        </button>
      }
    >
      {message && (
        <p
          className={`mb-6 rounded-xl px-4 py-3 text-sm ${
            message.kind === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-700"
          }`}
        >
          {message.text}
        </p>
      )}

      {open && (
        <form onSubmit={submit} className="card mb-6 p-6">
          <h2 className="font-bold">{editing ? `Editar ${editing.name}` : "Novo cliente"}</h2>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="cli-nome">
                Nome *
              </label>
              <input
                id="cli-nome"
                required
                minLength={2}
                className="input"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </div>
            <div>
              <label className="label" htmlFor="cli-tel">
                Telefone / WhatsApp
              </label>
              <input
                id="cli-tel"
                className="input"
                value={form.phone}
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
                placeholder="912 345 678"
              />
              <p className="field-hint">Usado para reconhecer a pessoa em novas marcações.</p>
            </div>
            <div>
              <label className="label" htmlFor="cli-email">
                E-mail
              </label>
              <input
                id="cli-email"
                type="email"
                className="input"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
              />
            </div>
            <div>
              <label className="label" htmlFor="cli-nasc">
                Aniversário
              </label>
              <input
                id="cli-nasc"
                type="date"
                className="input"
                value={form.birth_date}
                onChange={(event) => setForm({ ...form, birth_date: event.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="cli-end">
                Morada
              </label>
              <input
                id="cli-end"
                className="input"
                value={form.address_line}
                onChange={(event) => setForm({ ...form, address_line: event.target.value })}
                placeholder="Para atendimento ao domicílio"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="cli-obs">
                Anotacoes
              </label>
              <textarea
                id="cli-obs"
                className="input min-h-24 resize-y"
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
                placeholder="Alergias, preferências, histórico de cores, o que for útil recordar"
              />
            </div>
          </div>

          <div className="mt-5 flex gap-2">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? "A guardar..." : "Guardar cliente"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost">
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <input
          className="input max-w-sm"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(1);
          }}
          placeholder="Procurar por nome, telefone ou e-mail"
        />
        <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-600">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
            checked={includeInactive}
            onChange={(event) => {
              setIncludeInactive(event.target.checked);
              setPage(1);
            }}
          />
          Mostrar arquivados
        </label>
      </div>

      {loading && !data ? (
        <div className="h-64 animate-pulse rounded-xl2 bg-ink-100" />
      ) : !data || data.items.length === 0 ? (
        <div className="rounded-xl2 border border-dashed border-ink-200 bg-white px-6 py-16 text-center">
          <IconUser className="mx-auto h-8 w-8 text-ink-300" />
          <h2 className="mt-3 text-lg font-semibold">
            {query ? "Nenhum cliente com esse termo" : "Sua lista esta vazia"}
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-ink-500">
            {query
              ? "Tente outro nome ou telefone."
              : "Registe manualmente ou espere o primeira marcação pelo site: a ficha e criada sozinha."}
          </p>
          {!query && (
            <button onClick={startCreate} className="btn-primary mt-5">
              Registar primeiro cliente
            </button>
          )}
        </div>
      ) : (
        <>
          <ul className="grid gap-3 md:grid-cols-2">
            {data.items.map((client) => (
              <li
                key={client.id}
                className={`card p-5 ${client.is_active ? "" : "opacity-60"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold text-ink-900">{client.name}</h3>
                    <div className="mt-1 space-y-0.5 text-sm text-ink-500">
                      {client.phone && <p>{formatPhone(client.phone)}</p>}
                      {client.email && <p className="truncate">{client.email}</p>}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {!client.is_active && (
                      <span className="chip bg-ink-100 text-ink-500 ring-ink-200">Arquivado</span>
                    )}
                    {client.created_from_booking && (
                      <span className="chip bg-brand-50 text-brand-700 ring-brand-200">
                        via site
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-500">
                  <span className="inline-flex items-center gap-1">
                    <IconCalendar className="h-3.5 w-3.5" />
                    {client.bookings_count === 1
                      ? "1 atendimento"
                      : `${client.bookings_count} atendimentos`}
                  </span>
                  {client.last_visit_at && (
                    <span>último em {formatDate(client.last_visit_at)}</span>
                  )}
                  {client.birth_date && <span>nasc. {formatDate(client.birth_date)}</span>}
                </div>

                {client.notes && (
                  <p className="mt-3 line-clamp-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    {client.notes}
                  </p>
                )}

                <div className="mt-4 flex flex-wrap gap-2 border-t border-ink-100 pt-4">
                  <button onClick={() => openDetail(client)} className="btn-secondary btn-sm">
                    Ver ficha
                  </button>
                  <button onClick={() => startEdit(client)} className="btn-ghost btn-sm">
                    Editar
                  </button>
                  {whatsappLink(client.phone) && (
                    <a
                      href={whatsappLink(client.phone)!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-ghost btn-sm"
                    >
                      <IconWhatsapp className="h-4 w-4 text-emerald-600" />
                    </a>
                  )}
                  <button
                    onClick={() => remove(client)}
                    className="btn-ghost btn-sm ml-auto text-rose-600 hover:bg-rose-50"
                    aria-label={`Remover ${client.name}`}
                  >
                    <IconTrash className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>

          {data.pages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                onClick={() => setPage((v) => Math.max(1, v - 1))}
                disabled={page <= 1}
                className="btn-secondary btn-sm"
              >
                Anterior
              </button>
              <span className="text-sm text-ink-500">
                Página {data.page} de {data.pages} | {data.total} clientes
              </span>
              <button
                onClick={() => setPage((v) => Math.min(data.pages, v + 1))}
                disabled={page >= data.pages}
                className="btn-secondary btn-sm"
              >
                Próxima
              </button>
            </div>
          )}
        </>
      )}

      {detail && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-ink-950/70 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl2 bg-white shadow-lift">
            <div className="sticky top-0 flex items-start justify-between gap-3 border-b border-ink-100 bg-white px-6 py-4">
              <div className="min-w-0">
                <h2 className="truncate text-lg font-bold">{detail.name}</h2>
                <p className="text-sm text-ink-500">
                  Cliente desde {formatDate(detail.created_at)}
                </p>
              </div>
              <button
                onClick={() => setDetail(null)}
                className="btn-ghost btn-sm shrink-0"
                aria-label="Fechar"
              >
                Fechar
              </button>
            </div>

            <div className="space-y-5 p-6">
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                {[
                  ["Telefone", detail.phone],
                  ["E-mail", detail.email],
                  ["Aniversário", detail.birth_date ? formatDate(detail.birth_date) : null],
                  ["Morada", detail.address_line],
                ]
                  .filter(([, value]) => Boolean(value))
                  .map(([label, value]) => (
                    <div key={String(label)}>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                        {label}
                      </dt>
                      <dd className="mt-0.5 text-ink-800">{value}</dd>
                    </div>
                  ))}
              </dl>

              {detail.notes && (
                <div className="rounded-xl bg-amber-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                    Anotacoes
                  </p>
                  <p className="mt-1 whitespace-pre-line text-sm text-amber-900">
                    {detail.notes}
                  </p>
                </div>
              )}

              <div>
                <h3 className="font-semibold">
                  Histórico de atendimentos ({detail.bookings.length})
                </h3>
                {detail.bookings.length === 0 ? (
                  <p className="mt-2 text-sm text-ink-400">Nenhum atendimento registrado.</p>
                ) : (
                  <ul className="mt-3 divide-y divide-ink-100">
                    {detail.bookings.map((booking) => (
                      <li key={booking.id} className="flex items-center justify-between gap-3 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-ink-800">
                            {booking.service_name}
                          </p>
                          <p className="text-xs text-ink-500">
                            {formatDateTime(booking.starts_at)}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm font-semibold">
                          {formatPrice(booking.price_cents)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
