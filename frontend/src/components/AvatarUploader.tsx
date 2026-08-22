"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import Modal from "@/components/Modal";
import { IconTrash, IconUser } from "@/components/Icons";
import { ApiError, api, mediaUrl, upload } from "@/lib/api";
import { centeredOffset, clampOffset, cropRect, drawnSize } from "@/lib/crop";
import { avatarUrl } from "@/lib/format";
import type { ProfessionalPrivate } from "@/lib/types";

/** Lado do quadrado enviado. O backend recodifica no mesmo tamanho. */
const OUTPUT_SIZE = 512;
/** Lado da área de recorte na tela. */
const VIEW = 288;
const MAX_INPUT_BYTES = 8 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

interface Props {
  professional: ProfessionalPrivate;
  onChange: (updated: ProfessionalPrivate) => void;
}

export default function AvatarUploader({ professional, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const [source, setSource] = useState<string | null>(null);
  const [natural, setNatural] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current = mediaUrl(professional.avatar_url);

  // Toda a geometria do recorte vive em @/lib/crop, coberta por testes.
  const drawn = drawnSize(natural, VIEW, zoom);

  const clamp = useCallback(
    (next: { x: number; y: number }) => clampOffset(next, natural, VIEW, zoom),
    [natural, zoom],
  );

  // Ao aproximar ou afastar, a posicao atual pode virar invalida.
  useEffect(() => {
    setOffset((current) => clampOffset(current, natural, VIEW, zoom));
  }, [natural, zoom]);

  // Libera o object URL ao trocar de imagem ou desmontar.
  useEffect(() => {
    return () => {
      if (source) URL.revokeObjectURL(source);
    };
  }, [source]);

  function pick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Permite reescolher o mesmo arquivo depois de cancelar.
    event.target.value = "";
    if (!file) return;

    setError(null);

    if (!ACCEPTED.includes(file.type)) {
      setError("Formato não suportado. Escolha um JPG, PNG ou WEBP.");
      return;
    }
    if (file.size > MAX_INPUT_BYTES) {
      setError("Imagem muito grande. O limite e 8 MB.");
      return;
    }

    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      imageRef.current = image;
      const size = { width: image.naturalWidth, height: image.naturalHeight };
      setNatural(size);
      setZoom(1);
      setOffset(centeredOffset(size, VIEW));
      setSource(url);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      setError("Não conseguimos abrir esta imagem.");
    };
    image.src = url;
  }

  function startDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (!source) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    dragStart.current = { x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y };
  }

  function moveDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    const nextX = dragStart.current.ox + (event.clientX - dragStart.current.x);
    const nextY = dragStart.current.oy + (event.clientY - dragStart.current.y);
    setOffset(clamp({ x: nextX, y: nextY }));
  }

  function endDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDragging(false);
  }

  function wheelZoom(event: React.WheelEvent<HTMLDivElement>) {
    if (!source) return;
    const next = zoom * (event.deltaY < 0 ? 1.08 : 1 / 1.08);
    setZoom(Math.min(4, Math.max(1, next)));
  }

  function closeEditor() {
    if (source) URL.revokeObjectURL(source);
    setSource(null);
    imageRef.current = null;
    setError(null);
  }

  /**
   * Converte a área visível do recorte para o quadrado final.
   * A conta espelha exatamente o que esta na tela: o pedaco da imagem que
   * aparece na janela e o mesmo que vai para o canvas.
   */
  async function save() {
    const image = imageRef.current;
    if (!image) return;

    setBusy(true);
    setError(null);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;

      const context = canvas.getContext("2d");
      if (!context) throw new Error("canvas indisponível");

      context.imageSmoothingQuality = "high";
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

      // Retangulo de origem, em pixels reais da imagem.
      const rect = cropRect(natural, VIEW, zoom, offset);

      context.drawImage(
        image,
        rect.sx,
        rect.sy,
        rect.size,
        rect.size,
        0,
        0,
        OUTPUT_SIZE,
        OUTPUT_SIZE,
      );

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.92),
      );
      if (!blob) throw new Error("falha ao gerar a imagem");

      const updated = await upload<ProfessionalPrivate>("/me/avatar", blob, {
        filename: "avatar.jpg",
      });
      onChange(updated);
      closeEditor();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Não foi possível enviar a foto. Tente de novo.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm("Remover a foto do perfil?")) return;
    setBusy(true);
    setError(null);
    try {
      onChange(await api.delete<ProfessionalPrivate>("/me/avatar", { auth: true }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível remover a foto.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <span className="label">Foto do perfil</span>

      <div className="flex items-center gap-5">
        <div className="relative shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={current ?? avatarUrl(professional.display_name)}
            alt="Foto atual do perfil"
            width={96}
            height={96}
            className="h-24 w-24 rounded-2xl object-cover ring-1 ring-ink-200"
          />
          {!current && (
            <span className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full bg-ink-200 text-ink-500">
              <IconUser className="h-3.5 w-3.5" />
            </span>
          )}
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className="btn-secondary btn-sm"
            >
              {current ? "Trocar foto" : "Enviar foto"}
            </button>
            {current && (
              <button
                type="button"
                onClick={remove}
                disabled={busy}
                className="btn-ghost btn-sm text-rose-600 hover:bg-rose-50"
              >
                <IconTrash className="h-4 w-4" />
                Remover
              </button>
            )}
          </div>
          <p className="field-hint">
            JPG, PNG ou WEBP, até 8 MB. Você recorta antes de enviar.
          </p>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={pick}
        className="hidden"
      />

      {error && !source && (
        <p className="mt-3 rounded-xl bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{error}</p>
      )}

      {/* ------------------------------------------------- editor de recorte --- */}
      {source && (
        <Modal
          title="Ajustar a foto"
          subtitle="O que aparece no quadrado é exatamente o que vai para o seu perfil."
          size="md"
          onClose={closeEditor}
        >
          <div>
            <div>
              <p className="mb-3 text-sm text-ink-500">
                Arraste para posicionar e use o controlo para aproximar.
              </p>

              <div
                onPointerDown={startDrag}
                onPointerMove={moveDrag}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onWheel={wheelZoom}
                style={{ width: VIEW, height: VIEW }}
                className={`relative mx-auto touch-none select-none overflow-hidden rounded-2xl bg-ink-100 ring-1 ring-ink-200 ${
                  dragging ? "cursor-grabbing" : "cursor-grab"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={source}
                  alt=""
                  draggable={false}
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    width: drawn.width,
                    height: drawn.height,
                    transform: `translate(${offset.x}px, ${offset.y}px)`,
                  }}
                  className="max-w-none"
                />
                {/* Guia visual: mostra como a foto aparece arredondada nos cards. */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-inset ring-white/70"
                />
              </div>

              <div className="mt-4 flex items-center gap-3">
                <span className="text-xs font-semibold text-ink-500">Zoom</span>
                <input
                  type="range"
                  min={1}
                  max={4}
                  step={0.01}
                  value={zoom}
                  onChange={(event) => setZoom(Number(event.target.value))}
                  className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-ink-200 accent-brand-600"
                  aria-label="Aproximar a foto"
                />
              </div>

              {error && (
                <p className="mt-4 rounded-xl bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
                  {error}
                </p>
              )}
            </div>

            <div className="mt-5 flex gap-2 border-t border-ink-100 pt-4">
              <button type="button" onClick={save} disabled={busy} className="btn-primary flex-1">
                {busy ? "A enviar..." : "Guardar foto"}
              </button>
              <button type="button" onClick={closeEditor} disabled={busy} className="btn-ghost">
                Cancelar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
