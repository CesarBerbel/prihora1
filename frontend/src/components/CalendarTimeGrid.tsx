"use client";

/**
 * A grelha de horas — o coracao das vistas de dia e de semana.
 *
 * Desenha o tempo como altura: cada minuto vale sempre os mesmos pixeis, por
 * isso um atendimento de duas horas ocupa o dobro de um de uma. As contas de
 * posicao e de sobreposicao vivem em `lib/calendar`, testadas a parte; aqui
 * so ha desenho.
 */

import { useEffect, useMemo, useRef, useState } from "react";

import {
  type Colocado,
  colocarEventos,
  encaixarNaGrelha,
  faixaDeHoras,
  inicioDoDia,
  mesmoDia,
  minutosDoDia,
  somarDias,
} from "@/lib/calendar";
import { formatPriceShort, formatTime } from "@/lib/format";
import type { Availability, Booking, TimeOff } from "@/lib/types";

/** Altura de uma hora, em pixeis. Manda em todo o resto da grelha. */
const ALTURA_HORA = 56;
const PX_POR_MINUTO = ALTURA_HORA / 60;

/** Cor de cada situacao. Blocos cheios: leem-se de relance, ao contrario dos chips. */
const CORES: Record<string, string> = {
  pending: "border-amber-300 bg-amber-100 text-amber-900 hover:bg-amber-200",
  confirmed: "border-emerald-300 bg-emerald-100 text-emerald-900 hover:bg-emerald-200",
  completed: "border-sky-300 bg-sky-100 text-sky-900 hover:bg-sky-200",
  cancelled: "border-ink-200 bg-ink-100 text-ink-500 hover:bg-ink-200 line-through",
  no_show: "border-rose-300 bg-rose-100 text-rose-900 hover:bg-rose-200",
};

interface Props {
  dias: Date[];
  /** Intervalo entre horas marcáveis, em minutos. Vem do perfil. */
  intervaloMin: number;
  bookings: Booking[];
  availability: Availability[];
  timeOffs: TimeOff[];
  aberto: Booking | null;
  onAbrir: (booking: Booking) => void;
  /** Clique numa faixa livre: devolve o instante ja arredondado ao quarto de hora. */
  onNovaEm: (inicio: Date) => void;
}

/** As janelas de trabalho de um dia, em minutos desde a meia-noite. */
function janelasDoDia(availability: Availability[], dia: Date) {
  // Na tabela, 0 e segunda-feira; em getDay(), 0 e domingo.
  const weekday = (dia.getDay() + 6) % 7;
  return availability
    .filter((item) => item.weekday === weekday)
    .map((item) => ({
      inicioMin: Number(item.start_time.slice(0, 2)) * 60 + Number(item.start_time.slice(3, 5)),
      fimMin: Number(item.end_time.slice(0, 2)) * 60 + Number(item.end_time.slice(3, 5)),
    }))
    .sort((a, b) => a.inicioMin - b.inicioMin);
}

/** Os bloqueios que tocam um dia, ja recortados a ele. */
function bloqueiosDoDia(timeOffs: TimeOff[], dia: Date) {
  const abre = inicioDoDia(dia);
  const fecha = somarDias(abre, 1);
  return timeOffs
    .map((off) => ({ off, inicio: new Date(off.starts_at), fim: new Date(off.ends_at) }))
    .filter(({ inicio, fim }) => fim > abre && inicio < fecha)
    .map(({ off, inicio, fim }) => ({
      id: off.id,
      reason: off.reason,
      topo: Math.max(0, minutosDoDia(inicio, dia)),
      base: Math.min(1440, minutosDoDia(fim, dia)),
    }));
}

