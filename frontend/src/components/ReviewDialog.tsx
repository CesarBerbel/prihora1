"use client";

/**
 * Avaliar um atendimento, numa janela.
 *
 * Serve os dois caminhos por onde alguém chega a isto — a lista de marcações
 * de quem tem conta, e a consulta pelo código de quem não tem — porque o
 * servidor pede a mesma coisa nos dois: o código do atendimento. Ter duas
 * versões deste formulário era ter duas maneiras de o preencher mal.
 */

import { useState } from "react";

import Modal from "@/components/Modal";
import { IconStar } from "@/components/Icons";
import { ApiError, api } from "@/lib/api";
import type { Review } from "@/lib/types";

interface Props {
  /** Quem se está a avaliar, para o título dizer de quem se trata. */
  professionalName: string;
  professionalSlug: string;
  bookingCode: string;
  serviceName?: string | null;
  onDone: (review: Review) => void;
  onClose: () => void;
}

const LEGENDAS = ["", "Mau", "Fraco", "Razoável", "Bom", "Excelente"];

export default function ReviewDialog({
  professionalName,
  professionalSlug,
  bookingCode,
  serviceName,
  onDone,
  onClose,
}: Props) {
  const [nota, setNota] = useState(5);
  const [comentario, setComentario] = useState("");
  const [aEnviar, setAEnviar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setAEnviar(true);
    setErro(null);
    try {
      const review = await api.post<Review>(
        `/professionals/${professionalSlug}/reviews`,
        { booking_code: bookingCode, rating: nota, comment: comentario.trim() || null },
      );
      onDone(review);
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Não foi possível enviar a avaliação.");
    } finally {
      setAEnviar(false);
    }
  }

  return (
    <Modal
      title={`Avaliar ${professionalName}`}
      subtitle={serviceName ?? undefined}
      size="md"
      onClose={onClose}
    >
      <form onSubmit={enviar}>
        {erro && (
          <p className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{erro}</p>
        )}

        <fieldset>
          <legend className="label">Que nota dá ao atendimento?</legend>
          <div className="mt-1 flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((estrela) => (
              <button
                key={estrela}
                type="button"
                onClick={() => setNota(estrela)}
                aria-label={`${estrela} ${estrela === 1 ? "estrela" : "estrelas"}`}
                aria-pressed={nota === estrela}
                className="rounded p-1 transition hover:bg-ink-50"
              >
                <IconStar
                  className={`h-8 w-8 ${estrela <= nota ? "text-amber-500" : "text-ink-200"}`}
                />
              </button>
            ))}
            <span className="ml-2 text-sm font-medium text-ink-600">{LEGENDAS[nota]}</span>
          </div>
        </fieldset>

        <div className="mt-5">
          <label className="label" htmlFor="avaliacao-comentario">
            Quer contar como correu? (opcional)
          </label>
          <textarea
            id="avaliacao-comentario"
            className="input min-h-28 resize-y"
            maxLength={1000}
            value={comentario}
            onChange={(evento) => setComentario(evento.target.value)}
            placeholder="O que gostou, o que podia ser melhor…"
          />
          <p className="field-hint">
            A avaliação fica visível no perfil, com o seu primeiro nome.
          </p>
        </div>

        <div className="mt-6 flex gap-2">
          <button type="submit" disabled={aEnviar} className="btn-primary flex-1">
            {aEnviar ? "A enviar..." : "Enviar avaliação"}
          </button>
          <button type="button" onClick={onClose} disabled={aEnviar} className="btn-ghost">
            Agora não
          </button>
        </div>
      </form>
    </Modal>
  );
}
