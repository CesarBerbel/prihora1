"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { IconCheck, IconClose, IconWhatsapp } from "@/components/Icons";
import { ApiError, api } from "@/lib/api";
import { WHATSAPP_STATUS_LABEL, formatDateTime, formatPhone } from "@/lib/format";
import type { ChannelsStatus, WhatsappStatus } from "@/lib/types";

interface Props {
  estado: WhatsappStatus;
  onChange: (canais: ChannelsStatus) => void;
}

/**
 * Ligação do WhatsApp do próprio profissional.
 *
 * O código muda a cada minuto enquanto ninguém o lê, por isso a página vai
 * perguntando o estado ao servidor — mas só enquanto o painel está à espera
 * da leitura. Ligado ou desligado, não há nada para sondar.
 */
export default function WhatsappPanel({ estado, onChange }: Props) {
  const [aLigar, setALigar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const sondagem = useRef<ReturnType<typeof setInterval> | null>(null);

  const recarregar = useCallback(async () => {
    try {
      onChange(await api.get<ChannelsStatus>("/me/messages/channels", { auth: true }));
    } catch {
      // Uma sondagem falhada não é motivo para estragar a página.
    }
  }, [onChange]);

  useEffect(() => {
    const aEsperaDoCodigo = estado.status === "qr" || estado.status === "connecting";

    if (aEsperaDoCodigo && !sondagem.current) {
      sondagem.current = setInterval(recarregar, 3000);
    }
    if (!aEsperaDoCodigo && sondagem.current) {
      clearInterval(sondagem.current);
      sondagem.current = null;
    }
    return () => {
      if (sondagem.current) {
        clearInterval(sondagem.current);
        sondagem.current = null;
      }
    };
  }, [estado.status, recarregar]);

  async function ligar() {
    setALigar(true);
    setErro(null);
    try {
      const novo = await api.post<WhatsappStatus>("/me/messages/whatsapp/connect", undefined, {
        auth: true,
      });
      await recarregar();
      if (novo.last_error) setErro(novo.last_error);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível ligar ao WhatsApp.");
    } finally {
      setALigar(false);
    }
  }

  async function desligar() {
    if (!window.confirm("Terminar a sessão de WhatsApp neste computador?")) return;
    setALigar(true);
    setErro(null);
    try {
      await api.delete("/me/messages/whatsapp", { auth: true });
      await recarregar();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível desligar.");
    } finally {
      setALigar(false);
    }
  }

  const ligado = estado.status === "connected";

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 px-6 py-4">
        <h2 className="flex items-center gap-2 font-bold">
          <IconWhatsapp className="h-5 w-5 text-emerald-600" />
          O seu WhatsApp
        </h2>
        <span
          className={`chip ${
            ligado
              ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
              : estado.status === "unavailable"
                ? "bg-rose-50 text-rose-700 ring-rose-200"
                : "bg-amber-50 text-amber-800 ring-amber-200"
          }`}
        >
          {WHATSAPP_STATUS_LABEL[estado.status] ?? estado.status}
        </span>
      </div>

      <div className="p-6">
        {erro && (
          <p className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{erro}</p>
        )}

        {!estado.enabled ? (
          <p className="text-sm text-ink-500">
            O WhatsApp está desligado nesta instalação.
          </p>
        ) : ligado ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl bg-emerald-50 p-4">
              <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-600 text-white">
                <IconCheck className="h-4 w-4" />
              </span>
              <div className="min-w-0 text-sm">
                <p className="font-semibold text-emerald-900">
                  Ligado{estado.phone_number ? ` ao ${formatPhone(estado.phone_number)}` : ""}
                </p>
                <p className="mt-0.5 text-emerald-800">
                  As mensagens saem do seu próprio número.
                  {estado.connected_at ? ` Ligado desde ${formatDateTime(estado.connected_at)}.` : ""}
                </p>
              </div>
            </div>
            <p className="text-sm text-ink-500">
              {estado.messages_sent === 1
                ? "1 mensagem enviada por aqui."
                : `${estado.messages_sent} mensagens enviadas por aqui.`}
            </p>
            <button onClick={desligar} disabled={aLigar} className="btn-secondary btn-sm">
              <IconClose className="h-4 w-4" />
              Terminar sessão
            </button>
          </div>
        ) : estado.qr ? (
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={estado.qr}
              alt="Código QR para ligar o WhatsApp"
              width={200}
              height={200}
              className="h-50 w-50 shrink-0 rounded-xl border border-ink-200 bg-white p-2"
            />
            <ol className="space-y-2 text-sm text-ink-600">
              <li>1. Abra o WhatsApp no telemóvel.</li>
              <li>
                2. Toque em <strong>Definições</strong> e depois em{" "}
                <strong>Dispositivos ligados</strong>.
              </li>
              <li>
                3. Escolha <strong>Ligar um dispositivo</strong> e aponte a câmara para este
                código.
              </li>
              <li className="pt-1 text-ink-400">
                O código muda a cada minuto. Esta página vai-se atualizando sozinha.
              </li>
            </ol>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-ink-600">
              Ligue o seu WhatsApp para falar com os clientes a partir do seu próprio número.
              A conta é sua: nós apenas guardamos a ligação, e pode terminá-la quando quiser.
            </p>
            {estado.last_error && (
              <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {estado.last_error}
              </p>
            )}
            <button onClick={ligar} disabled={aLigar} className="btn-primary">
              <IconWhatsapp className="h-4 w-4" />
              {aLigar ? "A preparar o código..." : "Ligar o meu WhatsApp"}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
