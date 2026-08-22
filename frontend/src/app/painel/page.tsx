"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import DashboardShell from "@/components/DashboardShell";
import StatCard from "@/components/StatCard";
import { IconCalendar, IconCheck, IconClock, IconStar } from "@/components/Icons";
import { PANEL_NAV } from "@/components/PanelNav";
import { api } from "@/lib/api";
import { computeProgress } from "@/lib/onboarding";
import {
  BOOKING_STATUS_LABEL,
  BOOKING_STATUS_STYLE,
  formatDateTime,
  formatPrice,
} from "@/lib/format";
import type { Booking, ProfessionalPrivate } from "@/lib/types";

interface Stats {
  upcoming_bookings: number;
  pending_bookings: number;
  completed_bookings: number;
  cancelled_bookings: number;
  revenue_30d_cents: number;
  rating_avg: number;
  rating_count: number;
  profile_views: number;
  status: string;
}

export default function PainelPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [profile, setProfile] = useState<ProfessionalPrivate | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<Stats>("/me/stats", { auth: true }),
      api.get<ProfessionalPrivate>("/me/professional", { auth: true }),
      api.get<Booking[]>("/me/bookings", { params: { upcoming: true, limit: 6 }, auth: true }),
    ])
      .then(([statsData, profileData, bookingsData]) => {
        setStats(statsData);
        setProfile(profileData);
        // A API devolve do mais recente para o mais antigo; aqui queremos o próximo primeiro.
        setBookings(
          [...bookingsData].sort(
            (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
          ),
        );
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const progresso = computeProgress(profile);

  // Quem ainda não deu um único passo não tem painel nenhum para ver: sem bio,
  // sem serviços e sem agenda, esta página é só cabeçalhos vazios. Levar ao
  // guia aqui, e não apenas no registo, cobre também quem chega por link
  // guardado, por sessão retomada ou com o separador aberto de antes.
  useEffect(() => {
    if (progresso.concluidos === 0 && profile && !progresso.bloqueado) {
      router.replace("/painel/comecar");
    }
  }, [progresso.concluidos, progresso.bloqueado, profile, router]);

  return (
    <DashboardShell
      title="Visao geral"
      subtitle={profile ? `Olá, ${profile.display_name}` : "A carregar seus dados..."}
      nav={PANEL_NAV}
      allow={["professional"]}
      actions={
        profile && (
          <Link href={`/p/${profile.slug}`} className="btn-secondary btn-sm">
            Ver meu perfil público
          </Link>
        )
      }
    >
      {/* Só a suspensão fica aqui: é o único estado que o guia de arranque não
          resolve, porque depende de quem administra e não de quem usa. */}
      {profile?.status === "suspended" && (
        <div className="mb-6 rounded-xl2 border border-rose-200 bg-rose-50 p-5">
          <h2 className="font-semibold text-ink-900">Perfil suspenso</h2>
          <p className="mt-1 text-sm text-ink-600">
            {profile.suspension_reason ||
              "O seu perfil está suspenso. Fale connosco para perceber o motivo."}
          </p>
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="h-28 animate-pulse rounded-xl2 bg-ink-100" />
          ))}
        </div>
      ) : (
        stats && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Próximos atendimentos"
              value={stats.upcoming_bookings}
              hint="Confirmados e a aguardar"
              tone="brand"
            />
            <StatCard
              label="A aguardar sua resposta"
              value={stats.pending_bookings}
              hint="Precisam de confirmação"
              tone={stats.pending_bookings > 0 ? "warning" : "default"}
            />
            <StatCard
              label="Faturação (30 dias)"
              value={formatPrice(stats.revenue_30d_cents)}
              hint="Somente atendimentos concluídos"
              tone="success"
            />
            <StatCard
              label="Avaliação média"
              value={`${stats.rating_avg.toFixed(1).replace(".", ",")} / 5`}
              // Sem o número de concluídos: aqui ele viria da contagem real de
              // marcações, e no perfil público vem do contador do perfil. São
              // duas fontes, e pô-las lado a lado convidava à comparação.
              hint={`${stats.rating_count} ${
                stats.rating_count === 1 ? "avaliação" : "avaliações"
              } · ${stats.profile_views} visitas`}
            />
          </div>
        )
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="card p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 font-bold">
              <IconCalendar className="h-5 w-5 text-brand-600" />
              Próximas marcações
            </h2>
            <Link href="/painel/agendamentos" className="text-sm font-semibold text-brand-600">
              Ver todos
            </Link>
          </div>

          {bookings.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-ink-200 px-4 py-10 text-center">
              <IconClock className="mx-auto h-8 w-8 text-ink-300" />
              <p className="mt-3 text-sm font-medium text-ink-700">
                Nenhum atendimento marcado ainda
              </p>
              <p className="mt-1 text-xs text-ink-500">
                Assim que alguém reservar um horário, ele aparece aqui.
              </p>
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-ink-100">
              {bookings.map((booking) => (
                <li key={booking.id} className="flex items-center justify-between gap-4 py-3.5">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink-900">{booking.client_name}</p>
                    <p className="mt-0.5 truncate text-sm text-ink-500">{booking.service_name}</p>
                    <p className="mt-0.5 text-xs text-ink-400">
                      {formatDateTime(booking.starts_at)}
                    </p>
                  </div>
                  <span className={`chip shrink-0 ${BOOKING_STATUS_STYLE[booking.status]}`}>
                    {BOOKING_STATUS_LABEL[booking.status]}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="space-y-4">
          {/* Some assim que os cinco passos estiverem feitos: um cartao que
              so diz "esta tudo certo" e ruido no painel de todos os dias. */}
          {!progresso.completo && profile && (
            <div className="card overflow-hidden">
              <div className="border-b border-ink-100 bg-brand-50/60 px-6 py-5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-bold text-ink-900">Configure o seu perfil</h2>
                  <span className="text-sm font-semibold text-brand-700">
                    {progresso.concluidos}/{progresso.total}
                  </span>
                </div>
                <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white">
                  <div
                    className="h-full rounded-full bg-brand-600 transition-all"
                    style={{ width: `${progresso.percentagem}%` }}
                  />
                </div>
              </div>

              <ul className="space-y-3 px-6 py-5 text-sm">
                {progresso.steps.map((step) => (
                  <li key={step.id} className="flex items-center gap-2.5">
                    <span
                      className={`grid h-5 w-5 shrink-0 place-items-center rounded-full ${
                        step.concluido ? "bg-emerald-600 text-white" : "bg-ink-200 text-ink-400"
                      }`}
                    >
                      <IconCheck className="h-3 w-3" />
                    </span>
                    {step.concluido ? (
                      <span className="text-ink-400 line-through">{step.titulo}</span>
                    ) : (
                      <Link
                        href="/painel/comecar"
                        className="font-medium text-ink-700 hover:text-brand-700"
                      >
                        {step.titulo}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>

              <div className="border-t border-ink-100 px-6 py-4">
                <Link href="/painel/comecar" className="btn-primary btn-sm w-full">
                  {progresso.concluidos === 0 ? "Comecar" : "Continuar"}
                </Link>
              </div>
            </div>
          )}

          {profile?.plan && (
            <div className="card p-6">
              <h2 className="font-bold">O seu plano</h2>
              <p className="mt-2 text-lg font-bold text-brand-600">{profile.plan.name}</p>
              <p className="mt-1 text-sm text-ink-500">
                {profile.plan.max_services >= 100
                  ? "Serviços ilimitados"
                  : `Até ${profile.plan.max_services} serviços`}
                {profile.plan.featured_listing ? " | Destaque na pesquisa" : ""}
              </p>
              <Link href="/painel/perfil#plano" className="btn-secondary btn-sm mt-4 w-full">
                Gerir plano
              </Link>
            </div>
          )}

          <div className="card p-6">
            <h2 className="flex items-center gap-2 font-bold">
              <IconStar className="h-4 w-4 text-amber-500" />
              Dica rápida
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-500">
              Perfis com bio preenchida, foto e ao menos tres serviços recebem bem mais
              marcações. Vale investir cinco minutos nisso.
            </p>
          </div>
        </aside>
      </div>
    </DashboardShell>
  );
}