export default function CalendarTimeGrid({
  dias,
  intervaloMin,
  bookings,
  availability,
  timeOffs,
  aberto,
  onAbrir,
  onNovaEm,
}: Props) {
  const [agora, setAgora] = useState<Date | null>(null);
  const corpoRef = useRef<HTMLDivElement>(null);
  const jaRolou = useRef(false);

  // A linha do "agora" so existe no navegador: no servidor daria outra hora.
  useEffect(() => {
    setAgora(new Date());
    const timer = setInterval(() => setAgora(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const eventos = useMemo(
    () =>
      bookings.map((b) => ({
        id: b.id,
        inicio: new Date(b.starts_at),
        fim: new Date(b.ends_at),
        booking: b,
      })),
    [bookings],
  );

  const porDia = useMemo(
    () =>
      dias.map((dia) => ({
        dia,
        janelas: janelasDoDia(availability, dia),
        bloqueios: bloqueiosDoDia(timeOffs, dia),
        postos: colocarEventos(eventos, dia),
      })),
    [dias, availability, timeOffs, eventos],
  );

  // Uma faixa de horas so para todas as colunas: dias diferentes tem de ficar
  // alinhados, senao a semana deixa de se ler na horizontal.
  const { primeiraHora, ultimaHora } = useMemo(
    () =>
      faixaDeHoras(
        porDia.flatMap((d) => d.janelas),
        porDia.flatMap((d) => d.postos.map((p) => ({ topo: p.topo, altura: p.altura }))),
      ),
    [porDia],
  );

  const horas = useMemo(
    () => Array.from({ length: ultimaHora - primeiraHora }, (_, i) => primeiraHora + i),
    [primeiraHora, ultimaHora],
  );
  const alturaTotal = horas.length * ALTURA_HORA;

  /** Horas marcáveis dentro da faixa, sem repetir as horas inteiras. */
  const marcas = useMemo(() => {
    const passo = Math.max(5, intervaloMin || 30);
    if (passo >= 60) return [];
    const saida: number[] = [];
    for (let m = primeiraHora * 60; m < ultimaHora * 60; m += passo) {
      if (m % 60 !== 0) saida.push(m);
    }
    return saida;
  }, [intervaloMin, primeiraHora, ultimaHora]);
  const topoDe = (minutos: number) => (minutos - primeiraHora * 60) * PX_POR_MINUTO;

  // Ao abrir, poe a hora de trabalho a vista em vez do topo da madrugada.
  useEffect(() => {
    if (jaRolou.current || !corpoRef.current) return;
    const primeiraJanela = porDia.flatMap((d) => d.janelas).sort((a, b) => a.inicioMin - b.inicioMin)[0];
    if (!primeiraJanela) return;
    corpoRef.current.scrollTop = Math.max(0, topoDe(primeiraJanela.inicioMin) - ALTURA_HORA / 2);
    jaRolou.current = true;
  }, [porDia, topoDe]);

  /**
   * Onde o utilizador carregou, encaixado na grelha de horas do profissional.
   *
   * Se ele atende de meia em meia hora, só há meias horas para escolher; se
   * for de hora a hora, só horas certas. Deixar cair às 15h07 daria uma
   * marcação que a agenda pública nunca ofereceria a ninguém.
   */
  function instanteDoClique(evento: React.MouseEvent<HTMLDivElement>, dia: Date): Date {
    const caixa = evento.currentTarget.getBoundingClientRect();
    const minutos = primeiraHora * 60 + (evento.clientY - caixa.top) / PX_POR_MINUTO;
    const encaixado = encaixarNaGrelha(minutos, intervaloMin);
    const saida = inicioDoDia(dia);
    saida.setMinutes(encaixado);
    return saida;
  }

  const colunas = `56px repeat(${dias.length}, minmax(0, 1fr))`;
  const hoje = agora ?? new Date();

  return (
    <div className="overflow-hidden rounded-xl2 border border-ink-100 bg-white">
      {/* Cabecalho dos dias, fora da area que rola. */}
      <div className="grid border-b border-ink-100 bg-white" style={{ gridTemplateColumns: colunas }}>
        <div className="border-r border-ink-100" />
        {dias.map((dia) => {
          const eHoje = mesmoDia(dia, hoje);
          return (
            <div key={dia.toISOString()} className="border-r border-ink-100 px-2 py-2 text-center last:border-r-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                {new Intl.DateTimeFormat("pt-PT", { weekday: "short" }).format(dia)}
              </p>
              <p
                className={`mx-auto mt-0.5 grid h-8 w-8 place-items-center rounded-full text-sm font-bold ${
                  eHoje ? "bg-brand-600 text-white" : "text-ink-800"
                }`}
              >
                {dia.getDate()}
              </p>
            </div>
          );
        })}
      </div>

      <div ref={corpoRef} className="scroll-soft max-h-[70vh] overflow-y-auto">
        <div className="grid" style={{ gridTemplateColumns: colunas, height: alturaTotal }}>
          {/* Regua das horas. */}
          <div className="relative border-r border-ink-100">
            {horas.map((hora, indice) => (
              <div
                key={hora}
                className="absolute right-2 -translate-y-1/2 text-[11px] font-medium text-ink-400"
                style={{ top: indice * ALTURA_HORA }}
              >
                {indice === 0 ? "" : `${String(hora).padStart(2, "0")}:00`}
              </div>
            ))}
          </div>

          {porDia.map(({ dia, janelas, bloqueios, postos }) => {
            const eHoje = mesmoDia(dia, hoje);
            return (
              <div
                key={dia.toISOString()}
                className="relative border-r border-ink-100 last:border-r-0"
                onClick={(evento) => {
                  // So conta o clique no fundo: nos blocos manda o proprio bloco.
                  if (evento.target !== evento.currentTarget) return;
                  onNovaEm(instanteDoClique(evento, dia));
                }}
              >
                {/* Fora do horario de trabalho fica cinzento, como no Google. */}
                <div className="pointer-events-none absolute inset-0 bg-ink-100/70" />
                {janelas.map((janela, i) => (
                  <div
                    key={i}
                    className="pointer-events-none absolute inset-x-0 bg-white"
                    style={{
                      top: topoDe(janela.inicioMin),
                      height: (janela.fimMin - janela.inicioMin) * PX_POR_MINUTO,
                    }}
                  />
                ))}

                {/* Linhas de hora, por cima do fundo. */}
                {horas.map((hora, indice) => (
                  <div
                    key={hora}
                    className="pointer-events-none absolute inset-x-0 border-t border-ink-100"
                    style={{ top: indice * ALTURA_HORA }}
                  />
                ))}

                {/* E as horas marcáveis entre elas, a tracejado: assim vê-se
                    onde o clique vai encaixar antes de carregar. */}
                {marcas.map((minuto) => (
                  <div
                    key={minuto}
                    className="pointer-events-none absolute inset-x-0 border-t border-dashed border-ink-100/80"
                    style={{ top: topoDe(minuto) }}
                  />
                ))}

                {/* Folgas e bloqueios: riscado, para nao passar por horario livre. */}
                {bloqueios.map((bloqueio) => (
                  <div
                    key={bloqueio.id}
                    title={bloqueio.reason ?? "Bloqueado"}
                    className="pointer-events-none absolute inset-x-0 border-y border-ink-200 bg-ink-200/50"
                    style={{
                      top: topoDe(bloqueio.topo),
                      height: (bloqueio.base - bloqueio.topo) * PX_POR_MINUTO,
                      backgroundImage:
                        "repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(100,116,139,.18) 5px, rgba(100,116,139,.18) 10px)",
                    }}
                  >
                    <span className="px-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-500">
                      {bloqueio.reason || "Bloqueado"}
                    </span>
                  </div>
                ))}

                {postos.map((posto) => (
                  <BlocoDoAtendimento
                    key={posto.evento.id}
                    posto={posto}
                    topo={topoDe(posto.topo)}
                    ativo={aberto?.id === posto.evento.id}
                    onAbrir={onAbrir}
                  />
                ))}

                {/* A linha vermelha do agora, so na coluna de hoje. */}
                {agora && eHoje && (
                  <div
                    className="pointer-events-none absolute inset-x-0 z-20 border-t-2 border-rose-500"
                    style={{ top: topoDe(minutosDoDia(agora, dia)) }}
                  >
                    <span className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-rose-500" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function BlocoDoAtendimento({
  posto,
  topo,
  ativo,
  onAbrir,
}: {
  posto: Colocado<{ id: number; inicio: Date; fim: Date; booking: Booking }>;
  topo: number;
  ativo: boolean;
  onAbrir: (booking: Booking) => void;
}) {
  const booking = posto.evento.booking;
  const altura = posto.altura * PX_POR_MINUTO;
  const largura = 100 / posto.colunas;

  return (
    <button
      type="button"
      onClick={() => onAbrir(booking)}
      style={{
        top: topo,
        height: Math.max(altura - 2, 16),
        left: `calc(${posto.coluna * largura}% + 2px)`,
        width: `calc(${largura}% - 4px)`,
      }}
      className={`absolute z-10 overflow-hidden rounded-md border px-1.5 py-0.5 text-left text-[11px] leading-tight transition ${
        CORES[booking.status] ?? CORES.confirmed
      } ${ativo ? "ring-2 ring-ink-900 ring-offset-1" : ""}`}
    >
      <span className="block truncate font-semibold">
        {formatTime(booking.starts_at)} {booking.client_name}
      </span>
      {altura >= 40 && (
        <span className="block truncate opacity-80">{booking.service_name}</span>
      )}
      {altura >= 64 && (
        <span className="block truncate opacity-70">{formatPriceShort(booking.price_cents)}</span>
      )}
    </button>
  );
}
