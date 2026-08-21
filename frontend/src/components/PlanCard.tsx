"use client";

/**
 * O plano, onde ele interessa: ao lado do perfil que ele governa.
 *
 * Deixou de ter pagina propria — era uma pagina inteira para um cartao e uma
 * lista que se ve duas vezes por ano. Fica o cartao com o plano em vigor, e a
 * comparacao com os outros aparece so quando alguem a pede.
 */

import { useEffect, useState } from "react";

import { IconCheck, IconClose } from "@/components/Icons";
import { ApiError, api } from "@/lib/api";
import { formatDate, formatPrice } from "@/lib/format";
import type { Plan, SubscriptionStatus } from "@/lib/types";

interface Subscription {
  id: number;
  professional_id: number;
  status: SubscriptionStatus;
  current_period_start: string;
  current_period_end?: string | null;
  plan: Plan;
}

const ESTADO: Record<string, string> = {
  trialing: "Período de teste",
  active: "Ativa",
  past_due: "Pagamento pendente",
  cancelled: "Cancelada",
};

const ESTADO_ESTILO: Record<string, string> = {
  trialing: "bg-sky-50 text-sky-800 ring-sky-200",
  active: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  past_due: "bg-amber-50 text-amber-800 ring-amber-200",
  cancelled: "bg-ink-100 text-ink-600 ring-ink-200",
};

export function beneficios(plan: Plan): string[] {
  const lista = [
    plan.max_services >= 100 ? "Serviços ilimitados" : `Até ${plan.max_services} serviços`,
    plan.max_bookings_per_month >= 10000
      ? "Marcações ilimitadas"
      : `${plan.max_bookings_per_month} marcações por mês`,
    `Até ${plan.max_photos} fotos no portfólio`,
  ];
  if (plan.online_agenda) lista.push("Agenda pública online");
  if (plan.featured_listing) lista.push("Destaque nos resultados de pesquisa");
  if (plan.analytics) lista.push("Relatórios de desempenho");
  if (plan.priority_support) lista.push("Apoio prioritário");
  return lista;
}

function porPeriodo(plan: Plan): string {
  if (plan.price_cents === 0) return "";
  return `/${plan.billing_interval === "yearly" ? "ano" : "mês"}`;
}

