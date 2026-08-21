"use client";

import { useEffect, useState } from "react";

import AccountShell from "@/components/AccountShell";
import { IconTrash } from "@/components/Icons";
import { ApiError, api } from "@/lib/api";
import { WEEKDAYS, formatDateTime } from "@/lib/format";
import type { Availability, TimeOff } from "@/lib/types";

interface Window {
  start: string;
  end: string;
}

/** Grade semanal como um mapa dia -> janelas, mais fácil de editar na tela. */
type Grid = Record<number, Window[]>;

function emptyGrid(): Grid {
  return { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
}

export default function AgendaPage() {
  const [grid, setGrid] = useState<Grid>(emptyGrid);
  const [timeOffs, setTimeOffs] = useState<TimeOff[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "erro"; text: string } | null>(null);
  const [block, setBlock] = useState({ starts_at: "", ends_at: "", reason: "" });

  async function reload() {
    const [availability, offs] = await Promise.all([
      api.get<Availability[]>("/me/availability", { auth: true }),
      api.get<TimeOff[]>("/me/time-off", { auth: true }),
    ]);
    const next = emptyGrid();
    for (const item of availability) {
      next[item.weekday].push({
        start: item.start_time.slice(0, 5),
        end: item.end_time.slice(0, 5),
      });
    }
    setGrid(next);
    setTimeOffs(offs);
  }

  useEffect(() => {
    reload().catch(() =>
      setMessage({ kind: "erro", text: "Não foi possível carregar sua agenda." }),
    );
  }, []);

  function addWindow(weekday: number) {
    setGrid((current) => ({
      ...current,
      [weekday]: [...current[weekday], { start: "09:00", end: "18:00" }],
    }));
  }

  function updateWindow(weekday: number, index: number, field: keyof Window, value: string) {
    setGrid((current) => {
      const windows = [...current[weekday]];
      windows[index] = { ...windows[index], [field]: value };
      return { ...current, [weekday]: windows };
    });
  }

  function removeWindow(weekday: number, index: number) {
    setGrid((current) => ({
      ...current,
      [weekday]: current[weekday].filter((_, position) => position !== index),
    }));
  }

  /** Replica a grade de segunda nos demais dias uteis. */
  function copyMondayToWeekdays() {
    setGrid((current) => {
      const monday = current[0];
      const next = { ...current };
      for (let weekday = 1; weekday <= 4; weekday += 1) {
        next[weekday] = monday.map((window) => ({ ...window }));
      }
      return next;
    });
  }

  async function saveGrid() {
    setSaving(true);
    setMessage(null);
    try {
      const items = Object.entries(grid).flatMap(([weekday, windows]) =>
        windows.map((window) => ({
          weekday: Number(weekday),
          start_time: `${window.start}:00`,
          end_time: `${window.end}:00`,
        })),
      );
      await api.put("/me/availability", { items }, { auth: true });
      await reload();
      setMessage({ kind: "ok", text: "Horários atualizados." });
    } catch (error) {
      setMessage({
        kind: "erro",
        text: error instanceof ApiError ? error.message : "Não foi possível guardar.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function addBlock(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    try {
      await api.post(
        "/me/time-off",
        {
          starts_at: new Date(block.starts_at).toISOString(),
          ends_at: new Date(block.ends_at).toISOString(),
          reason: block.reason || null,
        },
        { auth: true },
      );
      setBlock({ starts_at: "", ends_at: "", reason: "" });
      await reload();
      setMessage({ kind: "ok", text: "Bloqueio criado." });
    } catch (error) {
      setMessage({
        kind: "erro",
        text: error instanceof ApiError ? error.message : "Não foi possível criar o bloqueio.",
      });
    }
  }

  async function removeBlock(id: number) {
    await api.delete(`/me/time-off/${id}`, { auth: true });
    await reload();
  }

  return (
    <AccountShell
      title="Horários de atendimento"
      subtitle="A agenda pública só oferece horários dentro destas janelas."
      allow={["professional"]}
      actions={
        <button onClick={saveGrid} disabled={saving} className="btn-primary btn-sm">
          {saving ? "A guardar..." : "Guardar horários"}
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

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <section className="card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-bold">Grade semanal</h2>
            <button onClick={copyMondayToWeekdays} className="btn-ghost btn-sm">
              Copiar segunda para os dias uteis
            </button>
          </div>

          <div className="mt-4 divide-y divide-ink-100">
            {WEEKDAYS.map((label, weekday) => (
              <div key={label} className="py-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-ink-800">{label}</h3>
                  <button
                    onClick={() => addWindow(weekday)}
                    className="text-xs font-semibold text-brand-600 hover:text-brand-700"
                  >
                    + Adicionar janela
                  </button>
                </div>

                {grid[weekday].length === 0 ? (
                  <p className="mt-2 text-sm text-ink-400">Fechado</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {grid[weekday].map((window, index) => (
                      <li key={index} className="flex items-center gap-2">
                        <input
                          type="equipa"
                          className="input max-w-32"
                          value={window.start}
                          onChange={(event) =>
                            updateWindow(weekday, index, "start", event.target.value)
                          }
                          aria-label={`Início ${label}`}
                        />
                        <span className="text-sm text-ink-400">as</span>
                        <input
                          type="equipa"
                          className="input max-w-32"
                          value={window.end}
                          onChange={(event) =>
                            updateWindow(weekday, index, "end", event.target.value)
                          }
                          aria-label={`Fim ${label}`}
                        />
                        <button
                          onClick={() => removeWindow(weekday, index)}
                          className="rounded-lg p-2 text-ink-400 transition hover:bg-rose-50 hover:text-rose-600"
                          aria-label="Remover janela"
                        >
                          <IconTrash className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>

          <button onClick={saveGrid} disabled={saving} className="btn-primary mt-5 w-full">
            {saving ? "A guardar..." : "Guardar horários"}
          </button>
        </section>

        <aside className="space-y-6">
          <section className="card p-6">
            <h2 className="font-bold">Bloquear um período</h2>
            <p className="mt-1 text-sm text-ink-500">
              Férias, compromisso ou folga. O período some da agenda pública.
            </p>

            <form onSubmit={addBlock} className="mt-4 space-y-3">
              <div>
                <label className="label" htmlFor="bloqueio-inicio">
                  Início
                </label>
                <input
                  id="bloqueio-inicio"
                  type="datetime-local"
                  required
                  className="input"
                  value={block.starts_at}
                  onChange={(event) => setBlock({ ...block, starts_at: event.target.value })}
                />
              </div>
              <div>
                <label className="label" htmlFor="bloqueio-fim">
                  Fim
                </label>
                <input
                  id="bloqueio-fim"
                  type="datetime-local"
                  required
                  className="input"
                  value={block.ends_at}
                  onChange={(event) => setBlock({ ...block, ends_at: event.target.value })}
                />
              </div>
              <div>
                <label className="label" htmlFor="bloqueio-motivo">
                  Motivo
                </label>
                <input
                  id="bloqueio-motivo"
                  className="input"
                  value={block.reason}
                  onChange={(event) => setBlock({ ...block, reason: event.target.value })}
                  placeholder="Opcional"
                />
              </div>
              <button type="submit" className="btn-secondary w-full">
                Bloquear período
              </button>
            </form>
          </section>

          <section className="card p-6">
            <h2 className="font-bold">Bloqueios ativos</h2>
            {timeOffs.length === 0 ? (
              <p className="mt-3 text-sm text-ink-400">Nenhum bloqueio no momento.</p>
            ) : (
              <ul className="mt-3 divide-y divide-ink-100">
                {timeOffs.map((item) => (
                  <li key={item.id} className="flex items-start justify-between gap-3 py-3">
                    <div className="min-w-0 text-sm">
                      <p className="font-medium text-ink-800">
                        {formatDateTime(item.starts_at)}
                      </p>
                      <p className="text-ink-500">até {formatDateTime(item.ends_at)}</p>
                      {item.reason && (
                        <p className="mt-0.5 text-xs text-ink-400">{item.reason}</p>
                      )}
                    </div>
                    <button
                      onClick={() => removeBlock(item.id)}
                      className="shrink-0 rounded-lg p-2 text-ink-400 transition hover:bg-rose-50 hover:text-rose-600"
                      aria-label="Remover bloqueio"
                    >
                      <IconTrash className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </AccountShell>
  );
}
