import Link from "next/link";

import { IconCheck, IconSparkles } from "@/components/Icons";
import { api } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import type { Plan } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Planos e preços",
  description:
    "Escolha o plano do prihora que cabe no seu momento. Comece de graça e evolua quando quiser.",
};

function features(plan: Plan): string[] {
  const list = [
    plan.max_services >= 100
      ? "Serviços ilimitados"
      : `Até ${plan.max_services} serviços registados`,
    plan.max_bookings_per_month >= 10000
      ? "Marcações ilimitadas"
      : `Até ${plan.max_bookings_per_month} marcações por mês`,
    `Até ${plan.max_photos} fotos no portfolio`,
  ];
  if (plan.online_agenda) list.push("Agenda pública online");
  if (plan.featured_listing) list.push("Destaque nos resultados de pesquisa");
  if (plan.analytics) list.push("Relatórios de desempenho");
  if (plan.priority_support) list.push("Apoio prioritário");
  return list;
}

export default async function PlanosPage() {
  let plans: Plan[] = [];
  try {
    plans = await api.get<Plan[]>("/plans", { revalidate: 300 });
  } catch {
    plans = [];
  }

  return (
    <div className="bg-ink-50 pb-20">
      <section className="bg-gradient-to-b from-brand-50 to-ink-50 py-16">
        <div className="container-page text-center">
          <span className="chip mx-auto bg-white text-brand-700 ring-brand-200">
            <IconSparkles className="h-3.5 w-3.5" />
            Planos para profissionais
          </span>
          <h1 className="mt-5 text-4xl font-bold tracking-tight">
            Comece de graça. Cresça quando fizer sentido.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-ink-500">
            Sem fidelização e sem taxa por marcação. Paga o plano e fica com 100% do
            valor dos seus atendimentos.
          </p>
        </div>
      </section>

      <div className="container-page -mt-6">
        {plans.length === 0 ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-800">
            Não foi possível carregar os planos agora. Recarregue a página dentro de instantes.
          </p>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {plans.map((plan) => {
              const highlight = plan.featured_listing && !plan.priority_support;
              return (
                <div
                  key={plan.id}
                  className={`relative flex flex-col rounded-xl2 border bg-white p-6 shadow-card ${
                    highlight ? "border-brand-400 ring-2 ring-brand-200" : "border-ink-100"
                  }`}
                >
                  {highlight && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-600 px-3 py-1 text-xs font-bold text-white">
                      Mais escolhido
                    </span>
                  )}

                  <h2 className="text-lg font-bold">{plan.name}</h2>
                  {plan.description && (
                    <p className="mt-1.5 min-h-10 text-sm text-ink-500">{plan.description}</p>
                  )}

                  <p className="mt-5">
                    <span className="text-3xl font-bold tracking-tight">
                      {plan.price_cents === 0 ? "Grátis" : formatPrice(plan.price_cents)}
                    </span>
                    {plan.price_cents > 0 && (
                      <span className="text-sm text-ink-400">
                        /{plan.billing_interval === "yearly" ? "ano" : "mês"}
                      </span>
                    )}
                  </p>

                  {plan.trial_days > 0 && (
                    <p className="mt-1 text-xs font-semibold text-brand-600">
                      {plan.trial_days} dias grátis para testar
                    </p>
                  )}

                  <ul className="mt-6 flex-1 space-y-2.5">
                    {features(plan).map((item) => (
                      <li key={item} className="flex items-start gap-2 text-sm text-ink-600">
                        <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                        {item}
                      </li>
                    ))}
                  </ul>

                  <Link
                    href={`/para-profissionais/registo?plano=${plan.slug}`}
                    className={`mt-6 w-full ${highlight ? "btn-primary" : "btn-secondary"}`}
                  >
                    {plan.price_cents === 0 ? "Começar grátis" : "Subscrever"}
                  </Link>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {[
            {
              title: "Posso trocar de plano depois?",
              text: "Pode, quando quiser, pelo próprio painel. A mudança vale na hora.",
            },
            {
              title: "Cobram por marcação?",
              text: "Não. O valor do atendimento é combinado diretamente entre si e o cliente.",
            },
            {
              title: "E se eu quiser cancelar?",
              text: "Sem fidelização. Cancela pelo painel e o seu perfil volta ao plano gratuito.",
            },
          ].map((faq) => (
            <div key={faq.title} className="rounded-xl2 bg-white p-6 shadow-card">
              <h3 className="font-semibold text-ink-900">{faq.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-500">{faq.text}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 rounded-xl2 bg-ink-950 p-8 text-center sm:p-10">
          <h2 className="text-2xl font-bold tracking-tight text-white">
            Ainda a decidir qual serve?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-ink-300">
            Comece pelo plano gratuito. Publica o perfil, recebe marcações e muda
            de plano no dia em que fizer falta.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/para-profissionais/registo" className="btn-primary">
              Registar o meu trabalho
            </Link>
            <Link
              href="/para-profissionais/como-funciona"
              className="btn border border-white/20 text-white hover:bg-white/10"
            >
              Como funciona
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
