"use client";

import { useCallback, useEffect, useState } from "react";

import AccountShell from "@/components/AccountShell";
import WhatsappPanel from "@/components/WhatsappPanel";
import NotificationRules from "@/components/NotificationRules";
import { IconTrash, IconWhatsapp } from "@/components/Icons";
import { ApiError, api } from "@/lib/api";
import {
  MESSAGE_STATUS_LABEL,
  MESSAGE_STATUS_STYLE,
  formatDateTime,
  formatPhone,
} from "@/lib/format";
import type {
  ChannelsStatus,
  Client,
  Message,
  Paged,
} from "@/lib/types";

export default function MensagensPage() {
  const [separador, setSeparador] = useState<"enviar" | "automaticas">("enviar");
  const [canais, setCanais] = useState<ChannelsStatus | null>(null);
  const [clientes, setClientes] = useState<Client[]>([]);
  const [historico, setHistorico] = useState<Paged<Message> | null>(null);
  const [pagina, setPagina] = useState(1);

  const [forma, setForma] = useState({
    client_id: "",
    recipient: "",
    body: "",
  });
  const [aEnviar, setAEnviar] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  const carregarHistorico = useCallback(async () => {
    setHistorico(
      await api.get<Paged<Message>>("/me/messages", {
        params: { page: pagina, per_page: 20 },
        auth: true,
      }),
    );
  }, [pagina]);

  useEffect(() => {
    Promise.all([
      api.get<ChannelsStatus>("/me/messages/channels", { auth: true }).then(setCanais),
      api
        .get<Paged<Client>>("/me/clients", { params: { per_page: 100 }, auth: true })
        .then((d) => setClientes(d.items)),
    ]).catch(() => setAviso({ tipo: "erro", texto: "Não foi possível carregar a página." }));
  }, []);

  useEffect(() => {
    carregarHistorico().catch(() => undefined);
  }, [carregarHistorico]);

  const cliente = clientes.find((c) => String(c.id) === forma.client_id);
  // Sem telefone na ficha, o envio ia falhar já no servidor.
  const contactoEmFalta =
    Boolean(cliente) && !forma.recipient.trim() && !cliente?.phone;

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setAEnviar(true);
    setAviso(null);
    try {
      const criada = await api.post<Message>(
        "/me/messages",
        {
          client_id: forma.client_id ? Number(forma.client_id) : null,
          recipient: forma.recipient.trim() || null,
          body: forma.body,
        },
        { auth: true },
      );

      // O envio pode falhar sem que o pedido falhe: a mensagem fica registada
      // com o motivo, e é isso que interessa mostrar.
      if (criada.status === "failed") {
        setAviso({ tipo: "erro", texto: criada.error ?? "A mensagem não saiu." });
      } else {
        setAviso({ tipo: "ok", texto: "Mensagem enviada." });
        setForma({ ...forma, body: "" });
      }
      await carregarHistorico();
      setCanais(await api.get<ChannelsStatus>("/me/messages/channels", { auth: true }));
    } catch (e) {
      setAviso({
        tipo: "erro",
        texto: e instanceof ApiError ? e.message : "Não foi possível enviar.",
      });
    } finally {
      setAEnviar(false);
    }
  }

  async function apagar(id: number) {
    if (!window.confirm("Remover esta mensagem do histórico?")) return;
    await api.delete(`/me/messages/${id}`, { auth: true });
    await carregarHistorico();
  }

  return (
    <AccountShell
      title="Mensagens"
      subtitle="Fale com os clientes por WhatsApp ou e-mail, sem sair do painel."
      allow={["professional"]}
    >
      {aviso && (
        <p
          className={`mb-6 rounded-xl px-4 py-3 text-sm ${
            aviso.tipo === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-700"
          }`}
        >
          {aviso.texto}
        </p>
      )}

      <div className="mb-6 grid max-w-md grid-cols-2 gap-1 rounded-xl bg-ink-100 p-1">
        {([
          ["enviar", "Enviar agora"],
          ["automaticas", "Automáticas"],
        ] as const).map(([chave, rotulo]) => (
          <button
            key={chave}
            onClick={() => setSeparador(chave)}
            className={`rounded-lg py-2 text-sm font-semibold transition ${
              separador === chave ? "bg-white text-ink-900 shadow-sm" : "text-ink-500"
            }`}
          >
            {rotulo}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        <div className="space-y-6">
          {separador === "automaticas" && <NotificationRules />}
          {/* ------------------------------------------------- compositor --- */}
          {separador === "enviar" && (
          <form onSubmit={enviar} className="card p-6">
            <h2 className="font-bold">Nova mensagem</h2>


            <div className="mt-4 space-y-4">
              <div>
                <label className="label" htmlFor="msg-cliente">
                  Para
                </label>
                <select
                  id="msg-cliente"
                  className="input"
                  value={forma.client_id}
                  onChange={(e) => setForma({ ...forma, client_id: e.target.value, recipient: "" })}
                >
                  <option value="">Escrever o destinatário à mão</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.phone ? ` — ${formatPhone(c.phone)}` : " — sem telefone"}
                    </option>
                  ))}
                </select>
              </div>

              {(!forma.client_id || contactoEmFalta) && (
                <div>
                  <label className="label" htmlFor="msg-destino">
                    Telefone *
                  </label>
                  <input
                    id="msg-destino"
                    required
                    className="input"
                    value={forma.recipient}
                    onChange={(e) => setForma({ ...forma, recipient: e.target.value })}
                    placeholder="912 345 678"
                  />
                  {contactoEmFalta && (
                    <p className="field-hint">
                      Este cliente não tem telefone na ficha.
                    </p>
                  )}
                </div>
              )}


              <div>
                <label className="label" htmlFor="msg-corpo">
                  Mensagem *
                </label>
                <textarea
                  id="msg-corpo"
                  required
                  maxLength={4000}
                  className="input min-h-32 resize-y"
                  value={forma.body}
                  onChange={(e) => setForma({ ...forma, body: e.target.value })}
                  placeholder="Olá! A sua marcação de amanhã às 10h00 está confirmada."
                />
                <p className="field-hint">
                  Sai do seu próprio número, com o WhatsApp ligado ao lado.
                </p>
              </div>
            </div>

            <button
              type="submit"
              disabled={aEnviar || canais?.whatsapp.status !== "connected"}
              className="btn-primary mt-5"
            >
              {aEnviar ? "A enviar..." : "Enviar"}
            </button>

            {canais && canais.whatsapp.status !== "connected" && (
              <p className="mt-3 flex items-center gap-1.5 text-sm text-amber-700">
                <IconWhatsapp className="h-4 w-4" />
                Ligue o WhatsApp ao lado para poder enviar.
              </p>
            )}
          </form>
          )}

          {/* ---------------------------------------------------- histórico --- */}
          {separador === "enviar" && (
          <section className="card p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-bold">Histórico</h2>
            </div>

            {!historico ? (
              <div className="mt-4 h-40 animate-pulse rounded-xl bg-ink-100" />
            ) : historico.items.length === 0 ? (
              <p className="mt-6 rounded-xl border border-dashed border-ink-200 px-4 py-10 text-center text-sm text-ink-500">
                Ainda não enviou nenhuma mensagem por aqui.
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-ink-100">
                {historico.items.map((m) => (
                  <li key={m.id} className="py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`chip ${MESSAGE_STATUS_STYLE[m.status]}`}>
                        {MESSAGE_STATUS_LABEL[m.status]}
                      </span>
                      <span className="text-sm font-medium text-ink-800">
                        {m.recipient_name ?? formatPhone(m.recipient)}
                      </span>
                      <span className="ml-auto text-xs text-ink-400">
                        {formatDateTime(m.created_at)}
                      </span>
                      <button
                        onClick={() => apagar(m.id)}
                        className="rounded-lg p-1.5 text-ink-300 transition hover:bg-rose-50 hover:text-rose-600"
                        aria-label="Remover do histórico"
                      >
                        <IconTrash className="h-4 w-4" />
                      </button>
                    </div>

                    <p className="mt-1 whitespace-pre-line text-sm text-ink-600">{m.body}</p>
                    {m.error && (
                      <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
                        {m.error}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {historico && historico.pages > 1 && (
              <div className="mt-5 flex items-center justify-center gap-3">
                <button
                  onClick={() => setPagina((p) => Math.max(1, p - 1))}
                  disabled={pagina <= 1}
                  className="btn-secondary btn-sm"
                >
                  Anterior
                </button>
                <span className="text-sm text-ink-500">
                  Página {historico.page} de {historico.pages}
                </span>
                <button
                  onClick={() => setPagina((p) => Math.min(historico.pages, p + 1))}
                  disabled={pagina >= historico.pages}
                  className="btn-secondary btn-sm"
                >
                  Seguinte
                </button>
              </div>
            )}
          </section>
          )}
        </div>

        {/* ------------------------------------------------------- canais --- */}
        <aside className="space-y-6 lg:sticky lg:top-24">
          {canais ? (
            <WhatsappPanel estado={canais.whatsapp} onChange={setCanais} />
          ) : (
            <div className="h-64 animate-pulse rounded-xl2 bg-ink-100" />
          )}

        </aside>
      </div>
    </AccountShell>
  );
}
