"use client";

/**
 * As avaliações que o profissional recebeu.
 *
 * Estavam só na página pública, misturadas com o resto do perfil — para as ler
 * todas era preciso sair do painel e ir vê-las como um cliente. Aqui ficam
 * juntas, com o serviço a que cada uma diz respeito: uma nota de três sem
 * saber a que atendimento se refere não ajuda ninguém a melhorar.
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import DashboardShell from "@/components/DashboardShell";
import { IconStar } from "@/components/Icons";
import { PANEL_NAV } from "@/components/PanelNav";
import { ApiError, api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { Review } from "@/lib/types";

interface MyReview extends Review {
  service_name?: string | null;
  booking_code?: string | null;
  is_published: boolean;
}

function Estrelas({ nota, tamanho = "h-4 w-4" }: { nota: number; tamanho?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${nota} em 5`}>
      {[1, 2, 3, 4, 5].map((estrela) => (
        <IconStar
          key={estrela}
          className={`${tamanho} ${estrela <= nota ? "text-amber-500" : "text-ink-200"}`}
        />
      ))}
    </span>
  );
}

export default function AvaliacoesPage() {
  const [reviews, setReviews] = useState<MyReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<number | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      setReviews(await api.get<MyReview[]>("/me/reviews", { auth: true }));
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Não foi possível carregar.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const resumo = useMemo(() => {
    const total = reviews.length;
    const soma = reviews.reduce((acc, r) => acc + r.rating, 0);
    // Quantas de cada nota, para a distribuição por baixo da média.
    const porNota = [5, 4, 3, 2, 1].map((nota) => ({
      nota,
      quantas: reviews.filter((r) => r.rating === nota).length,
    }));
    return { total, media: total ? soma / total : 0, porNota };
  }, [reviews]);

  const visiveis = filtro ? reviews.filter((r) => r.rating === filtro) : reviews;

  return (
    <DashboardShell
      title="Avaliações"
      subtitle="O que os seus clientes escreveram depois do atendimento."
      nav={PANEL_NAV}
      allow={["professional"]}
    >
      {erro && <p className="mb-6 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{erro}</p>}

      {loading ? (
        <div className="h-64 animate-pulse rounded-xl2 bg-ink-100" />
      ) : reviews.length === 0 ? (
        <div className="rounded-xl2 border border-dashed border-ink-200 bg-white px-6 py-16 text-center">
          <IconStar className="mx-auto h-8 w-8 text-ink-300" />
          <h2 className="mt-3 text-lg font-semibold">Ainda sem avaliações</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-ink-500">
            Depois de marcar um atendimento como concluído, o cliente recebe o convite para
            avaliar. As avaliações aparecem aqui e no seu perfil público.
          </p>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)] lg:items-start">
          {/* ---------------------------------------------------- resumo --- */}
          <aside className="card p-5 lg:sticky lg:top-24">
            <p className="text-4xl font-bold tracking-tight">
              {resumo.media.toFixed(1).replace(".", ",")}
            </p>
            <Estrelas nota={Math.round(resumo.media)} tamanho="h-5 w-5" />
            <p className="mt-1 text-sm text-ink-500">
              {resumo.total} {resumo.total === 1 ? "avaliação" : "avaliações"}
            </p>

            <div className="mt-4 space-y-1.5 border-t border-ink-100 pt-4">
              {resumo.porNota.map(({ nota, quantas }) => {
                const parte = resumo.total ? (quantas / resumo.total) * 100 : 0;
                const activo = filtro === nota;
                return (
                  <button
                    key={nota}
                    onClick={() => setFiltro(activo ? null : nota)}
                    disabled={quantas === 0}
                    aria-pressed={activo}
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-1 text-xs transition disabled:cursor-default disabled:opacity-40 ${
                      activo ? "bg-brand-50" : "hover:bg-ink-50"
                    }`}
                  >
                    <span className="w-3 shrink-0 font-semibold text-ink-600">{nota}</span>
                    <IconStar className="h-3 w-3 shrink-0 text-amber-500" />
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-100">
                      <span
                        className="block h-full rounded-full bg-amber-400"
                        style={{ width: `${parte}%` }}
                      />
                    </span>
                    <span className="w-5 shrink-0 text-right text-ink-500">{quantas}</span>
                  </button>
                );
              })}
            </div>

            {filtro && (
              <button onClick={() => setFiltro(null)} className="btn-ghost btn-sm mt-3 w-full">
                Ver todas
              </button>
            )}
          </aside>

          {/* ----------------------------------------------------- lista --- */}
          <ul className="min-w-0 space-y-3">
            {visiveis.map((review) => (
              <li key={review.id} className="card p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Estrelas nota={review.rating} />
                    <span className="font-semibold text-ink-900">{review.author_name}</span>
                  </div>
                  <span className="text-xs text-ink-400">{formatDate(review.created_at)}</span>
                </div>

                {review.service_name && (
                  <p className="mt-1 text-xs text-ink-500">{review.service_name}</p>
                )}

                {review.comment ? (
                  <p className="mt-3 whitespace-pre-line leading-relaxed text-ink-700">
                    {review.comment}
                  </p>
                ) : (
                  <p className="mt-3 text-sm italic text-ink-400">Sem comentário escrito.</p>
                )}

                {!review.is_published && (
                  <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    Esta avaliação não está visível no seu perfil público.
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </DashboardShell>
  );
}
