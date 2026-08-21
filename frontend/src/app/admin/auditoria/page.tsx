"use client";

import { useEffect, useState } from "react";

import DashboardShell from "@/components/DashboardShell";
import { ADMIN_NAV } from "@/components/PanelNav";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import type { AuditLog } from "@/lib/types";

const ACTION_LABEL: Record<string, string> = {
  "professional.status": "Alterou a situação de um profissional",
  "professional.plan": "Trocou o plano de um profissional",
  "professional.delete": "Removeu um perfil profissional",
  "user.deactivate": "Bloqueou uma conta",
  "plan.create": "Criou um plano",
  "plan.update": "Editou um plano",
  "plan.delete": "Removeu um plano",
};

export default function AdminAuditoriaPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<AuditLog[]>("/admin/audit-logs", { params: { limit: 100 }, auth: true })
      .then(setLogs)
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <DashboardShell
      title="Auditoria"
      subtitle="Registro das ações administrativas."
      nav={ADMIN_NAV}
      allow={["admin"]}
    >
      {loading ? (
        <div className="h-96 animate-pulse rounded-xl2 bg-ink-100" />
      ) : logs.length === 0 ? (
        <div className="rounded-xl2 border border-dashed border-ink-200 bg-white px-6 py-16 text-center">
          <p className="font-semibold">Nenhuma acao registrada ainda</p>
          <p className="mt-1 text-sm text-ink-500">
            Aprovacoes, suspensoes e mudancas de plano aparecem aqui.
          </p>
        </div>
      ) : (
        <ol className="card divide-y divide-ink-100">
          {logs.map((log) => (
            <li key={log.id} className="flex items-start gap-4 p-5">
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-500" />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-ink-900">
                  {ACTION_LABEL[log.action] ?? log.action}
                </p>
                <p className="mt-0.5 text-sm text-ink-500">
                  {log.entity}
                  {log.entity_id ? ` #${log.entity_id}` : ""}
                  {log.detail ? ` | ${log.detail}` : ""}
                </p>
                <p className="mt-1 text-xs text-ink-400">
                  {log.actor_email ?? "sistema"} | {formatDateTime(log.created_at)}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </DashboardShell>
  );
}
