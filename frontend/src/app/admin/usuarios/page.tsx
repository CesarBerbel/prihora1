"use client";

import { useCallback, useEffect, useState } from "react";

import DashboardShell from "@/components/DashboardShell";
import { ADMIN_NAV } from "@/components/PanelNav";
import { ApiError, api } from "@/lib/api";
import { formatDate, formatPhone } from "@/lib/format";
import type { AdminUser, Paged, UserRole } from "@/lib/types";

const ROLE_LABEL: Record<UserRole, string> = {
  client: "Cliente",
  professional: "Profissional",
  admin: "Administrador",
};

const ROLE_STYLE: Record<UserRole, string> = {
  client: "bg-ink-100 text-ink-600 ring-ink-200",
  professional: "bg-brand-50 text-brand-700 ring-brand-200",
  admin: "bg-sky-50 text-sky-700 ring-sky-200",
};

export default function AdminUsuariosPage() {
  const [query, setQuery] = useState("");
  // "" = todos. O estado é o que resta filtrar depois de a lista passar a
  // ser só de clientes.
  const [estado, setEstado] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paged<AdminUser> | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ kind: "ok" | "erro"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.get<Paged<AdminUser>>("/admin/users", {
        params: {
          q: query || undefined,
          is_active: estado === "" ? undefined : estado === "ativos",
          page,
          per_page: 20,
        },
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
  }, [query, estado, page]);

  useEffect(() => {
    void load();
  }, [load]);

  async function patch(user: AdminUser, body: Record<string, unknown>, ok: string) {
    setMessage(null);
    try {
      await api.patch(`/admin/users/${user.id}`, body, { auth: true });
      await load();
      setMessage({ kind: "ok", text: ok });
    } catch (error) {
      setMessage({
        kind: "erro",
        text: error instanceof ApiError ? error.message : "Não foi possível atualizar.",
      });
    }
  }

  return (
    <DashboardShell
      title="Contas de clientes"
      subtitle="Quem marca. Os profissionais estão em Profissionais, com o perfil e o plano."
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
        <div className="scroll-soft -mx-1 flex gap-2 overflow-x-auto px-1 py-1">
          {[
            { value: "", label: "Todos" },
            { value: "ativos", label: "Ativos" },
            { value: "bloqueados", label: "Bloqueados" },
          ].map((item) => (
            <button
              key={item.value}
              onClick={() => {
                setEstado(item.value);
                setPage(1);
              }}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${
                estado === item.value
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
          placeholder="Procurar por nome ou e-mail"
        />
      </div>

      {loading ? (
        <div className="h-96 animate-pulse rounded-xl2 bg-ink-100" />
      ) : !data || data.items.length === 0 ? (
        <div className="rounded-xl2 border border-dashed border-ink-200 bg-white px-6 py-16 text-center">
          <p className="font-semibold">Nenhuma conta encontrada</p>
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl2 border border-ink-100 bg-white shadow-card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-ink-100 bg-ink-50/60 text-left">
                  <tr>
                    <th className="px-5 py-3 font-semibold text-ink-600">Nome</th>
                    <th className="px-5 py-3 font-semibold text-ink-600">Contato</th>
                    <th className="px-5 py-3 font-semibold text-ink-600">Perfil</th>
                    <th className="px-5 py-3 font-semibold text-ink-600">Situação</th>
                    <th className="px-5 py-3 font-semibold text-ink-600">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {data.items.map((user) => (
                    <tr key={user.id} className="hover:bg-ink-50/40">
                      <td className="px-5 py-4">
                        <p className="font-semibold text-ink-900">{user.name}</p>
                        <p className="mt-0.5 text-xs text-ink-400">
                          Registo em {formatDate(user.created_at)}
                        </p>
                      </td>
                      <td className="px-5 py-4 text-ink-600">
                        <p>{user.email}</p>
                        {user.phone && <p className="text-xs text-ink-400">{formatPhone(user.phone)}</p>}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`chip ${ROLE_STYLE[user.role]}`}>
                          {ROLE_LABEL[user.role]}
                        </span>
                        {user.professional_slug && (
                          <a
                            href={`/p/${user.professional_slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1 block text-xs text-brand-600 hover:underline"
                          >
                            ver perfil
                          </a>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`chip ${
                            user.is_active
                              ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
                              : "bg-rose-50 text-rose-700 ring-rose-200"
                          }`}
                        >
                          {user.is_active ? "Ativa" : "Bloqueada"}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <button
                          onClick={() =>
                            patch(
                              user,
                              { is_active: !user.is_active },
                              user.is_active ? "Conta bloqueada." : "Conta reativada.",
                            )
                          }
                          className={`btn-sm ${
                            user.is_active
                              ? "btn-ghost text-rose-600 hover:bg-rose-50"
                              : "btn-primary"
                          }`}
                        >
                          {user.is_active ? "Bloquear" : "Reativar"}
                        </button>
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
                Página {data.page} de {data.pages} | {data.total} contas
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
