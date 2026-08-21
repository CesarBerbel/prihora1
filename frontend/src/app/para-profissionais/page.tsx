import Link from "next/link";

import { IconCalendar, IconCheck, IconSparkles, IconStar } from "@/components/Icons";

export const metadata = {
  title: "Para profissionais",
  description:
    "Publique o seu perfil, receba marcações online e apareça para clientes da sua região.",
};

const VANTAGENS = [
  "Perfil público com portfólio, preços e avaliações",
  "Agenda online que bloqueia sozinha o horário ocupado",
  "Confirmação automática ou manual, como preferir",
  "Folgas e férias bloqueadas em dois cliques",
  "Pesquisa por proximidade que favorece quem está perto",
  "Painel com faturação, avaliações e visitas ao perfil",
];

const NUMEROS = [
  { value: "5 min", label: "para publicar o perfil" },
  { value: "0%", label: "de comissão por atendimento" },
  { value: "24/7", label: "agenda aberta para o cliente" },
  { value: "0 €", label: "para começar hoje" },
];

const AGENDA_EXEMPLO = [
  { hora: "09:00", label: "Livre" },
  { hora: "10:30", label: "Ana P. — Alongamento em gel" },
  { hora: "13:00", label: "Livre" },
  { hora: "14:30", label: "Marina T. — Manutenção" },
  { hora: "16:00", label: "Livre" },
];

export default function ParaProfissionaisPage() {
  return (
    <div className="bg-ink-50 pb-20">
      {/* ------------------------------------------------------------ hero --- */}
      <section className="bg-gradient-to-b from-brand-50 to-ink-50 py-16 sm:py-24">
        <div className="container-page text-center">
          <span className="chip mx-auto bg-white text-brand-700 ring-brand-200">
            <IconSparkles className="h-3.5 w-3.5" />
            Para profissionais da estética
          </span>
          <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
            Menos direct, mais agenda cheia
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-ink-500">
            O prihora põe o seu trabalho à frente de quem o está a procurar agora,
            com preço, horário livre e reserva na hora.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/para-profissionais/registo" className="btn-primary">
              Registar o meu trabalho
            </Link>
            <Link href="/para-profissionais/como-funciona" className="btn-secondary">
              Como funciona
            </Link>
          </div>
          <p className="mt-4 text-sm text-ink-400">
            Grátis para começar. Sem cartão e sem comissão por atendimento.
          </p>
        </div>
      </section>

      {/* -------------------------------------------- vantagens e a agenda --- */}
      <section className="container-page py-14">
        <div className="overflow-hidden rounded-xl2 bg-ink-950 p-8 shadow-lift sm:p-12">
          <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-white">
                Tudo o que precisa, num sítio só
              </h2>
              <ul className="mt-6 space-y-2.5">
                {VANTAGENS.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-ink-200">
                    <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-400" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/para-profissionais/registo" className="btn-primary mt-8">
                Criar o meu perfil grátis
              </Link>
            </div>

            <div className="rounded-xl2 bg-white/5 p-6 ring-1 ring-white/10">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-400">
                <IconCalendar className="h-4 w-4" />
                A sua agenda pública
              </div>
              <div className="mt-4 space-y-2">
                {AGENDA_EXEMPLO.map((slot) => {
                  const livre = slot.label === "Livre";
                  return (
                    <div
                      key={slot.hora}
                      className={`flex items-center justify-between gap-3 rounded-xl px-4 py-2.5 text-sm ${
                        livre
                          ? "bg-brand-500/15 text-brand-200 ring-1 ring-brand-400/30"
                          : "bg-white/5 text-ink-300"
                      }`}
                    >
                      <span className="font-semibold">{slot.hora}</span>
                      <span className="text-right text-xs">{slot.label}</span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 flex items-center gap-1.5 text-xs text-ink-400">
                <IconStar className="h-3.5 w-3.5 text-amber-400" />
                Atualiza sozinha a cada marcação
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- números --- */}
      <section className="container-page pb-14">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {NUMEROS.map((stat) => (
            <div key={stat.label} className="rounded-xl2 bg-white p-6 text-center shadow-card">
              <p className="text-3xl font-bold text-brand-600">{stat.value}</p>
              <p className="mt-1 text-sm text-ink-500">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------- chamada --- */}
      <section className="container-page">
        <div className="rounded-xl2 bg-white p-8 text-center shadow-card sm:p-12">
          <h2 className="text-2xl font-bold tracking-tight">
            Publique hoje e receba a primeira marcação esta semana
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-ink-500">
            Monte o perfil, defina os horários e o prihora trata do resto.
            Pode mudar de plano — ou sair — quando quiser.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/para-profissionais/registo" className="btn-primary">
              Registar o meu trabalho
            </Link>
            <Link href="/planos" className="btn-secondary">
              Ver planos
            </Link>
          </div>
          <p className="mt-6 text-sm text-ink-400">
            Já tem perfil?{" "}
            <Link href="/entrar" className="font-semibold text-brand-600 hover:text-brand-700">
              Entrar no painel
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
