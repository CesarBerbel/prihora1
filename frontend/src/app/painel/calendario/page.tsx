"use client";

/**
 * O calendario do profissional.
 *
 * A lista de marcacoes responde a "o que tenho para fazer a seguir"; esta
 * pagina responde a outra pergunta: "como esta o meu dia". Por isso desenha o
 * tempo — horario de trabalho, folgas e atendimentos no sitio exacto onde
 * caem — em vez de os alinhar por ordem.
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import CalendarMonth from "@/components/CalendarMonth";
import CalendarTimeGrid from "@/components/CalendarTimeGrid";
import DashboardShell from "@/components/DashboardShell";
import InternalBookingForm from "@/components/InternalBookingForm";
import Modal from "@/components/Modal";
import StatusChangeDialog from "@/components/StatusChangeDialog";
import { IconClose, IconWhatsapp } from "@/components/Icons";
import { PANEL_NAV } from "@/components/PanelNav";
import { ApiError, api } from "@/lib/api";
import {
  type Vista,
  avancar,
  diasDaVista,
  inicioDoDia,
  janelaDaVista,
  tituloDaVista,
} from "@/lib/calendar";
import {
  BOOKING_STATUS_LABEL,
  BOOKING_STATUS_STYLE,
  formatDateTime,
  formatPhone,
  formatPrice,
  formatTime,
  whatsappLink,
} from "@/lib/format";
import type {
  Availability,
  Booking,
  BookingStatus,
  ProfessionalPrivate,
  TimeOff,
} from "@/lib/types";

const VISTAS: { valor: Vista; label: string }[] = [
  { valor: "dia", label: "Dia" },
  { valor: "semana", label: "Semana" },
  { valor: "mes", label: "Mês" },
];

/** As mesmas passagens de estado da lista de marcações. */
const TRANSICOES: Record<string, { status: BookingStatus; label: string; style: string }[]> = {
  pending: [
    { status: "confirmed", label: "Confirmar", style: "btn-primary" },
    { status: "cancelled", label: "Recusar", style: "btn-ghost text-rose-600 hover:bg-rose-50" },
  ],
  confirmed: [
    { status: "completed", label: "Concluir", style: "btn-primary" },
    { status: "no_show", label: "Não compareceu", style: "btn-secondary" },
    { status: "cancelled", label: "Cancelar", style: "btn-ghost text-rose-600 hover:bg-rose-50" },
  ],
  completed: [],
  cancelled: [],
  no_show: [],
};

const LEGENDA: { status: string; cor: string }[] = [
  { status: "pending", cor: "bg-amber-300" },
  { status: "confirmed", cor: "bg-emerald-400" },
  { status: "completed", cor: "bg-sky-400" },
  { status: "no_show", cor: "bg-rose-400" },
  { status: "cancelled", cor: "bg-ink-300" },
];

