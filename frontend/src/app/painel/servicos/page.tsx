"use client";

import { useEffect, useState } from "react";

import AccountShell from "@/components/AccountShell";
import { IconClock, IconTrash } from "@/components/Icons";
import { ApiError, api } from "@/lib/api";
import { formatDuration, formatPrice } from "@/lib/format";
import type { Category, ProfessionalPrivate, Service } from "@/lib/types";

const EMPTY = {
  name: "",
  description: "",
  duration_min: 60,
  price_cents: 0,
  category_id: null as number | null,
  is_active: true,
  sort_order: 100,
};

export default function ServicosPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [profile, setProfile] = useState<ProfessionalPrivate | null>(null);
  const [editing, setEditing] = useState<Service | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [priceInput, setPriceInput] = useState("0,00");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "erro"; text: string } | null>(null);

  async function reload() {
    const [servicesData, profileData] = await Promise.all([
      api.get<Service[]>("/me/services", { auth: true }),
      api.get<ProfessionalPrivate>("/me/professional", { auth: true }),
    ]);
    setServices(servicesData);
    setProfile(profileData);
  }

  useEffect(() => {
    Promise.all([reload(), api.get<Category[]>("/categories").then(setCategories)]).catch(() =>
      setMessage({ kind: "erro", text: "Não foi possível carregar seus serviços." }),
    );
  }, []);

  function startCreate() {
    setEditing(null);
    setForm({ ...EMPTY, sort_order: (services.length + 1) * 10 });
    setPriceInput("0,00");
    setOpen(true);
    setMessage(null);
  }

  function startEdit(service: Service) {
    setEditing(service);
    setForm({
      name: service.name,
      description: service.description ?? "",
      duration_min: service.duration_min,
      price_cents: service.price_cents,
      category_id: service.category_id ?? null,
      is_active: service.is_active,
      sort_order: service.sort_order,
    });
    setPriceInput((service.price_cents / 100).toFixed(2).replace(".", ","));
    setOpen(true);
    setMessage(null);
  }

  /** Converte "150,00" ou "150.00" em centavos. */
  function parsePrice(text: string): number {
    const normalized = text.replace(/[^\d,.-]/g, "").replace(",", ".");
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const payload = { ...form, price_cents: parsePrice(priceInput) };
      if (editing) {
        await api.put(`/me/services/${editing.id}`, payload, { auth: true });
      } else {
        await api.post("/me/services", payload, { auth: true });
      }
      await reload();
      setOpen(false);
      setMessage({ kind: "ok", text: editing ? "Serviço atualizado." : "Serviço criado." });
    } catch (error) {
      setMessage({
        kind: "erro",
        text: error instanceof ApiError ? error.message : "Não foi possível guardar.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function remove(service: Service) {
    if (!window.confirm(`Remover "${service.name}"?`)) return;
    try {
      const result = await api.delete<{ detail: string }>(`/me/services/${service.id}`, {
        auth: true,
      });
      await reload();
      setMessage({ kind: "ok", text: result.detail });
    } catch (error) {
      setMessage({
        kind: "erro",
        text: error instanceof ApiError ? error.message : "Não foi possível remover.",
      });
    }
  }

  const limit = profile?.plan?.max_services;
  const atLimit = limit !== undefined && limit !== null && services.length >= limit;

  return (
    <AccountShell
      title="Serviços"
      subtitle="O que você oferece, quanto custa e quanto tempo leva."
      allow={["professional"]}
      actions={
        <button onClick={startCreate} disabled={atLimit} className="btn-primary btn-sm">
          Novo serviço
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

      {atLimit && (
        <p className="mb-6 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Você atingiu o limite de {limit} serviços do plano {profile?.plan?.name}. Faca upgrade
          para registar mais.
        </p>
      )}

      {open && (
        <form onSubmit={submit} className="card mb-6 p-6">
          <h2 className="font-bold">{editing ? "Editar serviço" : "Novo serviço"}</h2>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label" htmlFor="servico-nome">
                Nome do serviço *
              </label>
              <input
                id="servico-nome"
                required
                minLength={2}
                className="input"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="Ex.: Alongamento em gel"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="label" htmlFor="servico-desc">
                Descrição
              </label>
              <textarea
                id="servico-desc"
                className="input min-h-20 resize-y"
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                placeholder="O que está incluído, materiais usados, cuidados..."
              />
            </div>

            <div>
              <label className="label" htmlFor="servico-duracao">
                Duração (minutos) *
              </label>
              <input
                id="servico-duracao"
                type="number"
                min={5}
                max={600}
                step={5}
                required
                className="input"
                value={form.duration_min}
                onChange={(event) =>
                  setForm({ ...form, duration_min: Number(event.target.value) })
                }
              />
              <p className="field-hint">Define quanto tempo o horário fica ocupado.</p>
            </div>

            <div>
              <label className="label" htmlFor="servico-preço">
                Preço (R$)
              </label>
              <input
                id="servico-preço"
                className="input"
                value={priceInput}
                onChange={(event) => setPriceInput(event.target.value)}
                placeholder="0,00"
              />
              <p className="field-hint">Use 0 para "sob consulta".</p>
            </div>

            <div>
              <label className="label" htmlFor="servico-categoria">
                Categoria
              </label>
              <select
                id="servico-categoria"
                className="input"
                value={form.category_id ?? ""}
                onChange={(event) =>
                  setForm({
                    ...form,
                    category_id: event.target.value ? Number(event.target.value) : null,
                  })
                }
              >
                <option value="">Sem categoria</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <label className="flex cursor-pointer items-center gap-2.5 pb-2.5 text-sm text-ink-700">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                  checked={form.is_active}
                  onChange={(event) => setForm({ ...form, is_active: event.target.checked })}
                />
                Disponível para marcação
              </label>
            </div>
          </div>

          <div className="mt-5 flex gap-2">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? "A guardar..." : "Guardar serviço"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost">
              Cancelar
            </button>
          </div>
        </form>
      )}

      {services.length === 0 ? (
        <div className="rounded-xl2 border border-dashed border-ink-200 bg-white px-6 py-16 text-center">
          <h2 className="text-lg font-semibold">Nenhum serviço registado</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-ink-500">
            Registe pelo menos um serviço para que os clientes possam marcar consigo.
          </p>
          <button onClick={startCreate} className="btn-primary mt-5">
            Registar primeiro serviço
          </button>
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {services.map((service) => (
            <li
              key={service.id}
              className={`card p-5 ${service.is_active ? "" : "opacity-60"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-semibold text-ink-900">{service.name}</h3>
                  {service.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-ink-500">
                      {service.description}
                    </p>
                  )}
                </div>
                {!service.is_active && (
                  <span className="chip shrink-0 bg-ink-100 text-ink-500 ring-ink-200">
                    Inativo
                  </span>
                )}
              </div>

              <div className="mt-3 flex items-center gap-4 text-sm">
                <span className="inline-flex items-center gap-1 text-ink-500">
                  <IconClock className="h-4 w-4" />
                  {formatDuration(service.duration_min)}
                </span>
                <span className="font-semibold text-ink-900">
                  {formatPrice(service.price_cents)}
                </span>
              </div>

              <div className="mt-4 flex gap-2 border-t border-ink-100 pt-4">
                <button onClick={() => startEdit(service)} className="btn-secondary btn-sm">
                  Editar
                </button>
                <button
                  onClick={() => remove(service)}
                  className="btn-ghost btn-sm text-rose-600 hover:bg-rose-50"
                >
                  <IconTrash className="h-4 w-4" />
                  Remover
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </AccountShell>
  );
}
