"use client";

/**
 * O mês dia a dia, em barras empilhadas: o que já foi feito por baixo, o que
 * está previsto por cima. Desenhado com divs — não vale a pena carregar uma
 * biblioteca de gráficos para um gráfico de barras.
 *
 * A altura é relativa ao melhor dia do mês, e não a um máximo fixo: assim uma
 * semana fraca continua a ler-se.
 */

import { formatPriceShort } from "@/lib/format";
import type { FinanceDay } from "@/lib/types";

const ALTURA = 132;

export default function FinanceChart({ dias }: { dias: FinanceDay[] }) {
  const topo = Math.max(
    1,
    ...dias.map((d) => d.feito_cents + d.previsto_cents),
  );
  const hoje = new Date();
  const temAlgo = dias.some((d) => d.feito_cents + d.previsto_cents > 0);

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold text-ink-900">Dia a dia</h2>
        <div className="flex items-center gap-3 text-xs text-ink-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-brand-600" /> Feito
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-brand-200" /> Previsto
          </span>
        </div>
      </div>

      {!temAlgo ? (
        <p className="mt-8 pb-6 text-center text-sm text-ink-400">
          Nenhum atendimento neste mês.
        </p>
      ) : (
        <div className="scroll-soft mt-5 overflow-x-auto pb-1">
          <div className="flex min-w-full items-end gap-[3px]" style={{ height: ALTURA }}>
            {dias.map((dia) => {
              const total = dia.feito_cents + dia.previsto_cents;
              const data = new Date(`${dia.dia}T00:00:00`);
              const eHoje =
                data.getFullYear() === hoje.getFullYear() &&
                data.getMonth() === hoje.getMonth() &&
                data.getDate() === hoje.getDate();

              return (
                <div
                  key={dia.dia}
                  title={`${data.getDate()}: ${formatPriceShort(dia.feito_cents)} feito${
                    dia.previsto_cents ? ` + ${formatPriceShort(dia.previsto_cents)} previsto` : ""
                  }`}
                  className="flex min-w-[10px] flex-1 flex-col justify-end"
                  style={{ height: ALTURA }}
                >
                  {dia.previsto_cents > 0 && (
                    <div
                      className="rounded-t-sm bg-brand-200"
                      style={{ height: Math.max(2, (dia.previsto_cents / topo) * ALTURA) }}
                    />
                  )}
                  {dia.feito_cents > 0 && (
                    <div
                      className={`bg-brand-600 ${dia.previsto_cents > 0 ? "" : "rounded-t-sm"}`}
                      style={{ height: Math.max(2, (dia.feito_cents / topo) * ALTURA) }}
                    />
                  )}
                  <div
                    className={`mt-0.5 h-0.5 rounded-full ${
                      eHoje ? "bg-rose-500" : total > 0 ? "bg-ink-200" : "bg-ink-100"
                    }`}
                  />
                </div>
              );
            })}
          </div>

          <div className="mt-1.5 flex justify-between text-[10px] text-ink-400">
            <span>1</span>
            <span>{Math.ceil(dias.length / 2)}</span>
            <span>{dias.length}</span>
          </div>
        </div>
      )}
    </div>
  );
}
