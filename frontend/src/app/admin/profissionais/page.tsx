"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import DashboardShell from "@/components/DashboardShell";
import { ADMIN_NAV } from "@/components/PanelNav";
import { ApiError, api } from "@/lib/api";
import {
  PROFESSIONAL_STATUS_LABEL,
  PROFESSIONAL_STATUS_STYLE,
  formatDate,
} from "@/lib/format";
import type { AdminProfessional, Paged, Plan, ProfessionalStatus } from "@/lib/types";

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "", label: "Todos" },
  { value: "pending", label: "A aguardar" },
  { value: "active", label: "Ativos" },
  { value: "suspended", label: "Suspensos" },
  { value: "inactive", label: "Inativos" },
];

export default function AdminProfissionaisPage() {
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paged<AdminProfessional> | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ kind: "ok" | "erro"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.get<Paged<AdminProfessional>>("/admin/professionals", {
        params: { status: status || undefined, q: query || undefined, page, per_page: 20 },
        auth: true,
      });
      setData(result);
    } catch (error) {
      setMessage({
        kind: "erro",
        text: error instanceof ApiError ? error.message : "Não foi possível carregar.",
      });
    } finally {
      setLoading(false);
    }
  }, [status, query, page]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    api
      .get<Plan[]>("/admin/plans", { auth: true })
      .then(setPlans)
      .catch(() => setPlans([]));
  }, []);

  async function patch(pro: AdminProfessional, body: Record<string, unknown>, ok: string) {
    setMessage(null);
    try {
      await api.patch(`/admin/professionals/${pro.id}`, body, { auth: true });
      await load();
      setMessage({ kind: "ok", text: ok });
    } catch (error) {
      setMessage({
        kind: "erro",
        text: error instanceof ApiError ? error.message : "Não foi possível atualizar.",
      });
    }
  }

  function suspend(pro: AdminProfessional) {
    const reason = window.prompt(`Motivo da suspensão de "${pro.display_name}":`);
    if (reason === null) return;
    void patch(
      pro,
      { status: "suspended" as ProfessionalStatus, suspension_reason: reason },
      "Perfil suspenso.",
    );
  }

  return (
    <DashboardShell
      title="Profissionais"
      subtitle="Aprove, verifique, destaque ou suspenda perfis."
      nav={ADMIN_NAV}
      allow={["admin"]}
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

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((item) => (
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

        <input
          className="input ml-auto max-w-xs"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(1);
          }}
          placeholder="Procurar por nome, e-mail ou cidade"
        />
      </div>

      {loading ? (
        <div className="h-96 animate-pulse rounded-xl2 bg-ink-100" />
      ) : !data || data.items.length === 0 ? (
        <div className="rounded-xl2 border border-dashed border-ink-200 bg-white px-6 py-16 text-center">
          <p className="font-semibold">Nenhum profissional encontrado</p>
          <p className="mt-1 text-sm text-ink-500">Ajuste os filtros ou a pesquisa.</p>
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl2 border border-ink-100 bg-white shadow-card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-ink-100 bg-ink-50/60 text-left">
                  <tr>
                    <th className="px-5 py-3 font-semibold text-ink-600">Profissional</th>
                    <th className="px-5 py-3 font-semibold text-ink-600">Situação</th>
                    <th className="px-5 py-3 font-semibold text-ink-600">Plano</th>
                    <th className="px-5 py-3 font-semibold text-ink-600">Atividade</th>
                    <th className="px-5 py-3 font-semibold text-ink-600">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {data.items.map((pro) => (
                    <tr key={pro.id} className="align-top hover:bg-ink-50/40">
                      <td className="px-5 py-4">
                        <Link
                          href={`/p/${pro.slug}`}
                          target="_blank"
                          className="font-semibold text-ink-900 hover:text-brand-700"
                        >
                          {pro.display_name}
                        </Link>
                        <p className="mt-0.5 text-xs text-ink-500">{pro.email}</p>
                        <p className="mt-0.5 text-xs text-ink-400">
                          {[pro.city, pro.state].filter(Boolean).join("/") || "Sem localização"}
                          {" | desde "}
                          {formatDate(pro.created_at)}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <span className={`chip ${PROFESSIONAL_STATUS_STYLE[pro.status]}`}>
                          {PROFESSIONAL_STATUS_LABEL[pro.status]}
                        </span>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {pro.is_verified && (
                            <span className="chip bg-sky-50 text-sky-700 ring-sky-200">
                              Verificado
                            </span>
                          )}
                          {pro.is_featured && (
                            <span className="chip bg-brand-50 text-brand-700 ring-brand-200">
                              Destaque
                            </span>
                          )}
                        </div>
                        {pro.suspension_reason && (
                          <p className="mt-1.5 max-w-48 text-xs text-rose-600">
                            {pro.suspension_reason}
                          </p>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <select
                          className="input py-1.5 text-xs"
                          value={plans.find((plan) => plan.name === pro.plan_name)?.id ?? ""}
                          onChange={(event) =>
                            patch(pro, { plan_id: Number(event.target.value) }, "Plano atualizado.")
                          }
                        >
                          <option value="">Sem plano</option>
                          {plans.map((plan) => (
                            <option key={plan.id} value={plan.id}>
                              {plan.name}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="px-5 py-4 text-xs text-ink-500">
                        <p>{pro.services_count} serviços</p>
                        <p>{pro.bookings_count} marcações</p>
                        <p>
                          {pro.rating_count > 0
                            ? `${pro.rating_avg.toFixed(1).replace(".", ",")} (${pro.rating_count})`
                            : "Sem notas"}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-1.5">
                          {pro.status !== "active" && (
                            <button
                              onClick={() =>
                                patch(pro, { status: "active" }, "Perfil aprovado e publicado.")
                              }
                              className="btn-primary btn-sm"
                            >
                              Aprovar
                            </button>
                          )}
                          {pro.status !== "suspended" && (
                            <button onClick={() => suspend(pro)} className="btn-secondary btn-sm">
                              Suspender
                            </button>
                          )}
                          <button
                            onClick={() =>
                              patch(
                                pro,
                                { is_verified: !pro.is_verified },
                                pro.is_verified ? "Selo removido." : "Perfil verificado.",
                              )
                            }
                            className="btn-ghost btn-sm"
                          >
                            {pro.is_verified ? "Tirar selo" : "Verificar"}
                          </button>
                          <button
                            onClick={() =>
                              patch(
                                pro,
                                { is_featured: !pro.is_featured },
                                pro.is_featured ? "Destaque removido." : "Perfil destacado.",
                              )
                            }
                            className="btn-ghost btn-sm"
                          >
                            {pro.is_featured ? "Tirar destaque" : "Destacar"}
                          </button>
                        </div>
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
                Página {data.page} de {data.pages} | {data.total} no total
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