export default function PlanCard() {
  const [subscricao, setSubscricao] = useState<Subscription | null>(null);
  const [planos, setPlanos] = useState<Plan[]>([]);
  const [aComparar, setAComparar] = useState(false);
  const [aMudar, setAMudar] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [feito, setFeito] = useState<string | null>(null);

  async function recarregar() {
    const [lista, atual] = await Promise.all([
      api.get<Plan[]>("/plans"),
      api.get<Subscription | null>("/me/subscription", { auth: true }),
    ]);
    setPlanos(lista);
    setSubscricao(atual);
  }

  useEffect(() => {
    recarregar().catch(() => setErro("Não foi possível carregar o plano."));
  }, []);

  // Com o comparador aberto, a página por trás não deve rolar.
  useEffect(() => {
    if (!aComparar) return;
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function escape(evento: KeyboardEvent) {
      if (evento.key === "Escape") setAComparar(false);
    }
    document.addEventListener("keydown", escape);
    return () => {
      document.body.style.overflow = anterior;
      document.removeEventListener("keydown", escape);
    };
  }, [aComparar]);

  async function mudar(plano: Plan) {
    if (subscricao?.plan.id === plano.id) return;
    setAMudar(plano.id);
    setErro(null);
    try {
      await api.post("/me/subscription", { plan_id: plano.id }, { auth: true });
      await recarregar();
      setFeito(`Plano alterado para ${plano.name}.`);
      setAComparar(false);
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Não foi possível trocar o plano.");
    } finally {
      setAMudar(null);
    }
  }

  return (
    <div id="plano" className="card scroll-mt-24 p-6">
      <h2 className="font-bold">O seu plano</h2>

      {erro && <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{erro}</p>}
      {feito && (
        <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{feito}</p>
      )}

      {!subscricao ? (
        <div className="mt-4 h-24 animate-pulse rounded-xl bg-ink-100" />
      ) : (
        <>
          <div className="mt-3 flex items-baseline justify-between gap-3">
            <p className="text-2xl font-bold text-brand-600">{subscricao.plan.name}</p>
            <span className={`chip ${ESTADO_ESTILO[subscricao.status] ?? ESTADO_ESTILO.active}`}>
              {ESTADO[subscricao.status] ?? subscricao.status}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-ink-500">
            {formatPrice(subscricao.plan.price_cents)}
            {porPeriodo(subscricao.plan)}
          </p>
          {subscricao.current_period_end && (
            <p className="mt-1 text-xs text-ink-400">
              Renova a {formatDate(subscricao.current_period_end)}
            </p>
          )}

          <ul className="mt-4 space-y-1.5 border-t border-ink-100 pt-4">
            {beneficios(subscricao.plan).map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-ink-600">
                <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                {item}
              </li>
            ))}
          </ul>

          <button onClick={() => setAComparar(true)} className="btn-secondary mt-4 w-full">
            Alterar plano
          </button>
        </>
      )}

      {aComparar && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-950/50 p-4 sm:p-8"
          onClick={(evento) => {
            if (evento.target === evento.currentTarget) setAComparar(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Escolher plano"
            className="my-auto w-full max-w-5xl rounded-xl2 bg-white p-6 shadow-lift sm:p-8"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold tracking-tight">Escolher plano</h3>
                <p className="mt-1 text-sm text-ink-500">
                  Sem fidelização: muda quando quiser e o efeito é imediato.
                </p>
              </div>
              <button
                onClick={() => setAComparar(false)}
                className="rounded-lg p-1.5 text-ink-400 transition hover:bg-ink-100 hover:text-ink-700"
                aria-label="Fechar"
              >
                <IconClose className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {planos.map((plano) => {
                const atual = subscricao?.plan.id === plano.id;
                return (
                  <div
                    key={plano.id}
                    className={`flex flex-col rounded-xl2 border p-5 ${
                      atual ? "border-brand-400 bg-brand-50/40 ring-2 ring-brand-200" : "border-ink-100"
                    }`}
                  >
                    <h4 className="font-bold">{plano.name}</h4>
                    {plano.description && (
                      <p className="mt-1 min-h-10 text-xs text-ink-500">{plano.description}</p>
                    )}

                    <p className="mt-3 text-2xl font-bold tracking-tight">
                      {plano.price_cents === 0 ? "Grátis" : formatPrice(plano.price_cents)}
                      {plano.price_cents > 0 && (
                        <span className="text-sm font-normal text-ink-400">
                          {porPeriodo(plano)}
                        </span>
                      )}
                    </p>
                    {plano.trial_days > 0 && (
                      <p className="mt-1 text-xs font-semibold text-brand-600">
                        {plano.trial_days} dias grátis para testar
                      </p>
                    )}

                    <ul className="mt-4 flex-1 space-y-2">
                      {beneficios(plano).map((item) => (
                        <li key={item} className="flex items-start gap-2 text-sm text-ink-600">
                          <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                          {item}
                        </li>
                      ))}
                    </ul>

                    <button
                      onClick={() => void mudar(plano)}
                      disabled={atual || aMudar !== null}
                      className={`mt-5 w-full ${atual ? "btn-secondary" : "btn-primary"}`}
                    >
                      {atual
                        ? "Plano atual"
                        : aMudar === plano.id
                          ? "A alterar..."
                          : "Mudar para este"}
                    </button>
                  </div>
                );
              })}
            </div>

            <p className="mt-6 text-center text-xs text-ink-400">
              A cobrança automática será ligada em breve. Por agora a troca de plano é imediata
              e sem custo.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
