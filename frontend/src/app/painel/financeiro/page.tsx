"use client";

/**
 * O financeiro do profissional, em duas colunas de leitura.
 *
 * A esquerda responde "como está o mês": o que já foi ganho, o que ainda está
 * marcado, e o que sobra depois de comissão e despesas. A direita é onde se
 * mexe: a percentagem devida e a lista de despesas.
 *
 * A distinção entre **feito** e **previsto** atravessa o ecrã todo. Somá-los
 * daria um número maior e mais bonito que não corresponde a dinheiro nenhum
 * — o previsto ainda pode ser cancelado.
 */

import { useCallback, useEffect, useState } from "react";

import DashboardShell from "@/components/DashboardShell";
import FinanceChart from "@/components/FinanceChart";
import { IconTrash } from "@/components/Icons";
import { PANEL_NAV } from "@/components/PanelNav";
import { ApiError, api } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import type { Expense, FinanceSummary } from "@/lib/types";

/** Data de hoje em ISO local, para o campo de data da despesa. */
function hojeISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function tituloDoMes(ano: number, mes: number): string {
  return new Intl.DateTimeFormat("pt-PT", { month: "long", year: "numeric" }).format(
    new Date(ano, mes - 1, 1),
  );
}

const VAZIO = {
  description: "",
  amount: "",
  incurred_on: hojeISO(),
  category: "material",
  recurring: false,
};

