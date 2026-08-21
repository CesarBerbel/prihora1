"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import DashboardShell from "@/components/DashboardShell";
import StatCard from "@/components/StatCard";
import { ADMIN_NAV } from "@/components/PanelNav";
import { api } from "@/lib/api";
import { BOOKING_STATUS_LABEL, formatPrice } from "@/lib/format";
import type { AdminStats } from "@/lib/types";

export default function AdminPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<AdminStats>("/admin/stats", { auth: true })
      .then(setStats)
      .catch(() => setError("Não foi possível carregar as metricas."));
  }, []);

  // Escala do mini grafico de registos: proporcional ao maior dia.
  const maxSignups = Math.max(1, ...(stats?.signups_by_day.map((day) => day.count) ?? [1]));

  return (
    <DashboardShell
      title="Painel administrativo"
      subtitle="Visao geral do marketplace."
      nav={ADMIN_NAV}
      allow={["admin"]}
    >
      {error && (
        <p className="mb-6 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
      )}

      {!stats ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="h-28 animate-pulse rounded-xl2 bg-ink-100" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Contas na plataforma"
              value={stats.total_users}
              hint={`${stats.total_clients} clientes | ${stats.total_professionals} profissionais`}
            />
            <StatCard
              label="Profissionais ativos"
              value={stats.professionals_active}
              hint={`${stats.professionals_suspended} suspensos`}
              tone="success"
            />
            <StatCard
              label="A aguardar aprovação"
              value={stats.professionals_pending}
              hint="Cadastros na fila de análise"
              tone={stats.professionals_pending > 0 ? "warning" : "default"}
            />
            <StatCard
              label="Receita recorrente (MRR)"
              value={formatPrice(stats.mrr_cents)}
              hint={`${stats.active_subscriptions} subscrições ativas`}
              tone="brand"
            />
          </div>

          {stats.professionals_pending > 0 && (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl2 border border-amber-200 bg-amber-50 p-5">
              <div>
                <h2 className="font-semibold text-amber-900">
                  {stats.professionals_pending}{" "}
                  {stats.professionals_pending === 1
                    ? "registo a aguardar"
                    : "registos a aguardar"}{" "}
                  análise
                </h2>
                <p className="mt-0.5 text-sm text-amber-800">
                  Aprove os perfis para que apareçam nas pesquisas.
                </p>
              </div>
              <Link href="/admin/profissionais?status=pending" className="btn-primary btn-sm">
                Revisar agora
              </Link>
            </div>
          )}

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <section className="card p-6">
              <h2 className="font-bold">Marcações</h2>
              <p className="mt-1 text-sm text-ink-500">
                {stats.total_bookings} no total | {stats.bookings_last_30d} nos últimos 30 dias
              </p>

              <ul className="mt-5 space-y-3">
                {Object.entries(stats.bookings_by_status).map(([status, count]) => {
                  const percent = stats.total_bookings
                    ? Math.round((count / stats.total_bookings) * 100)
                    : 0;
                  return (
                    <li key={status}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-ink-600">
                          {BOOKING_STATUS_LABEL[status] ?? status}
                        </span>
                        <span className="font-semibold text-ink-900">
                          {count}
                          <span className="ml-1 text-xs font-normal text-ink-400">
                            {percent}%
                          </span>
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink-100">
                        <div
                          className="h-full rounded-full bg-brand-500"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section className="card p-6">
              <h2 className="font-bold">Categorias com mais profissionais</h2>
              <ul className="mt-5 space-y-3">
                {stats.top_categories.map((category) => {
                  const percent = Math.round(
                    (category.professionals /
                      Math.max(1, stats.top_categories[0]?.professionals ?? 1)) *
                      100,
                  );
                  return (
                    <li key={category.slug}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-ink-600">{category.name}</span>
                        <span className="font-semibold text-ink-900">
                          {category.professionals}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink-100">
                        <div
                          className="h-full rounded-full bg-ink-400"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>

          <section className="card mt-6 p-6">
            <h2 className="font-bold">Novos registos (30 dias)</h2>
            {stats.signups_by_day.length === 0 ? (
              <p className="mt-3 text-sm text-ink-400">Sem registos no período.</p>
            ) : (
              <div className="mt-6 flex h-32 items-end gap-1">
                {stats.signups_by_day.map((day) => (
                  <div key={day.date} className="group relative flex-1" title={`${day.date}: ${day.count}`}>
                    <div
                      className="w-full rounded-t bg-brand-400 transition group-hover:bg-brand-600"
                      style={{ height: `${(day.count / maxSignups) * 100}%`, minHeight: "3px" }}
                    />
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </DashboardShell>
  );
}
