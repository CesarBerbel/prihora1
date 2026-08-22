import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import BookingWidget from "@/components/BookingWidget";
import {
  IconCheck,
  IconClock,
  IconHome,
  IconInstagram,
  IconPin,
  IconSparkles,
  IconStar,
  IconVerified,
  IconWhatsapp,
} from "@/components/Icons";
import { ApiError, api } from "@/lib/api";
import {
  WEEKDAYS,
  avatarUrl,
  formatDate,
  formatDuration,
  formatPrice,
  instagramHandle,
  instagramUrl,
  whatsappLink,
} from "@/lib/format";
import type { ProfessionalPublic, Review } from "@/lib/types";

export const revalidate = 30;

type Params = Promise<{ slug: string }>;
type Query = Promise<Record<string, string | string[] | undefined>>;

async function loadProfessional(
  slug: string,
  preview?: string,
): Promise<ProfessionalPublic | null> {
  try {
    return await api.get<ProfessionalPublic>(`/professionals/${slug}`, {
      params: preview ? { preview } : undefined,
      // A pré-visualização não é para guardar: o perfil está a ser mudado.
      revalidate: preview ? 0 : undefined,
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

/** "Campo de Ourique, Lisboa" — sem repetir o distrito quando é igual à cidade. */
function localizacao(pro: { neighborhood?: string | null; city?: string | null; state?: string | null }): string {
  const partes = [pro.neighborhood, pro.city];
  if (pro.state && pro.state !== pro.city) partes.push(pro.state);
  return partes.filter(Boolean).join(", ");
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const pro = await loadProfessional(slug);
  if (!pro) return { title: "Perfil não encontrado" };

  const local = localizacao(pro);
  return {
    title: `${pro.display_name}${local ? ` - ${local}` : ""}`,
    description:
      pro.headline ??
      `Veja serviços, preços, avaliações e horários livres de ${pro.display_name} no prihora.`,
    openGraph: {
      title: pro.display_name,
      description: pro.headline ?? "Agende online pelo prihora.",
      type: "profile",
    },
  };
}



export default async function ProfessionalPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Query;
}) {
  const { slug } = await params;
  const bruto = (await searchParams).preview;
  const preview = typeof bruto === "string" ? bruto : undefined;

  const pro = await loadProfessional(slug, preview);
  if (!pro) notFound();

  let reviews: Review[] = [];
  try {
    reviews = await api.get<Review[]>(`/professionals/${slug}/reviews`, {
      params: preview ? { limit: 12, preview } : { limit: 12 },
    });
  } catch {
    reviews = [];
  }

  const local = localizacao(pro);
  const whatsapp = whatsappLink(pro.whatsapp ?? pro.public_phone);
  // O campo é livre: aceita "@nome", "nome" ou o endereço colado inteiro.
  const instagram = instagramUrl(pro.instagram);
  const activeServices = pro.services.filter((service) => service.is_active);

  // Agrupa a grade semanal para exibir "Segunda 09:00 as 18:00".
  const grid = new Map<number, string[]>();
  for (const item of pro.availabilities) {
    const list = grid.get(item.weekday) ?? [];
    list.push(`${item.start_time.slice(0, 5)} as ${item.end_time.slice(0, 5)}`);
    grid.set(item.weekday, list);
  }

  return (
    <div className="bg-ink-50 pb-16">
      {/* Quem chegou aqui por uma ligação de revisão tem de saber que o que
          está a ver ainda não é público, e que o botão de marcar não serve. */}
      {preview && (
        <div className="bg-amber-100 px-4 py-2.5 text-center text-sm text-amber-900">
          <strong>Pré-visualização.</strong> Está a ver este perfil como ele vai ficar
          publicado. A ligação é temporária e o perfil pode ainda não aparecer nas pesquisas.
        </div>
      )}

      {/* ------------------------------------------------------------ capa --- */}
      <div className="h-40 bg-gradient-to-r from-brand-500 via-brand-600 to-brand-700 sm:h-52" />

      <div className="container-page">
        <div className="-mt-16 rounded-xl2 border border-ink-100 bg-white p-6 shadow-lift sm:-mt-20 sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={avatarUrl(pro.display_name, pro.avatar_url)}
              alt={pro.display_name}
              width={128}
              height={128}
              className="h-28 w-28 shrink-0 rounded-2xl object-cover ring-4 ring-white sm:h-32 sm:w-32"
            />

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  {pro.display_name}
                </h1>
                {pro.is_verified && (
                  <span className="chip bg-brand-50 text-brand-700 ring-brand-200">
                    <IconVerified className="h-3.5 w-3.5" />
                    Verificado
                  </span>
                )}
              </div>

              {pro.headline && <p className="mt-1.5 text-ink-600">{pro.headline}</p>}

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-ink-500">
                {/* Sempre à vista, mesmo a zero: escondê-los faz um perfil
                    novo parecer incompleto em vez de novo. */}
                {/* A nota leva a quem a deu: quem a lê quer ver os comentários. */}
                <a
                  href="#avaliacoes"
                  className={`inline-flex items-center gap-1 rounded font-semibold transition hover:text-brand-700 ${
                    pro.rating_count > 0 ? "text-ink-800" : "text-ink-400"
                  }`}
                >
                  <IconStar
                    className={`h-4 w-4 ${
                      pro.rating_count > 0 ? "text-amber-500" : "text-ink-300"
                    }`}
                  />
                  {pro.rating_avg.toFixed(1).replace(".", ",")}
                  <span className="font-normal text-ink-400 underline decoration-ink-300 underline-offset-2">
                    ({pro.rating_count} {pro.rating_count === 1 ? "avaliação" : "avaliações"})
                  </span>
                </a>
                {local && (
                  <span className="inline-flex items-center gap-1">
                    <IconPin className="h-4 w-4" />
                    {local}
                  </span>
                )}
                {pro.completed_bookings > 0 ? (
                  <span className="inline-flex items-center gap-1">
                    <IconCheck className="h-4 w-4" />
                    {pro.completed_bookings}{" "}
                    {pro.completed_bookings === 1
                      ? "atendimento concluído"
                      : "atendimentos concluídos"}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 font-semibold text-brand-700">
                    <IconSparkles className="h-4 w-4" />
                    Novo no prihora
                  </span>
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {pro.categories.map((category) => (
                  <Link
                    key={category.id}
                    href={`/buscar?category=${category.slug}`}
                    className="chip bg-ink-50 text-ink-600 ring-ink-200 transition hover:ring-brand-300"
                  >
                    {category.name}
                  </Link>
                ))}
                {pro.serves_at_home && (
                  <span className="chip bg-brand-50 text-brand-700 ring-brand-200">
                    <IconHome className="h-3 w-3" />
                    Atende ao domicílio ({pro.home_service_radius_km} km)
                  </span>
                )}
              </div>
            </div>

            <div className="flex shrink-0 gap-2 sm:flex-col">
              {whatsapp && (
                <a
                  href={whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary flex-1"
                >
                  <IconWhatsapp className="h-4 w-4 text-emerald-600" />
                  WhatsApp
                </a>
              )}
              {instagram && (
                <a
                  href={instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary flex-1"
                  title={instagramHandle(pro.instagram) ?? "Instagram"}
                >
                  <IconInstagram className="h-4 w-4 text-brand-600" />
                  Instagram
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 space-y-8">
            {pro.bio && (
              <section className="card p-6">
                <h2 className="text-lg font-bold">Sobre</h2>
                <p className="mt-3 whitespace-pre-line leading-relaxed text-ink-600">{pro.bio}</p>
              </section>
            )}

            <section id="marcar" className="scroll-mt-24">
              <BookingWidget professional={pro} />
            </section>

            <section id="avaliacoes" className="card scroll-mt-24 p-6">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-lg font-bold">Avaliações</h2>
                <span
                  className={`inline-flex items-center gap-1 text-sm font-semibold ${
                    pro.rating_count > 0 ? "" : "text-ink-400"
                  }`}
                >
                  <IconStar
                    className={`h-4 w-4 ${
                      pro.rating_count > 0 ? "text-amber-500" : "text-ink-300"
                    }`}
                  />
                  {pro.rating_avg.toFixed(1).replace(".", ",")} de 5
                </span>
              </div>

              {reviews.length === 0 ? (
                <p className="mt-3 text-sm text-ink-500">
                  Ainda não há avaliações publicadas. Seja a primeira pessoa a avaliar após o
                  atendimento.
                </p>
              ) : (
                <ul className="mt-5 space-y-5">
                  {reviews.map((review) => (
                    <li key={review.id} className="border-b border-ink-100 pb-5 last:border-0 last:pb-0">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold text-ink-900">{review.author_name}</p>
                        <span className="text-xs text-ink-400">{formatDate(review.created_at)}</span>
                      </div>
                      <div className="mt-1 flex gap-0.5" aria-label={`${review.rating} de 5`}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <IconStar
                            key={star}
                            filled={star <= review.rating}
                            className={`h-3.5 w-3.5 ${
                              star <= review.rating ? "text-amber-500" : "text-ink-200"
                            }`}
                          />
                        ))}
                      </div>
                      {review.comment && (
                        <p className="mt-2 text-sm leading-relaxed text-ink-600">{review.comment}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* Serviços e horários ficam ao lado: são o que se consulta enquanto
              se escolhe a hora, não o que se vem fazer. */}
          <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
            <section className="card p-6">
              <h2 className="text-lg font-bold">Serviços e preços</h2>
              {activeServices.length === 0 ? (
                <p className="mt-3 text-sm text-ink-500">
                  Este profissional ainda não publicou a lista de serviços.
                </p>
              ) : (
                <ul className="mt-3 divide-y divide-ink-100">
                  {activeServices.map((service) => (
                    <li key={service.id} className="py-3">
                      <div className="flex items-baseline justify-between gap-3">
                        <h3 className="min-w-0 font-semibold text-ink-900">{service.name}</h3>
                        <p className="shrink-0 text-sm font-semibold text-ink-900">
                          {formatPrice(service.price_cents)}
                        </p>
                      </div>
                      <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-ink-400">
                        <IconClock className="h-3.5 w-3.5" />
                        {formatDuration(service.duration_min)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="card p-6">
              <h2 className="text-lg font-bold">Horários de atendimento</h2>
              {grid.size === 0 ? (
                <p className="mt-3 text-sm text-ink-500">Agenda ainda não configurada.</p>
              ) : (
                <dl className="mt-3 divide-y divide-ink-100 text-sm">
                  {WEEKDAYS.map((label, weekday) => {
                    const windows = grid.get(weekday);
                    return (
                      <div key={label} className="flex items-center justify-between gap-3 py-2">
                        <dt className="font-medium text-ink-700">{label}</dt>
                        <dd className={windows ? "text-ink-600" : "text-ink-300"}>
                          {windows ? windows.join(" | ") : "Fechado"}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              )}

              {(pro.address_line || pro.city) && pro.serves_at_studio && (
                <div className="mt-4 flex items-start gap-2 rounded-xl bg-ink-50 p-3 text-sm text-ink-600">
                  <IconPin className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
                  <span>
                    {pro.address_line}
                    {pro.address_line && (pro.neighborhood || pro.city) ? " - " : ""}
                    {[pro.neighborhood, pro.city, pro.state].filter(Boolean).join(", ")}
                  </span>
                </div>
              )}
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