export default function FinanceiroPage() {
  const agora = new Date();
  const [ano, setAno] = useState(agora.getFullYear());
  const [mes, setMes] = useState(agora.getMonth() + 1);

  const [resumo, setResumo] = useState<FinanceSummary | null>(null);
  const [despesas, setDespesas] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [comissao, setComissao] = useState("");
  const [aGuardarComissao, setAGuardarComissao] = useState(false);
  const [nova, setNova] = useState(VAZIO);
  const [aGuardarDespesa, setAGuardarDespesa] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [contas, lista] = await Promise.all([
        api.get<FinanceSummary>("/me/finance", { params: { ano, mes }, auth: true }),
        api.get<Expense[]>("/me/expenses", { params: { ano, mes }, auth: true }),
      ]);
      setResumo(contas);
      setDespesas(lista);
      setComissao(String(contas.commission_percent ?? 0));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível carregar as contas.");
    } finally {
      setLoading(false);
    }
  }, [ano, mes]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  function andar(passos: number) {
    const data = new Date(ano, mes - 1 + passos, 1);
    setAno(data.getFullYear());
    setMes(data.getMonth() + 1);
  }

  const eMesCorrente = ano === agora.getFullYear() && mes === agora.getMonth() + 1;

  async function guardarComissao(evento: React.FormEvent) {
    evento.preventDefault();
    setAGuardarComissao(true);
    setError(null);
    try {
      await api.put(
        "/me/finance/commission",
        { commission_percent: Number(comissao.replace(",", ".")) || 0 },
        { auth: true },
      );
      await carregar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível guardar.");
    } finally {
      setAGuardarComissao(false);
    }
  }

  async function criarDespesa(evento: React.FormEvent) {
    evento.preventDefault();
    const euros = Number(nova.amount.replace(",", "."));
    if (!nova.description.trim() || !Number.isFinite(euros) || euros <= 0) return;

    setAGuardarDespesa(true);
    setError(null);
    try {
      await api.post(
        "/me/expenses",
        {
          description: nova.description.trim(),
          amount_cents: Math.round(euros * 100),
          incurred_on: nova.incurred_on,
          category: nova.category,
          recurring: nova.recurring,
        },
        { auth: true },
      );
      setNova({ ...VAZIO, incurred_on: nova.incurred_on, category: nova.category });
      await carregar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível registar a despesa.");
    } finally {
      setAGuardarDespesa(false);
    }
  }

  async function apagarDespesa(id: number) {
    try {
      await api.delete(`/me/expenses/${id}`, { auth: true });
      await carregar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível remover.");
    }
  }

  return (
    <DashboardShell
      title="Financeiro"
      subtitle="O que já ganhou, o que está previsto e o que sai."
      nav={PANEL_NAV}
      allow={["professional"]}
    >
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex items-center rounded-full border border-ink-200 bg-white">
          <button
            onClick={() => andar(-1)}
            className="rounded-l-full px-3 py-1.5 text-ink-600 transition hover:bg-ink-100"
            aria-label="Mês anterior"
          >
            ‹
          </button>
          <button
            onClick={() => andar(1)}
            className="rounded-r-full border-l border-ink-200 px-3 py-1.5 text-ink-600 transition hover:bg-ink-100"
            aria-label="Mês seguinte"
          >
            ›
          </button>
        </div>
        <button
          onClick={() => {
            setAno(agora.getFullYear());
            setMes(agora.getMonth() + 1);
          }}
          disabled={eMesCorrente}
          className="btn-secondary btn-sm disabled:opacity-40"
        >
          Este mês
        </button>
        <h2 className="text-base font-bold tracking-tight text-ink-900 first-letter:uppercase sm:text-lg">
          {tituloDoMes(ano, mes)}
        </h2>
      </div>

      {error && (
        <p className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
      )}

      {loading || !resumo ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="h-96 animate-pulse rounded-xl2 bg-ink-100" />
          <div className="h-96 animate-pulse rounded-xl2 bg-ink-100" />
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
          <div className="min-w-0 space-y-5">
            {/* ------------------------------------------- feito e previsto --- */}
            <div className="grid gap-4 sm:grid-cols-2">
              <Coluna
                titulo="Feito"
                nota={`${resumo.feito.quantidade} ${
                  resumo.feito.quantidade === 1 ? "atendimento concluído" : "atendimentos concluídos"
                }`}
                bruto={resumo.feito.bruto_cents}
                comissao={resumo.feito.comissao_cents}
                liquido={resumo.feito.liquido_cents}
                destaque
              />
              <Coluna
                titulo="Previsto"
                nota={`${resumo.previsto.quantidade} ${
                  resumo.previsto.quantidade === 1 ? "atendimento marcado" : "atendimentos marcados"
                }`}
                bruto={resumo.previsto.bruto_cents}
                comissao={resumo.previsto.comissao_cents}
                liquido={resumo.previsto.liquido_cents}
              />
            </div>

            <FinanceChart dias={resumo.dias} />

            {/* -------------------------------------------------- resultado --- */}
            <div className="card p-5">
              <h2 className="font-semibold text-ink-900">Resultado do mês</h2>

              <dl className="mt-4 space-y-2.5 text-sm">
                <Linha rotulo="Recebido (feito)" valor={resumo.feito.bruto_cents} />
                <Linha
                  rotulo={`Comissão devida sobre o feito (${resumo.commission_percent}%)`}
                  valor={-resumo.feito.comissao_cents}
                  esbatido={resumo.feito.comissao_cents === 0}
                />
                <Linha rotulo="Despesas do mês" valor={-resumo.despesas_cents} />

                <div className="flex items-baseline justify-between gap-3 border-t border-ink-100 pt-3">
                  <dt className="font-semibold text-ink-900">Sobra até agora</dt>
                  <dd
                    className={`text-xl font-bold ${
                      resumo.resultado_cents < 0 ? "text-rose-600" : "text-ink-900"
                    }`}
                  >
                    {formatMoney(resumo.resultado_cents)}
                  </dd>
                </div>

                <div className="flex items-baseline justify-between gap-3 rounded-xl bg-brand-50 px-3 py-2.5">
                  <dt className="text-brand-800">
                    Projetado
                    <span className="block text-xs text-brand-700/70">
                      se tudo o que está marcado acontecer
                    </span>
                  </dt>
                  <dd
                    className={`text-xl font-bold ${
                      resumo.resultado_projetado_cents < 0 ? "text-rose-600" : "text-brand-700"
                    }`}
                  >
                    {formatMoney(resumo.resultado_projetado_cents)}
                  </dd>
                </div>
              </dl>

              {resumo.perdido_quantidade > 0 && (
                <p className="mt-4 rounded-xl bg-ink-50 px-3 py-2.5 text-xs text-ink-500">
                  Ficaram por fazer {resumo.perdido_quantidade}{" "}
                  {resumo.perdido_quantidade === 1 ? "atendimento" : "atendimentos"} entre
                  cancelamentos e faltas, no valor de{" "}
                  <strong>{formatMoney(resumo.perdido_cents)}</strong>. Não entram em nenhuma
                  das contas acima.
                </p>
              )}
            </div>
          </div>

          {/* --------------------------------------------------------- lado --- */}
          <aside className="space-y-5">
            <form onSubmit={guardarComissao} className="card p-5">
              <h2 className="font-semibold text-ink-900">Comissão devida</h2>
              <p className="mt-1 text-xs leading-relaxed text-ink-500">
                Percentagem de cada atendimento que entrega a terceiros — o espaço onde
                atende, por exemplo. O prihora não cobra comissão nenhuma; deixe a zero se
                não deve nada a ninguém.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <input
                  id="comissao"
                  type="number"
                  min={0}
                  max={100}
                  step="0.5"
                  value={comissao}
                  onChange={(evento) => setComissao(evento.target.value)}
                  className="input w-28"
                  aria-label="Percentagem de comissão"
                />
                <span className="text-sm text-ink-500">%</span>
                <button type="submit" disabled={aGuardarComissao} className="btn-secondary btn-sm ml-auto">
                  {aGuardarComissao ? "A guardar..." : "Guardar"}
                </button>
              </div>
              {resumo.comissao_total_cents > 0 && (
                <p className="mt-3 border-t border-ink-100 pt-3 text-sm text-ink-600">
                  A pagar sobre o feito:{" "}
                  <strong className="text-ink-900">{formatMoney(resumo.feito.comissao_cents)}</strong>
                  <span className="block text-xs text-ink-400">
                    mais {formatMoney(resumo.previsto.comissao_cents)} se o previsto acontecer
                  </span>
                </p>
              )}
            </form>

            <div className="card p-5">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="font-semibold text-ink-900">Despesas</h2>
                <span className="text-sm font-bold text-ink-900">
                  {formatMoney(resumo.despesas_cents)}
                </span>
              </div>

              <form onSubmit={criarDespesa} className="mt-4 space-y-2.5">
                <input
                  id="despesa-descricao"
                  className="input"
                  placeholder="Descrição"
                  value={nova.description}
                  onChange={(evento) => setNova({ ...nova, description: evento.target.value })}
                />
                <div className="grid grid-cols-2 gap-2.5">
                  <input
                    id="despesa-valor"
                    className="input"
                    inputMode="decimal"
                    placeholder="0,00 €"
                    value={nova.amount}
                    onChange={(evento) => setNova({ ...nova, amount: evento.target.value })}
                  />
                  <input
                    id="despesa-data"
                    type="date"
                    className="input"
                    value={nova.incurred_on}
                    onChange={(evento) => setNova({ ...nova, incurred_on: evento.target.value })}
                  />
                </div>
                <select
                  id="despesa-categoria"
                  className="input"
                  value={nova.category}
                  onChange={(evento) => setNova({ ...nova, category: evento.target.value })}
                >
                  {Object.entries(resumo.categorias).map(([valor, rotulo]) => (
                    <option key={valor} value={valor}>
                      {rotulo}
                    </option>
                  ))}
                </select>
                <label className="flex items-start gap-2 text-xs text-ink-600">
                  <input
                    id="despesa-recorrente"
                    type="checkbox"
                    className="mt-0.5"
                    checked={nova.recurring}
                    onChange={(evento) => setNova({ ...nova, recurring: evento.target.checked })}
                  />
                  <span>
                    Repete-se todos os meses
                    <span className="block text-ink-400">
                      Regista uma vez e conta em todos os meses seguintes.
                    </span>
                  </span>
                </label>
                <button type="submit" disabled={aGuardarDespesa} className="btn-primary btn-sm w-full">
                  {aGuardarDespesa ? "A registar..." : "Registar despesa"}
                </button>
              </form>

              {despesas.length > 0 && (
                <ul className="mt-4 space-y-1.5 border-t border-ink-100 pt-3">
                  {despesas.map((despesa) => (
                    <li key={despesa.id} className="flex items-start gap-2 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-ink-800">
                          {despesa.description}
                          {despesa.recurring && (
                            <span className="ml-1.5 rounded bg-ink-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-500">
                              mensal
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-ink-400">
                          {resumo.categorias[despesa.category] ?? despesa.category}
                          {!despesa.recurring && ` · ${despesa.incurred_on.split("-").reverse().join("/")}`}
                        </p>
                      </div>
                      <span className="shrink-0 font-medium text-ink-700">
                        {formatMoney(despesa.amount_cents)}
                      </span>
                      <button
                        onClick={() => void apagarDespesa(despesa.id)}
                        className="shrink-0 rounded p-1 text-ink-300 transition hover:bg-rose-50 hover:text-rose-600"
                        aria-label={`Remover ${despesa.description}`}
                      >
                        <IconTrash className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        </div>
      )}
    </DashboardShell>
  );
}

function Coluna({
  titulo,
  nota,
  bruto,
  comissao,
  liquido,
  destaque = false,
}: {
  titulo: string;
  nota: string;
  bruto: number;
  comissao: number;
  liquido: number;
  destaque?: boolean;
}) {
  return (
    <div
      className={`rounded-xl2 p-5 shadow-card ${
        destaque ? "bg-ink-950 text-white" : "border border-ink-100 bg-white"
      }`}
    >
      <p
        className={`text-xs font-semibold uppercase tracking-wide ${
          destaque ? "text-brand-300" : "text-ink-400"
        }`}
      >
        {titulo}
      </p>
      <p className={`mt-2 text-3xl font-bold ${destaque ? "text-white" : "text-ink-900"}`}>
        {formatMoney(bruto)}
      </p>
      <p className={`mt-1 text-xs ${destaque ? "text-ink-400" : "text-ink-400"}`}>{nota}</p>

      {comissao > 0 && (
        <p
          className={`mt-3 border-t pt-3 text-xs ${
            destaque ? "border-white/10 text-ink-300" : "border-ink-100 text-ink-500"
          }`}
        >
          menos {formatMoney(comissao)} de comissão ={" "}
          <strong className={destaque ? "text-white" : "text-ink-800"}>
            {formatMoney(liquido)}
          </strong>
        </p>
      )}
    </div>
  );
}

function Linha({
  rotulo,
  valor,
  esbatido = false,
}: {
  rotulo: string;
  valor: number;
  esbatido?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={esbatido ? "text-ink-400" : "text-ink-500"}>{rotulo}</dt>
      <dd
        className={`font-medium ${
          esbatido ? "text-ink-400" : valor < 0 ? "text-rose-600" : "text-ink-800"
        }`}
      >
        {valor < 0 ? `− ${formatMoney(-valor)}` : formatMoney(valor)}
      </dd>
    </div>
  );
}
