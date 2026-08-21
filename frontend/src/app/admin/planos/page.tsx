"use client";

import { useEffect, useState } from "react";

import DashboardShell from "@/components/DashboardShell";
import { IconTrash } from "@/components/Icons";
import { ADMIN_NAV } from "@/components/PanelNav";
import { ApiError, api } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import type { Plan } from "@/lib/types";

const EMPTY = {
  slug: "",
  name: "",
  description: "",
  price_cents: 0,
  billing_interval: "monthly",
  max_services: 5,
  max_photos: 5,
  max_bookings_per_month: 50,
  featured_listing: false,
  online_agenda: true,
  analytics: false,
  priority_support: false,
  trial_days: 0,
  is_active: true,
  is_default: false,
  sort_order: 100,
};

type Form = typeof EMPTY;

export default function AdminPlanosPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [form, setForm] = useState<Form>({ ...EMPTY });
  const [priceInput, setPriceInput] = useState("0,00");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "erro"; text: string } | null>(null);

  async function reload() {
    setPlans(await api.get<Plan[]>("/admin/plans", { auth: true }));
  }

  useEffect(() => {
    reload().catch(() =>
      setMessage({ kind: "erro", text: "Não foi possível carregar os planos." }),
    );
  }, []);

  function startCreate() {
    setEditing(null);
    setForm({ ...EMPTY, sort_order: (plans.length + 1) * 10 });
    setPriceInput("0,00");
    setOpen(true);
    setMessage(null);
  }

  function startEdit(plan: Plan) {
    setEditing(plan);
    setForm({
      slug: plan.slug,
      name: plan.name,
      description: plan.description ?? "",
      price_cents: plan.price_cents,
      billing_interval: plan.billing_interval,
      max_services: plan.max_services,
      max_photos: plan.max_photos,
      max_bookings_per_month: plan.max_bookings_per_month,
      featured_listing: plan.featured_listing,
      online_agenda: plan.online_agenda,
      analytics: plan.analytics,
      priority_support: plan.priority_support,
      trial_days: plan.trial_days,
      is_active: plan.is_active,
      is_default: plan.is_default,
      sort_order: plan.sort_order,
    });
    setPriceInput((plan.price_cents / 100).toFixed(2).replace(".", ","));
    setOpen(true);
    setMessage(null);
  }

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
      const payload = {
        ...form,
        price_cents: parsePrice(priceInput),
        slug: form.slug || null,
      };
      if (editing) await api.put(`/admin/plans/${editing.id}`, payload, { auth: true });
      else await api.post("/admin/plans", payload, { auth: true });

      await reload();
      setOpen(false);
      setMessage({ kind: "ok", text: editing ? "Plano atualizado." : "Plano criado." });
    } catch (error) {
      setMessage({
        kind: "erro",
        text: error instanceof ApiError ? error.message : "Não foi possível guardar.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function remove(plan: Plan) {
    if (!window.confirm(`Remover o plano "${plan.name}"?`)) return;
    try {
      const result = await api.delete<{ detail: string }>(`/admin/plans/${plan.id}`, {
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

  function set<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  const NUMBER_FIELDS: { key: keyof Form; label: string; hint?: string }[] = [
    { key: "max_services", label: "Máximo de serviços" },
    { key: "max_photos", label: "Máximo de fotos" },
    { key: "max_bookings_per_month", label: "Marcações por mês" },
    { key: "trial_days", label: "Dias de teste grátis" },
    { key: "sort_order", label: "Ordem de exibicao", hint: "Menor aparece primeiro" },
  ];

  const FLAGS: { key: keyof Form; label: string }[] = [
    { key: "featured_listing", label: "Destaque nos resultados de pesquisa" },
    { key: "online_agenda", label: "Agenda pública online" },
    { key: "analytics", label: "Relatórios de desempenho" },
    { key: "priority_support", label: "Apoio prioritario" },
    { key: "is_active", label: "Plano ativo (visível no site)" },
    { key: "is_default", label: "Plano padrão para novos registos" },
  ];

  return (
    <DashboardShell
      title="Planos"
      subtitle="Defina os limites e beneficios de cada subscrição."
      nav={ADMIN_NAV}
      allow={["admin"]}
      actions={
        <button onClick={startCreate} className="btn-primary btn-sm">
          Novo plano
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
          <h2 className="font-bold">{editing ? `Editar ${editing.name}` : "Novo plano"}</h2>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="plano-nome">
                Nome *
              </label>
              <input
                id="plano-nome"
                required
                className="input"
                value={form.name}
                onChange={(event) => set("name", event.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="plano-slug">
                Identificador
              </label>
              <input
                id="plano-slug"
                className="input"
                value={form.slug}
                onChange={(event) => set("slug", event.target.value)}
                placeholder="gerado a partir do nome"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="label" htmlFor="plano-desc">
                Descrição
              </label>
              <input
                id="plano-desc"
                className="input"
                value={form.description}
                onChange={(event) => set("description", event.target.value)}
              />
            </div>

            <div>
              <label className="label" htmlFor="plano-preço">
                Preço (R$)
              </label>
              <input
                id="plano-preço"
                className="input"
                value={priceInput}
                onChange={(event) => setPriceInput(event.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="plano-ciclo">
                Ciclo de cobranca
              </label>
              <select
                id="plano-ciclo"
                className="input"
                value={form.billing_interval}
                onChange={(event) => set("billing_interval", event.target.value)}
              >
                <option value="monthly">Mensal</option>
                <option value="yearly">Anual</option>
              </select>
            </div>

            {NUMBER_FIELDS.map((field) => (
              <div key={String(field.key)}>
                <label className="label" htmlFor={`plano-${String(field.key)}`}>
                  {field.label}
                </label>
                <input
                  id={`plano-${String(field.key)}`}
                  type="number"
                  min={0}
                  className="input"
                  value={form[field.key] as number}
                  onChange={(event) =>
                    set(field.key, Number(event.target.value) as Form[typeof field.key])
                  }
                />
                {field.hint && <p className="field-hint">{field.hint}</p>}
              </div>
            ))}
          </div>

          <div className="mt-5 grid gap-2 border-t border-ink-100 pt-5 sm:grid-cols-2">
            {FLAGS.map((flag) => (
              <label
                key={String(flag.key)}
                className="flex cursor-pointer items-center gap-2.5 text-sm text-ink-700"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                  checked={form[flag.key] as boolean}
                  onChange={(event) =>
                    set(flag.key, event.target.checked as Form[typeof flag.key])
                  }
                />
                {flag.label}
              </label>
            ))}
          </div>

          <div className="mt-5 flex gap-2">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? "A guardar..." : "Guardar plano"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost">
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`flex flex-col rounded-xl2 border bg-white p-5 shadow-card ${
              plan.is_active ? "border-ink-100" : "border-ink-200 opacity-60"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-bold">{plan.name}</h3>
              <div className="flex shrink-0 flex-col items-end gap-1">
                {plan.is_default && (
                  <span className="chip bg-brand-50 text-brand-700 ring-brand-200">Padrão</span>
                )}
                {!plan.is_active && (
                  <span className="chip bg-ink-100 text-ink-500 ring-ink-200">Inativo</span>
                )}
              </div>
            </div>

            <p className="mt-2 text-2xl font-bold tracking-tight">
              {plan.price_cents === 0 ? "Grátis" : formatPrice(plan.price_cents)}
              {plan.price_cents > 0 && (
                <span className="text-sm font-normal text-ink-400">
                  /{plan.billing_interval === "yearly" ? "ano" : "mês"}
                </span>
              )}
            </p>

            {plan.description && (
              <p className="mt-2 text-sm text-ink-500">{plan.description}</p>
            )}

            <dl className="mt-4 flex-1 space-y-1 text-xs text-ink-500">
              <div className="flex justify-between">
                <dt>Serviços</dt>
                <dd className="font-medium text-ink-700">{plan.max_services}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Fotos</dt>
                <dd className="font-medium text-ink-700">{plan.max_photos}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Marcações/mês</dt>
                <dd className="font-medium text-ink-700">{plan.max_bookings_per_month}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Teste grátis</dt>
                <dd className="font-medium text-ink-700">
                  {plan.trial_days > 0 ? `${plan.trial_days} dias` : "não"}
                </dd>
              </div>
              <div className="flex flex-wrap gap-1 pt-2">
                {plan.featured_listing && (
                  <span className="chip bg-brand-50 text-brand-700 ring-brand-200">Destaque</span>
                )}
                {plan.analytics && (
                  <span className="chip bg-sky-50 text-sky-700 ring-sky-200">Relatórios</span>
                )}
                {plan.priority_support && (
                  <span className="chip bg-emerald-50 text-emerald-700 ring-emerald-200">
                    Apoio
                  </span>
                )}
              </div>
            </dl>

            <div className="mt-4 flex gap-2 border-t border-ink-100 pt-4">
              <button onClick={() => startEdit(plan)} className="btn-secondary btn-sm flex-1">
                Editar
              </button>
              <button
                onClick={() => remove(plan)}
                className="btn-ghost btn-sm text-rose-600 hover:bg-rose-50"
                aria-label={`Remover ${plan.name}`}
              >
                <IconTrash className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </DashboardShell>
  );
}
