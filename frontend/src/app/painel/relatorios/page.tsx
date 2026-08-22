"use client";

/**
 * Relatórios de desempenho — o que os planos Profissional e Estúdio vendem.
 *
 * Responde a quatro perguntas que a lista de marcações não responde: o que
 * rendeu mais, quem volta, quando é que a agenda enche, e quanto se perde em
 * cancelamentos e faltas.
 *
 * Só conta o que já terminou. O que ainda está marcado é previsão, e previsão
 * vive no financeiro — misturá-las daria um relatório que muda sozinho.
 */

import { useCallback, useEffect, useState } from "react";

import DashboardShell from "@/components/DashboardShell";
import StatCard from "@/components/StatCard";
import { PANEL_NAV } from "@/components/PanelNav";
import { ApiError, api } from "@/lib/api";
import { formatDate, formatMoney } from "@/lib/format";

interface Linha {
  nome: string;
  quantidade: number;
  bruto_cents: number;
}

interface Relatorio {
  de: string;
  ate: string;
  concluidos: number;
  cancelados: number;
  faltas: number;
  marcados: number;
  taxa_comparencia: number;
  receita_cents: number;
  ticket_medio_cents: number;
  novos_clientes: number;
  clientes_recorrentes: number;
  por_servico: Linha[];
  por_cliente: Linha[];
  por_dia_da_semana: Linha[];
  por_hora: Linha[];
}

/** Intervalos que se pedem de facto, em vez de um par de campos de data. */
const PERIODOS = [
  { dias: 30, label: "30 dias" },
  { dias: 90, label: "90 dias" },
  { dias: 365, label: "12 meses" },
];

function iso(data: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${data.getFullYear()}-${pad(data.getMonth() + 1)}-${pad(data.getDate())}`;
}

export default function RelatoriosPage() {
  const [dias, setDias] = useState(30);
  const [dados, setDados] = useState<Relatorio | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [semPlano, setSemPlano] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    setSemPlano(false);
    try {
      const ate = new Date();
      const de = new Date();
      de.setDate(de.getDate() - (dias - 1));
      setDados(
        await api.get<Relatorio>("/me/reports", {
          params: { de: iso(de), ate: iso(ate) },
          auth: true,
        }),
      );
    } catch (err) {
      // 403 aqui não é um erro: é o plano a dizer que isto não está incluído.
      if (err instanceof ApiError && err.status === 403) setSemPlano(true);
      else setErro(err instanceof ApiError ? err.message : "Não foi possível carregar.");
    } finally {
      setLoading(false);
    }
  }, [dias]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return (
    <DashboardShell
      title="Relatórios"
      subtitle="O que aconteceu, olhado por serviço, cliente e hora."
      nav={PANEL_NAV}
      allow={["professional"]}
    >
      {semPlano ? (
        <div className="rounded-xl2 bg-ink-950 p-8 text-center sm:p-12">
          <h2 className="text-2xl font-bold tracking-tight text-white">
            Relatórios de desempenho
          </h2>
          <p className="mx-auto mt-3 max-w-md text-ink-300">
            Fazem parte dos planos Profissional e Estúdio. Mostram o que rendeu mais, quem
            volta, quando a agenda enche e quanto se perde em faltas.
          </p>
          <a href="/painel/perfil#plano" className="btn-primary mt-8">
            Ver planos
          </a>
        </div>
      ) : (
        <>
          <div className="mb-5 flex items-center gap-1 rounded-full bg-ink-100 p-1 sm:w-fit">
            {PERIODOS.map((periodo) => (
              <button
                key={periodo.dias}
                onClick={() => setDias(periodo.dias)}
                className={`flex-1 rounded-full px-4 py-1.5 text-sm font-semibold transition sm:flex-none ${
                  dias === periodo.dias ? "bg-white text-ink-900 shadow-sm" : "text-ink-500"
                }`}
              >
                {periodo.label}
              </button>
            ))}
          </div>

          {erro && (
            <p className="mb-5 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{erro}</p>
          )}

          {loading || !dados ? (
            <div className="h-96 animate-pulse rounded-xl2 bg-ink-100" />
          ) : (
            <div className="space-y-5">
              <p className="text-sm text-ink-500">
                De {formatDate(dados.de)} a {formatDate(dados.ate)}.
              </p>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                  label="Atendimentos concluídos"
                  value={String(dados.concluidos)}
                  hint={`${dados.marcados} chegaram ao fim, de uma forma ou de outra`}
                />
                <StatCard
                  label="Receita"
                  value={formatMoney(dados.receita_cents)}
                  hint={`Ticket médio de ${formatMoney(dados.ticket_medio_cents)}`}
                  tone="success"
                />
                <StatCard
                  label="Comparência"
                  value={`${dados.taxa_comparencia}%`}
                  hint={`${dados.cancelados} cancelados · ${dados.faltas} faltas`}
                  tone={dados.taxa_comparencia < 80 ? "warning" : "default"}
                />
                <StatCard
                  label="Clientes"
                  value={String(dados.novos_clientes + dados.clientes_recorrentes)}
                  hint={`${dados.novos_clientes} novos · ${dados.clientes_recorrentes} que voltaram`}
                />
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <Ranking
                  titulo="Serviços que mais renderam"
                  vazio="Nenhum atendimento concluído no período."
                  linhas={dados.por_servico}
                />
                <Ranking
                  titulo="Clientes que mais gastaram"
                  vazio="Nenhum atendimento concluído no período."
                  linhas={dados.por_cliente}
                />
                <Ranking
                  titulo="Por dia da semana"
                  vazio="Sem dados no período."
                  linhas={dados.por_dia_da_semana}
                  ordem={DIAS}
                />
                <Ranking
                  titulo="Por hora do dia"
                  vazio="Sem dados no período."
                  linhas={[...dados.por_hora].sort((a, b) => a.nome.localeCompare(b.nome))}
                />
              </div>
            </div>
          )}
        </>
      )}
    </DashboardShell>
  );
}

const DIAS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

function Ranking({
  titulo,
  linhas,
  vazio,
  ordem,
}: {
  titulo: string;
  linhas: Linha[];
  vazio: string;
  ordem?: string[];
}) {
  const ordenadas = ordem
    ? [...linhas].sort((a, b) => ordem.indexOf(a.nome) - ordem.indexOf(b.nome))
    : linhas;
  // A barra é relativa ao melhor da lista: a comparação que interessa é
  // entre linhas, não com um máximo inventado.
  const topo = Math.max(1, ...ordenadas.map((l) => l.quantidade));

  return (
    <section className="card p-5">
      <h2 className="font-semibold text-ink-900">{titulo}</h2>

      {ordenadas.length === 0 ? (
        <p className="mt-6 pb-4 text-center text-sm text-ink-400">{vazio}</p>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {ordenadas.map((linha) => (
            <li key={linha.nome} className="flex items-center gap-3 text-sm">
              <span className="w-28 shrink-0 truncate text-ink-700" title={linha.nome}>
                {linha.nome}
              </span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-ink-100">
                <span
                  className="block h-full rounded-full bg-brand-500"
                  style={{ width: `${(linha.quantidade / topo) * 100}%` }}
                />
              </span>
              <span className="w-8 shrink-0 text-right text-xs text-ink-400">
                {linha.quantidade}
              </span>
              <span className="w-20 shrink-0 text-right font-medium text-ink-800">
                {formatMoney(linha.bruto_cents)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