export default function CalendarioPage() {
  const [vista, setVista] = useState<Vista>("semana");
  const [ancora, setAncora] = useState<Date>(() => inicioDoDia(new Date()));

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [timeOffs, setTimeOffs] = useState<TimeOff[]>([]);
  // Intervalo entre horas marcáveis, tal como está no perfil: é ele que
  // decide onde um clique na grelha pode cair.
  const [intervaloMin, setIntervaloMin] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [aberto, setAberto] = useState<Booking | null>(null);
  const [aMudar, setAMudar] = useState<{ booking: Booking; estado: BookingStatus } | null>(null);
  const [novaEm, setNovaEm] = useState<Date | null>(null);
  const [criando, setCriando] = useState(false);
  // Instante em que se carregou, à espera de confirmação.
  const [aPerguntar, setAPerguntar] = useState<Date | null>(null);

  const dias = useMemo(() => diasDaVista(vista, ancora), [vista, ancora]);
  const janela = useMemo(() => janelaDaVista(vista, ancora), [vista, ancora]);

  // Só o que está à vista. Uma agenda de anos não cabe — nem faz falta.
  const chaveDaJanela = `${janela.de.getTime()}-${janela.ate.getTime()}`;

  const carregar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [marcacoes, horarios, folgas, perfil] = await Promise.all([
        api.get<Booking[]>("/me/bookings", {
          params: { from: janela.de.toISOString(), to: janela.ate.toISOString(), limit: 500 },
          auth: true,
        }),
        api.get<Availability[]>("/me/availability", { auth: true }),
        api.get<TimeOff[]>("/me/time-off", { auth: true }),
        api.get<ProfessionalPrivate>("/me/professional", { auth: true }),
      ]);
      setBookings(marcacoes);
      setAvailability(horarios);
      setTimeOffs(folgas);
      setIntervaloMin(perfil.slot_interval_min || 30);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível carregar o calendário.");
    } finally {
      setLoading(false);
    }
    // A janela é o que manda: mudar de vista ou de semana recarrega.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveDaJanela]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  // Manter aberta a marcação certa depois de uma recarga.
  useEffect(() => {
    if (!aberto) return;
    const atual = bookings.find((b) => b.id === aberto.id);
    setAberto(atual ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookings]);

  const eHojeAVista = useMemo(() => {
    const agora = new Date();
    return dias.some(
      (dia) =>
        dia.getFullYear() === agora.getFullYear() &&
        dia.getMonth() === agora.getMonth() &&
        dia.getDate() === agora.getDate(),
    );
  }, [dias]);

  function fecharNova() {
    setCriando(false);
    setNovaEm(null);
  }

  function abrirNova(inicio: Date | null) {
    setAberto(null);
    setAPerguntar(null);
    setNovaEm(inicio);
    setCriando(true);
  }

  return (
    <DashboardShell
      title="Calendário"
      subtitle="Os seus atendimentos no tempo, com o horário de trabalho e as folgas."
      nav={PANEL_NAV}
      allow={["professional"]}
      actions={
        <button onClick={() => abrirNova(null)} className="btn-primary btn-sm">
          Nova marcação
        </button>
      }
    >
      {aMudar && (
        <StatusChangeDialog
          booking={aMudar.booking}
          novoEstado={aMudar.estado}
          onConcluir={() => {
            setAMudar(null);
            void carregar();
          }}
          onCancelar={() => setAMudar(null)}
        />
      )}

      {aPerguntar && (
        <ConfirmarNova
          inicio={aPerguntar}
          onSim={() => abrirNova(aPerguntar)}
          onNao={() => setAPerguntar(null)}
        />
      )}

      {criando && (
        <Modal
          title="Nova marcação"
          subtitle="Entra na agenda mesmo fora do horário publicado — só não pode sobrepor outro atendimento."
          size="xl"
          onClose={fecharNova}
        >
          <InternalBookingForm
            inicio={novaEm}
            onCreated={() => {
              fecharNova();
              void carregar();
            }}
            onCancel={fecharNova}
          />
        </Modal>
      )}

      {/* ------------------------------------------------------ navegação --- */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-full border border-ink-200 bg-white">
            <button
              onClick={() => setAncora((atual) => avancar(vista, atual, -1))}
              className="rounded-l-full px-3 py-1.5 text-ink-600 transition hover:bg-ink-100"
              aria-label="Anterior"
            >
              ‹
            </button>
            <button
              onClick={() => setAncora((atual) => avancar(vista, atual, 1))}
              className="rounded-r-full border-l border-ink-200 px-3 py-1.5 text-ink-600 transition hover:bg-ink-100"
              aria-label="Seguinte"
            >
              ›
            </button>
          </div>

          <button
            onClick={() => setAncora(inicioDoDia(new Date()))}
            disabled={eHojeAVista}
            className="btn-secondary btn-sm disabled:opacity-40"
          >
            Hoje
          </button>

          <h2 className="ml-1 text-base font-bold tracking-tight text-ink-900 first-letter:uppercase sm:text-lg">
            {tituloDaVista(vista, ancora)}
          </h2>
        </div>

        <div className="flex items-center rounded-full bg-ink-100 p-1">
          {VISTAS.map((item) => (
            <button
              key={item.valor}
              onClick={() => setVista(item.valor)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
                vista === item.valor ? "bg-white text-ink-900 shadow-sm" : "text-ink-500"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="min-w-0">
          {loading ? (
            <div className="h-[60vh] animate-pulse rounded-xl2 bg-ink-100" />
          ) : vista === "mes" ? (
            <CalendarMonth
              dias={dias}
              mesVisivel={ancora.getMonth()}
              bookings={bookings}
              aberto={aberto}
              onAbrir={setAberto}
              onVerDia={(dia) => {
                setAncora(dia);
                setVista("dia");
              }}
            />
          ) : (
            <CalendarTimeGrid
              dias={dias}
              intervaloMin={intervaloMin}
              bookings={bookings}
              availability={availability}
              timeOffs={timeOffs}
              aberto={aberto}
              onAbrir={setAberto}
              onNovaEm={setAPerguntar}
            />
          )}

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-500">
            {LEGENDA.map((item) => (
              <span key={item.status} className="inline-flex items-center gap-1.5">
                <span className={`h-2.5 w-2.5 rounded-full ${item.cor}`} />
                {BOOKING_STATUS_LABEL[item.status]}
              </span>
            ))}
            {vista !== "mes" && (
              <span className="text-ink-400">
                Carregue numa faixa livre para marcar. As horas encaixam de{" "}
                {intervaloMin} em {intervaloMin} minutos, como no seu perfil.
              </span>
            )}
          </div>
        </div>

        {/* ------------------------------------------------- painel lateral --- */}
        <aside className="lg:sticky lg:top-24">
          {aberto ? (
            <DetalheDaMarcacao
              booking={aberto}
              onFechar={() => setAberto(null)}
              onMudar={(estado) => setAMudar({ booking: aberto, estado })}
            />
          ) : (
            <ResumoDaVista bookings={bookings} vista={vista} />
          )}
        </aside>
      </div>
    </DashboardShell>
  );
}

function DetalheDaMarcacao({
  booking,
  onFechar,
  onMudar,
}: {
  booking: Booking;
  onFechar: () => void;
  onMudar: (estado: BookingStatus) => void;
}) {
  const acoes = TRANSICOES[booking.status] ?? [];
  const whatsapp = whatsappLink(booking.client_phone);

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-semibold text-ink-900">{booking.client_name}</h3>
          <span className={`chip mt-1.5 ${BOOKING_STATUS_STYLE[booking.status]}`}>
            {BOOKING_STATUS_LABEL[booking.status]}
          </span>
        </div>
        <button
          onClick={onFechar}
          className="shrink-0 rounded-full p-1 text-ink-400 transition hover:bg-ink-100 hover:text-ink-700"
          aria-label="Fechar"
        >
          <IconClose className="h-4 w-4" />
        </button>
      </div>

      <dl className="mt-4 space-y-2 text-sm">
        <div>
          <dt className="text-xs text-ink-400">Quando</dt>
          <dd className="font-medium text-ink-800">
            {formatDateTime(booking.starts_at)} às {formatTime(booking.ends_at)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-ink-400">Serviço</dt>
          <dd className="text-ink-700">
            {booking.service_name} ·{" "}
            {booking.package_sale_id ? "pago no pacote" : formatPrice(booking.price_cents)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-ink-400">Contacto</dt>
          <dd className="text-ink-700">{formatPhone(booking.client_phone)}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-400">Código</dt>
          <dd className="font-mono text-xs text-ink-600">{booking.code}</dd>
        </div>
      </dl>

      {booking.at_home && booking.address_line && (
        <p className="mt-3 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-800">
          Ao domicílio: {booking.address_line}
        </p>
      )}
      {booking.notes && (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {booking.notes}
        </p>
      )}
      {booking.cancel_reason && (
        <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
          Motivo: {booking.cancel_reason}
        </p>
      )}

      <div className="mt-4 flex flex-col gap-2">
        {whatsapp && (
          <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="btn-secondary btn-sm">
            <IconWhatsapp className="h-4 w-4 text-emerald-600" />
            WhatsApp
          </a>
        )}
        {acoes.map((acao) => (
          <button
            key={acao.status}
            onClick={() => onMudar(acao.status)}
            className={`${acao.style} btn-sm`}
          >
            {acao.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ResumoDaVista({ bookings, vista }: { bookings: Booking[]; vista: Vista }) {
  const contas = useMemo(() => {
    const ativas = bookings.filter((b) => b.status !== "cancelled");
    const receita = bookings
      .filter((b) => b.status === "completed" || b.status === "confirmed")
      .reduce((soma, b) => soma + (b.price_cents ?? 0), 0);
    return {
      total: ativas.length,
      aguardar: bookings.filter((b) => b.status === "pending").length,
      receita,
      minutos: ativas.reduce(
        (soma, b) => soma + (new Date(b.ends_at).getTime() - new Date(b.starts_at).getTime()) / 60000,
        0,
      ),
    };
  }, [bookings]);

  const periodo = vista === "dia" ? "no dia" : vista === "semana" ? "na semana" : "no mês";
  const horas = Math.round(contas.minutos / 6) / 10;

  return (
    <div className="card p-5">
      <h3 className="font-semibold text-ink-900">Resumo {periodo}</h3>
      <dl className="mt-4 space-y-3 text-sm">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-ink-500">Atendimentos</dt>
          <dd className="text-lg font-bold text-ink-900">{contas.total}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-ink-500">A aguardar</dt>
          <dd className={`font-semibold ${contas.aguardar ? "text-amber-700" : "text-ink-400"}`}>
            {contas.aguardar}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-ink-500">Tempo ocupado</dt>
          <dd className="font-semibold text-ink-700">{horas}h</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-ink-500">Previsto</dt>
          <dd className="font-semibold text-ink-700">{formatPrice(contas.receita)}</dd>
        </div>
      </dl>
      <p className="mt-4 border-t border-ink-100 pt-3 text-xs text-ink-400">
        Carregue num atendimento para ver os detalhes e mudar o estado.
      </p>
    </div>
  );
}

/**
 * Pergunta antes de abrir o formulário.
 *
 * Numa grelha de horas o rato acerta numa faixa livre com facilidade — ao
 * arrastar a página, ao fechar o painel lateral — e um formulário a saltar
 * sozinho para o ecrã é mais susto que ajuda. A pergunta mostra a hora exacta
 * que o clique escolheu, que é também a forma de reparar num engano de meia
 * hora antes de escrever o resto.
 */
function ConfirmarNova({
  inicio,
  onSim,
  onNao,
}: {
  inicio: Date;
  onSim: () => void;
  onNao: () => void;
}) {
  const quando = new Intl.DateTimeFormat("pt-PT", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(inicio);
  const hora = new Intl.DateTimeFormat("pt-PT", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(inicio);

  return (
    <Modal title="Marcar nesta hora?" size="sm" onClose={onNao}>
      <p className="text-sm leading-relaxed text-ink-600">
        <span className="font-semibold text-ink-900">{hora}</span> de{" "}
        <span className="first-letter:uppercase">{quando}</span>.
      </p>
      <p className="mt-1 text-xs text-ink-400">Pode mudar a hora no formulário a seguir.</p>

      <div className="mt-6 flex gap-2">
        <button onClick={onSim} className="btn-primary flex-1">
          Sim, marcar
        </button>
        <button onClick={onNao} className="btn-ghost">
          Cancelar
        </button>
      </div>
    </Modal>
  );
}
