import Link from "next/link";

import ProfessionalCardItem from "@/components/ProfessionalCard";
import SearchBar from "@/components/SearchBar";
import { IconCalendar, IconCheck, IconSearch, IconSparkles } from "@/components/Icons";
import { api } from "@/lib/api";
import type { Category, ProfessionalCard } from "@/lib/types";

// Renderizada sob demanda para nunca servir uma home vazia logo após o deploy.
// O cache fica na camada de fetch (revalidate por endpoint), não na página.
export const dynamic = "force-dynamic";

async function loadHome() {
  try {
    const [categories, featured] = await Promise.all([
      api.get<Category[]>("/categories", { revalidate: 300 }),
      api.get<ProfessionalCard[]>("/professionals/featured", {
        params: { limit: 6 },
        revalidate: 60,
      }),
    ]);
    return { categories, featured, offline: false };
  } catch {
    // A home não pode quebrar se a API estiver reiniciando.
    return { categories: [] as Category[], featured: [] as ProfessionalCard[], offline: true };
  }
}

const STEPS = [
  {
    icon: IconSearch,
    title: "Procure perto de si",
    text: "Diga o serviço que precisa e a sua zona. Mostramos quem atende ali, ordenado por distância.",
  },
  {
    icon: IconCalendar,
    title: "Escolha o horário",
    text: "A agenda de cada profissional é pública e está sempre certa. Sem trocar mensagens para saber se há vaga.",
  },
  {
    icon: IconCheck,
    title: "Confirme em segundos",
    text: "Reserva na hora e recebe um código de acompanhamento. Não precisa sequer de criar conta.",
  },
];

export default async function HomePage() {
  const { categories, featured, offline } = await loadHome();

  return (
    <>
      {/* ------------------------------------------------------------ hero --- */}
      <section className="relative overflow-hidden bg-gradient-to-b from-brand-50 via-white to-white">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-brand-200/40 blur-3xl"
        />
        <div className="container-page relative py-16 sm:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <span className="chip mx-auto bg-white text-brand-700 ring-brand-200">
              <IconSparkles className="h-3.5 w-3.5" />
              Profissionais liberais da área da estética
            </span>

            <h1 className="mt-5 text-4xl font-bold tracking-tight text-ink-950 sm:text-5xl">
              Encontre e marque com quem cuida de si,{" "}
              <span className="text-brand-600">já aqui ao lado</span>
            </h1>

            <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-ink-500">
              Manicure, pedicure, podologia, tatuagem, sobrancelhas, estética e muito mais.
              Veja preços, avaliações e horários livres em tempo real.
            </p>

            <div className="mx-auto mt-8 max-w-3xl">
              <SearchBar size="hero" />
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-sm text-ink-500">
              <span>Pesquisas populares:</span>
              {["manicure", "tatuagem", "podologia", "sobrancelhas"].map((term) => (
                <Link
                  key={term}
                  href={`/buscar?q=${term}`}
                  className="rounded-full bg-white px-3 py-1 text-ink-700 ring-1 ring-ink-200 transition hover:ring-brand-300"
                >
                  {term}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {offline && (
        <div className="container-page">
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Estamos a reconectar com o servidor. Recarregue a página dentro de instantes.
          </p>
        </div>
      )}

      {/* ------------------------------------------------------ categorias --- */}
      {categories.length > 0 && (
        <section className="container-page py-14">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Explore por especialidade</h2>
              <p className="mt-1 text-ink-500">
                Escolha o cuidado que procura e veja quem atende na sua região.
              </p>
            </div>
            <Link href="/buscar" className="hidden shrink-0 text-sm font-semibold text-brand-600 hover:text-brand-700 sm:block">
              Ver todos
            </Link>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {categories.slice(0, 10).map((category) => (
              <Link
                key={category.id}
                href={`/buscar?category=${category.slug}`}
                className="group rounded-xl2 border border-ink-100 bg-white p-4 shadow-card transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-lift"
              >
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-600 transition group-hover:bg-brand-100">
                  <IconSparkles className="h-5 w-5" />
                </span>
                <h3 className="mt-3 font-semibold text-ink-900">{category.name}</h3>
                <p className="mt-0.5 text-xs text-ink-400">
                  {category.professional_count === 1
                    ? "1 profissional"
                    : `${category.professional_count ?? 0} profissionais`}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* --------------------------------------------------------- destaques --- */}
      {featured.length > 0 && (
        <section className="bg-white py-14">
          <div className="container-page">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold tracking-tight">Profissionais em destaque</h2>
                <p className="mt-1 text-ink-500">
                  Perfis bem avaliados e com agenda aberta agora.
                </p>
              </div>
              <Link href="/buscar" className="hidden shrink-0 text-sm font-semibold text-brand-600 hover:text-brand-700 sm:block">
                Ver todos
              </Link>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {featured.map((pro) => (
                <ProfessionalCardItem key={pro.id} pro={pro} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ----------------------------------------------------- como funciona --- */}
      <section className="container-page py-14">
        <h2 className="text-center text-2xl font-bold tracking-tight">
          Marcar leva menos de um minuto
        </h2>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <div key={step.title} className="relative rounded-xl2 bg-white p-6 shadow-card">
              <span className="absolute -top-3 left-6 grid h-7 w-7 place-items-center rounded-full bg-brand-600 text-xs font-bold text-white">
                {index + 1}
              </span>
              <step.icon className="h-6 w-6 text-brand-600" />
              <h3 className="mt-3 font-semibold text-ink-900">{step.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-500">{step.text}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 text-center">
          <Link href="/como-funciona" className="btn-secondary">
            Ver como funciona ao pormenor
          </Link>
        </div>
      </section>

      {/* ---------------------------------------------- porta para o outro lado --- */}
      {/* A home e do cliente. Aos profissionais chega uma faixa discreta que os
          leva para o lado deles, onde ha uma pagina inteira a explicar tudo. */}
      <section className="container-page pb-16">
        <div className="flex flex-col items-center justify-between gap-4 rounded-xl2 border border-ink-100 bg-white px-6 py-5 shadow-card sm:flex-row sm:px-8">
          <div className="flex items-center gap-3 text-center sm:text-left">
            <span className="hidden h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600 sm:grid">
              <IconSparkles className="h-5 w-5" />
            </span>
            <div>
              <p className="font-semibold text-ink-900">É profissional de estética?</p>
              <p className="text-sm text-ink-500">
                Publique o seu trabalho, abra a agenda e apareça para quem procura na sua zona.
              </p>
            </div>
          </div>
          <Link href="/para-profissionais" className="btn-secondary shrink-0">
            Ver o lado profissional
          </Link>
        </div>
      </section>

    </>
  );
}
