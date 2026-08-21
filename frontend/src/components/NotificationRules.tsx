"use client";

import { useEffect, useState } from "react";

import { IconCheck, IconClose, IconUser, IconWhatsapp } from "@/components/Icons";
import { ApiError, api } from "@/lib/api";
import { formatOffset } from "@/lib/format";
import type { NotificationRule, RulesResponse, TemplateVariable } from "@/lib/types";

/** Desvios mais habituais para os lembretes. */
const ANTES = [30, 60, 120, 180, 1440];
const DEPOIS = [60, 180, 1440, 2880, 10080];

type Destinatario = "client" | "professional";

/**
 * Configuração das mensagens automáticas, todas por WhatsApp.
 *
 * Cada gatilho tem dois textos, um por destinatário: o que se diz ao cliente e
 * o que se diz ao profissional são mensagens diferentes, não a mesma repetida.
 */
export default function NotificationRules() {
  const [dados, setDados] = useState<RulesResponse | null>(null);
  const [aberta, setAberta] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState<NotificationRule | null>(null);
  const [foco, setFoco] = useState<Destinatario>("client");
  const [aGuardar, setAGuardar] = useState(false);
  const [previsao, setPrevisao] = useState<{
    client_body: string;
    professional_body: string;
  } | null>(null);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  async function carregar() {
    setDados(await api.get<RulesResponse>("/me/notifications", { auth: true }));
  }

  useEffect(() => {
    carregar().catch(() =>
      setAviso({ tipo: "erro", texto: "Não foi possível carregar os avisos." }),
    );
  }, []);

  function abrir(regra: NotificationRule) {
    const mesma = aberta === regra.trigger;
    setAberta(mesma ? null : regra.trigger);
    setRascunho(mesma ? null : { ...regra });
    // Abre no destinatário que está ligado, para não cair num separador vazio.
    setFoco(regra.to_client || !regra.to_professional ? "client" : "professional");
    setPrevisao(null);
    setAviso(null);
  }

  function alterar(campos: Partial<NotificationRule>) {
    setRascunho((r) => (r ? { ...r, ...campos } : r));
    setPrevisao(null);
  }

  function corpoPayload(r: NotificationRule) {
    return {
      to_client: r.to_client,
      client_body: r.client_body,
      to_professional: r.to_professional,
      professional_body: r.professional_body,
      offset_minutes: r.offset_minutes,
    };
  }

  async function guardar() {
    if (!rascunho) return;
    setAGuardar(true);
    setAviso(null);
    try {
      await api.put(`/me/notifications/${rascunho.trigger}`, corpoPayload(rascunho), {
        auth: true,
      });
      await carregar();
      setAviso({ tipo: "ok", texto: "Aviso guardado." });
      setAberta(null);
      setRascunho(null);
    } catch (e) {
      setAviso({
        tipo: "erro",
        texto: e instanceof ApiError ? e.message : "Não foi possível guardar.",
      });
    } finally {
      setAGuardar(false);
    }
  }

  async function reporTexto() {
    if (!rascunho) return;
    const reposta = await api.post<NotificationRule>(
      `/me/notifications/${rascunho.trigger}/reset`,
      undefined,
      { auth: true },
    );
    alterar({
      client_body: reposta.client_body,
      professional_body: reposta.professional_body,
    });
    await carregar();
  }

  async function verComoFica() {
    if (!rascunho) return;
    setPrevisao(
      await api.post(`/me/notifications/${rascunho.trigger}/preview`, corpoPayload(rascunho), {
        auth: true,
      }),
    );
  }

  function inserirVariavel(v: TemplateVariable) {
    const campo = foco === "client" ? "client_body" : "professional_body";
    // Forma funcional: inserir duas variáveis seguidas, antes de haver
    // re-render entre os cliques, perderia a primeira.
    setRascunho((r) => (r ? { ...r, [campo]: `${r[campo]}{${v.name}}` } : r));
    setPrevisao(null);
  }

  if (!dados) return <div className="h-96 animate-pulse rounded-xl2 bg-ink-100" />;

  const campoTexto = foco === "client" ? "client_body" : "professional_body";

  return (
    <div className="space-y-4">
      {aviso && (
        <p
          className={`rounded-xl px-4 py-3 text-sm ${
            aviso.tipo === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-700"
          }`}
        >
          {aviso.texto}
        </p>
      )}

      <ul className="space-y-3">
        {dados.rules.map((regra) => {
          const activa = aberta === regra.trigger;
          const alvos = [regra.to_client && "cliente", regra.to_professional && "para si"]
            .filter(Boolean)
            .join(" e ");

          return (
            <li key={regra.trigger} className="card overflow-hidden">
              <button
                onClick={() => abrir(regra)}
                className="flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-ink-50/60"
                aria-expanded={activa}
              >
                <span
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${
                    alvos ? "bg-emerald-600 text-white" : "bg-ink-200 text-ink-400"
                  }`}
                >
                  {alvos ? <IconCheck className="h-4 w-4" /> : <IconClose className="h-4 w-4" />}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-ink-900">{regra.label}</span>
                  <span className="block text-sm text-ink-500">
                    {alvos ? `Envia para ${alvos}` : "Desligado"}
                    {regra.uses_offset && alvos
                      ? ` · ${formatOffset(regra.offset_minutes)} ${
                          regra.trigger === "reminder_before" ? "antes" : "depois"
                        }`
                      : ""}
                  </span>
                </span>
              </button>

              {activa && rascunho && (
                <div className="space-y-5 border-t border-ink-100 px-5 py-5">
                  {rascunho.uses_offset && (
                    <div className="max-w-xs">
                      <label className="label" htmlFor={`desvio-${regra.trigger}`}>
                        Quando enviar
                      </label>
                      <select
                        id={`desvio-${regra.trigger}`}
                        className="input"
                        value={rascunho.offset_minutes}
                        onChange={(e) => alterar({ offset_minutes: Number(e.target.value) })}
                      >
                        {(regra.trigger === "reminder_before" ? ANTES : DEPOIS).map((m) => (
                          <option key={m} value={m}>
                            {formatOffset(m)}{" "}
                            {regra.trigger === "reminder_before" ? "antes" : "depois"}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Um separador por destinatário: cada um com o seu texto. */}
                  <div>
                    <div className="grid grid-cols-2 gap-1 rounded-xl bg-ink-100 p-1">
                      {([
                        ["client", "Para o cliente", regra.to_client, IconUser],
                        ["professional", "Para mim", regra.to_professional, IconWhatsapp],
                      ] as const).map(([chave, rotulo, ligado, Icone]) => (
                        <button
                          key={chave}
                          type="button"
                          onClick={() => setFoco(chave)}
                          className={`flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold transition ${
                            foco === chave ? "bg-white text-ink-900 shadow-sm" : "text-ink-500"
                          }`}
                        >
                          <Icone className="h-4 w-4" />
                          {rotulo}
                          {ligado && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
                        </button>
                      ))}
                    </div>

                    <label className="mt-3 flex cursor-pointer items-center gap-2.5 text-sm text-ink-700">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                        checked={foco === "client" ? rascunho.to_client : rascunho.to_professional}
                        onChange={(e) =>
                          alterar(
                            foco === "client"
                              ? { to_client: e.target.checked }
                              : { to_professional: e.target.checked },
                          )
                        }
                      />
                      {foco === "client"
                        ? "Enviar este aviso ao cliente"
                        : "Enviar este aviso para o meu WhatsApp"}
                    </label>
                    {foco === "professional" && rascunho.to_professional && (
                      <p className="field-hint">
                        Quando for você a mudar o estado pelo painel, o aviso vai só para o
                        cliente.
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="label" htmlFor={`texto-${regra.trigger}-${foco}`}>
                      {foco === "client"
                        ? "Mensagem que o cliente recebe"
                        : "Mensagem que você recebe"}
                    </label>
                    <textarea
                      id={`texto-${regra.trigger}-${foco}`}
                      className="input min-h-40 resize-y font-mono text-sm"
                      value={rascunho[campoTexto]}
                      onChange={(e) =>
                        alterar({ [campoTexto]: e.target.value } as Partial<NotificationRule>)
                      }
                    />

                    <p className="field-hint mb-2">
                      Toque numa variável para a acrescentar ao fim do texto.
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {dados.variables.map((v) => (
                        <button
                          key={v.name}
                          type="button"
                          onClick={() => inserirVariavel(v)}
                          title={v.description}
                          className="chip bg-white font-mono text-ink-600 ring-ink-200 transition hover:ring-brand-300"
                        >
                          {"{" + v.name + "}"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {previsao && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {([
                        ["O cliente recebe", previsao.client_body, rascunho.to_client],
                        ["Você recebe", previsao.professional_body, rascunho.to_professional],
                      ] as const).map(([titulo, texto, ligado]) => (
                        <div
                          key={titulo}
                          className={`rounded-xl p-4 ${ligado ? "bg-ink-50" : "bg-ink-50/50 opacity-60"}`}
                        >
                          <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                            {titulo}
                            {!ligado && " (desligado)"}
                          </p>
                          <p className="mt-2 whitespace-pre-line text-sm text-ink-700">
                            {texto || "—"}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 border-t border-ink-100 pt-4">
                    <button onClick={guardar} disabled={aGuardar} className="btn-primary btn-sm">
                      {aGuardar ? "A guardar..." : "Guardar"}
                    </button>
                    <button onClick={verComoFica} className="btn-secondary btn-sm">
                      Ver como fica
                    </button>
                    <button onClick={reporTexto} className="btn-ghost btn-sm">
                      Repor os textos originais
                    </button>
                    <button
                      onClick={() => {
                        setAberta(null);
                        setRascunho(null);
                      }}
                      className="btn-ghost btn-sm ml-auto"
                    >
                      Fechar
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
