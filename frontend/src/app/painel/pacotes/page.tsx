"use client";

/**
 * Pacotes de serviços, e o saldo de quem os comprou.
 *
 * Há dois feitios, e a diferença entre eles é como se consomem — não o
 * tamanho:
 *
 *  - **Sessões**: o mesmo serviço várias vezes. Fica um saldo que o cliente
 *    vai gastando ao longo dos meses, marcando quando lhe der jeito.
 *  - **Combinado**: serviços diferentes na mesma sessão, de seguida. Um
 *    atendimento só, mais longo.
 *
 * A página tem os dois lados: a tabela do que se vende, e a lista do que já
 * foi vendido com quanto resta a cada um.
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import DashboardShell from "@/components/DashboardShell";
import Modal from "@/components/Modal";
import { IconCheck, IconClock, IconTrash } from "@/components/Icons";
import { PANEL_NAV } from "@/components/PanelNav";
import { ApiError, api } from "@/lib/api";
import { formatDate, formatDuration, formatMoney } from "@/lib/format";
import type { Client, Paged, PackageKind, PackageSale, Service, ServicePackage } from "@/lib/types";

const VAZIO = {
  name: "",
  description: "",
  kind: "sessions" as PackageKind,
  price: "",
  sessions: 5,
  validity_days: 180,
  is_active: true,
  service_ids: [] as number[],
};

const ESTADO_ESTILO: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  used: "bg-ink-100 text-ink-600 ring-ink-200",
  expired: "bg-amber-50 text-amber-800 ring-amber-200",
  cancelled: "bg-rose-50 text-rose-700 ring-rose-200",
};

const ESTADO_ROTULO: Record<string, string> = {
  active: "Em uso",
  used: "Esgotado",
  expired: "Expirado",
  cancelled: "Cancelado",
};

export default function PacotesPage() {
  const [pacotes, setPacotes] = useState<ServicePackage[]>([]);
  const [vendas, setVendas] = useState<PackageSale[]>([]);
  const [servicos, setServicos] = useState<Service[]>([]);
  const [clientes, setClientes] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [aba, setAba] = useState<"catalogo" | "vendidos">("catalogo");
  const [mensagem, setMensagem] = useState<{ kind: "ok" | "erro"; text: string } | null>(null);

  const [aEditar, setAEditar] = useState<ServicePackage | null>(null);
  const [aCriar, setACriar] = useState(false);
  const [aVender, setAVender] = useState<ServicePackage | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const [ps, vs, ss, cs] = await Promise.all([
        api.get<ServicePackage[]>("/me/packages", { auth: true }),
        api.get<PackageSale[]>("/me/package-sales", { auth: true }),
        api.get<Service[]>("/me/services", { auth: true }),
        api.get<Paged<Client>>("/me/clients", { params: { per_page: 100 }, auth: true }),
      ]);
      setPacotes(ps);
      setVendas(vs);
      setServicos(ss.filter((s) => s.is_active));
      setClientes(cs.items);
    } catch (err) {
      setMensagem({
        kind: "erro",
        text: err instanceof ApiError ? err.message : "Não foi possível carregar.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function apagar(pacote: ServicePackage) {
    try {
      const { detail } = await api.delete<{ detail: string }>(`/me/packages/${pacote.id}`, {
        auth: true,
      });
      setMensagem({ kind: "ok", text: detail });
      await carregar();
    } catch (err) {
      setMensagem({
        kind: "erro",
        text: err instanceof ApiError ? err.message : "Não foi possível remover.",
      });
    }
  }

  const emUso = vendas.filter((v) => v.available).length;

  return (
    <DashboardShell
      title="Pacotes"
      subtitle="Venda várias sessões de uma vez, ou um combinado feito numa só."
      nav={PANEL_NAV}
      allow={["professional"]}
      actions={
        <button onClick={() => setACriar(true)} className="btn-primary btn-sm">
          Novo pacote
        </button>
      }
    >
      {mensagem && (
        <p
          className={`mb-5 rounded-xl px-4 py-3 text-sm ${
            mensagem.kind === "ok"
              ? "bg-emerald-50 text-emerald-800"
              : "bg-rose-50 text-rose-700"
          }`}
        >
          {mensagem.text}
        </p>
      )}

      <div className="mb-5 flex items-center gap-1 rounded-full bg-ink-100 p-1 sm:w-fit">
        {[
          { id: "catalogo" as const, label: `O que vendo (${pacotes.length})` },
          { id: "vendidos" as const, label: `Vendidos (${emUso} em uso)` },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => setAba(item.id)}
            className={`flex-1 rounded-full px-4 py-1.5 text-sm font-semibold transition sm:flex-none ${
              aba === item.id ? "bg-white text-ink-900 shadow-sm" : "text-ink-500"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="h-64 animate-pulse rounded-xl2 bg-ink-100" />
      ) : aba === "catalogo" ? (
        pacotes.length === 0 ? (
          <Vazio
            titulo="Ainda sem pacotes"
            texto="Um pacote junta sessões repetidas ou serviços que fazem sentido juntos, por um preço melhor que o avulso."
            accao={() => setACriar(true)}
          />
        ) : (
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {pacotes.map((pacote) => (
              <li key={pacote.id} className={`card flex flex-col p-5 ${pacote.is_active ? "" : "opacity-60"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold text-ink-900">{pacote.name}</h3>
                    <span className="chip mt-1 bg-ink-100 text-ink-600 ring-ink-200">
                      {pacote.kind === "sessions"
                        ? `${pacote.sessions} sessões`
                        : `${pacote.services.length} serviços numa sessão`}
                    </span>
                  </div>
                  {!pacote.is_active && (
                    <span className="chip bg-ink-100 text-ink-500 ring-ink-200">Inativo</span>
                  )}
                </div>

                {pacote.description && (
                  <p className="mt-2 line-clamp-2 text-sm text-ink-500">{pacote.description}</p>
                )}

                <ul className="mt-3 space-y-1">
                  {pacote.services.map((servico) => (
                    <li key={servico.id} className="flex items-start gap-1.5 text-sm text-ink-600">
                      <IconCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" />
                      {servico.name}
                    </li>
                  ))}
                </ul>

                <div className="mt-4 flex items-baseline gap-2 border-t border-ink-100 pt-4">
                  <span className="text-2xl font-bold tracking-tight">
                    {formatMoney(pacote.price_cents)}
                  </span>
                  {pacote.savings_cents > 0 && (
                    <span className="text-xs text-ink-400">
                      <s>{formatMoney(pacote.retail_cents)}</s>{" "}
                      <span className="font-semibold text-emerald-700">
                        poupa {formatMoney(pacote.savings_cents)}
                      </span>
                    </span>
                  )}
                </div>

                <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-ink-400">
                  <span className="inline-flex items-center gap-1">
                    <IconClock className="h-3 w-3" />
                    {pacote.kind === "combo"
                      ? `${formatDuration(pacote.duration_min)} de sessão`
                      : `${formatDuration(pacote.duration_min)} cada`}
                  </span>
                  {pacote.validity_days > 0 && <span>válido {pacote.validity_days} dias</span>}
                  {pacote.sold_count > 0 && <span>{pacote.sold_count} vendidos</span>}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => setAVender(pacote)}
                    disabled={!pacote.is_active}
                    className="btn-primary btn-sm flex-1 disabled:opacity-50"
                  >
                    Vender
                  </button>
                  <button onClick={() => setAEditar(pacote)} className="btn-secondary btn-sm">
                    Editar
                  </button>
                  <button
                    onClick={() => void apagar(pacote)}
                    aria-label={`Remover ${pacote.name}`}
                    className="btn-ghost btn-sm text-ink-400 hover:bg-rose-50 hover:text-rose-600"
                  >
                    <IconTrash className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )
      ) : vendas.length === 0 ? (
        <Vazio
          titulo="Nenhum pacote vendido"
          texto="Depois de vender um pacote a uma cliente, o saldo dela aparece aqui — e pode marcá-lo pelo calendário sem cobrar de novo."
        />
      ) : (
        <ul className="space-y-3">
          {vendas.map((venda) => (
            <li key={venda.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-ink-900">{venda.client_name}</h3>
                    <span className={`chip ${ESTADO_ESTILO[venda.status]}`}>
                      {ESTADO_ROTULO[venda.status]}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-ink-600">{venda.package_name}</p>
                  <p className="mt-0.5 text-xs text-ink-400">
                    Vendido a {formatDate(venda.created_at)} por {formatMoney(venda.price_cents)}
                    {venda.expires_on && ` · válido até ${formatDate(venda.expires_on)}`}
                  </p>
                  {venda.unavailable_reason && (
                    <p className="mt-2 text-xs text-amber-700">{venda.unavailable_reason}</p>
                  )}
                </div>

                <div className="shrink-0 text-right">
                  <p className="text-2xl font-bold tracking-tight text-ink-900">
                    {venda.sessions_left}
                    <span className="text-sm font-normal text-ink-400">
                      /{venda.sessions_total}
                    </span>
                  </p>
                  <p className="text-xs text-ink-400">
                    {venda.sessions_left === 1 ? "sessão por usar" : "sessões por usar"}
                  </p>
                </div>
              </div>

              {/* O saldo, à vista: um traço cheio é um pacote gasto. */}
              <div className="mt-3 flex gap-1">
                {Array.from({ length: venda.sessions_total }, (_, i) => (
                  <span
                    key={i}
                    className={`h-1.5 flex-1 rounded-full ${
                      i < venda.sessions_used ? "bg-ink-300" : "bg-brand-500"
                    }`}
                  />
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}

      {(aCriar || aEditar) && (
        <FormularioPacote
          pacote={aEditar}
          servicos={servicos}
          onFechar={() => {
            setACriar(false);
            setAEditar(null);
          }}
          onFeito={async (texto) => {
            setACriar(false);
            setAEditar(null);
            setMensagem({ kind: "ok", text: texto });
            await carregar();
          }}
        />
      )}

      {aVender && (
        <VenderPacote
          pacote={aVender}
          clientes={clientes}
          onFechar={() => setAVender(null)}
          onFeito={async (texto) => {
            setAVender(null);
            setAba("vendidos");
            setMensagem({ kind: "ok", text: texto });
            await carregar();
          }}
        />
      )}
    </DashboardShell>
  );
}

function Vazio({
  titulo,
  texto,
  accao,
}: {
  titulo: string;
  texto: string;
  accao?: () => void;
}) {
  return (
    <div className="rounded-xl2 border border-dashed border-ink-200 bg-white px-6 py-16 text-center">
      <h2 className="text-lg font-semibold">{titulo}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-ink-500">{texto}</p>
      {accao && (
        <button onClick={accao} className="btn-primary mt-5">
          Criar o primeiro
        </button>
      )}
    </div>
  );
}

function FormularioPacote({
  pacote,
  servicos,
  onFechar,
  onFeito,
}: {
  pacote: ServicePackage | null;
  servicos: Service[];
  onFechar: () => void;
  onFeito: (texto: string) => void;
}) {
  const [form, setForm] = useState(() =>
    pacote
      ? {
          name: pacote.name,
          description: pacote.description ?? "",
          kind: pacote.kind,
          price: (pacote.price_cents / 100).toFixed(2).replace(".", ","),
          sessions: pacote.sessions,
          validity_days: pacote.validity_days,
          is_active: pacote.is_active,
          service_ids: pacote.services.map((s) => s.id),
        }
      : VAZIO,
  );
  const [aGuardar, setAGuardar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const sessoes = form.kind === "sessions";

  /** Quanto custaria à parte — para se ver a poupança enquanto se escreve. */
  const avulso = useMemo(() => {
    const escolhidos = servicos.filter((s) => form.service_ids.includes(s.id));
    if (escolhidos.length === 0) return 0;
    return sessoes
      ? escolhidos[0].price_cents * Math.max(1, form.sessions)
      : escolhidos.reduce((soma, s) => soma + s.price_cents, 0);
  }, [servicos, form.service_ids, form.sessions, sessoes]);

  const precoCents = Math.round((Number(form.price.replace(",", ".")) || 0) * 100);
  const poupa = Math.max(0, avulso - precoCents);

  function alternarServico(id: number) {
    setForm((atual) => {
      // Num pacote de sessões há um serviço só: escolher outro substitui.
      if (atual.kind === "sessions") return { ...atual, service_ids: [id] };
      return {
        ...atual,
        service_ids: atual.service_ids.includes(id)
          ? atual.service_ids.filter((x) => x !== id)
          : [...atual.service_ids, id],
      };
    });
  }

  async function guardar(evento: React.FormEvent) {
    evento.preventDefault();
    setAGuardar(true);
    setErro(null);
    try {
      const corpo = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        kind: form.kind,
        price_cents: precoCents,
        sessions: sessoes ? form.sessions : 1,
        validity_days: form.validity_days,
        is_active: form.is_active,
        service_ids: form.service_ids,
      };
      if (pacote) await api.put(`/me/packages/${pacote.id}`, corpo, { auth: true });
      else await api.post("/me/packages", corpo, { auth: true });
      onFeito(pacote ? "Pacote atualizado." : "Pacote criado.");
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Não foi possível guardar.");
    } finally {
      setAGuardar(false);
    }
  }

  const podeGuardar =
    form.name.trim().length > 1 &&
    precoCents >= 0 &&
    (sessoes ? form.service_ids.length === 1 && form.sessions >= 2 : form.service_ids.length >= 2);

  return (
    <Modal
      title={pacote ? "Editar pacote" : "Novo pacote"}
      subtitle="Escolha o feitio primeiro: é ele que decide o resto."
      onClose={onFechar}
    >
      <form onSubmit={guardar}>
        {erro && <p className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{erro}</p>}

        <fieldset>
          <legend className="label">Feitio do pacote</legend>
          <div className="mt-1 grid gap-3 sm:grid-cols-2">
            {[
              {
                id: "sessions" as const,
                titulo: "Várias sessões",
                texto: "O mesmo serviço, repetido. Fica um saldo que a cliente vai gastando.",
              },
              {
                id: "combo" as const,
                titulo: "Combinado",
                texto: "Serviços diferentes de seguida, tudo numa única sessão.",
              },
            ].map((opcao) => (
              <button
                key={opcao.id}
                type="button"
                onClick={() =>
                  setForm((atual) => ({
                    ...atual,
                    kind: opcao.id,
                    // Trocar de feitio muda o que a escolha de serviços quer
                    // dizer: recomeçar evita ficar com uma seleção inválida.
                    service_ids: [],
                  }))
                }
                className={`rounded-xl border p-3 text-left transition ${
                  form.kind === opcao.id
                    ? "border-brand-500 bg-brand-50"
                    : "border-ink-200 hover:bg-ink-50"
                }`}
              >
                <span className="block text-sm font-semibold text-ink-900">{opcao.titulo}</span>
                <span className="mt-0.5 block text-xs text-ink-500">{opcao.texto}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <div className="mt-5">
          <label className="label" htmlFor="pacote-nome">
            Nome *
          </label>
          <input
            id="pacote-nome"
            className="input"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder={sessoes ? "Ex.: Pack 5 manicures" : "Ex.: Dia completo"}
          />
        </div>

        <div className="mt-4">
          <span className="label">
            {sessoes ? "Que serviço se repete? *" : "Que serviços entram na sessão? *"}
          </span>
          {servicos.length === 0 ? (
            <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Registe primeiro os seus serviços — um pacote junta-os.
            </p>
          ) : (
            <div className="scroll-soft -mx-1 max-h-44 space-y-1 overflow-y-auto px-1 py-1">
              {servicos.map((servico) => {
                const escolhido = form.service_ids.includes(servico.id);
                return (
                  <button
                    key={servico.id}
                    type="button"
                    onClick={() => alternarServico(servico.id)}
                    className={`flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-sm transition ${
                      escolhido ? "border-brand-500 bg-brand-50" : "border-ink-200 hover:bg-ink-50"
                    }`}
                  >
                    <span className="truncate">{servico.name}</span>
                    <span className="shrink-0 text-xs text-ink-400">
                      {formatDuration(servico.duration_min)} · {formatMoney(servico.price_cents)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {sessoes && (
            <div>
              <label className="label" htmlFor="pacote-sessoes">
                Quantas sessões *
              </label>
              <input
                id="pacote-sessoes"
                type="number"
                min={2}
                max={100}
                className="input"
                value={form.sessions}
                onChange={(e) => setForm({ ...form, sessions: Number(e.target.value) })}
              />
            </div>
          )}
          <div>
            <label className="label" htmlFor="pacote-preco">
              Preço do pacote (€) *
            </label>
            <input
              id="pacote-preco"
              className="input"
              inputMode="decimal"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              placeholder="0,00"
            />
          </div>
          <div>
            <label className="label" htmlFor="pacote-validade">
              Validade
            </label>
            <select
              id="pacote-validade"
              className="input"
              value={form.validity_days}
              onChange={(e) => setForm({ ...form, validity_days: Number(e.target.value) })}
            >
              {[0, 30, 60, 90, 180, 365].map((dias) => (
                <option key={dias} value={dias}>
                  {dias === 0 ? "Sem prazo" : `${dias} dias`}
                </option>
              ))}
            </select>
          </div>
        </div>

        {avulso > 0 && (
          <p className="mt-3 rounded-xl bg-ink-50 px-4 py-2.5 text-sm text-ink-600">
            À parte custaria <strong>{formatMoney(avulso)}</strong>.{" "}
            {poupa > 0 ? (
              <span className="font-semibold text-emerald-700">
                A cliente poupa {formatMoney(poupa)}.
              </span>
            ) : (
              <span className="text-amber-700">
                Ao preço que pôs, o pacote não fica mais barato que o avulso.
              </span>
            )}
          </p>
        )}

        <div className="mt-4">
          <label className="label" htmlFor="pacote-descricao">
            Descrição
          </label>
          <textarea
            id="pacote-descricao"
            className="input min-h-20 resize-y"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="O que está incluído, condições, o que quiser explicar."
          />
        </div>

        <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-ink-600">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
            checked={form.is_active}
            onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
          />
          Disponível para venda
        </label>

        <div className="mt-6 flex gap-2">
          <button type="submit" disabled={aGuardar || !podeGuardar} className="btn-primary flex-1">
            {aGuardar ? "A guardar..." : "Guardar pacote"}
          </button>
          <button type="button" onClick={onFechar} className="btn-ghost">
            Cancelar
          </button>
        </div>
      </form>
    </Modal>
  );
}

function VenderPacote({
  pacote,
  clientes,
  onFechar,
  onFeito,
}: {
  pacote: ServicePackage;
  clientes: Client[];
  onFechar: () => void;
  onFeito: (texto: string) => void;
}) {
  const [clientId, setClientId] = useState("");
  const [notas, setNotas] = useState("");
  const [aGuardar, setAGuardar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function vender(evento: React.FormEvent) {
    evento.preventDefault();
    if (!clientId) return;
    setAGuardar(true);
    setErro(null);
    try {
      await api.post(
        "/me/package-sales",
        { package_id: pacote.id, client_id: Number(clientId), notes: notas.trim() || null },
        { auth: true },
      );
      const nome = clientes.find((c) => String(c.id) === clientId)?.name ?? "a cliente";
      onFeito(`${pacote.name} vendido a ${nome}.`);
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Não foi possível registar a venda.");
    } finally {
      setAGuardar(false);
    }
  }

  return (
    <Modal
      title={`Vender ${pacote.name}`}
      subtitle={`${formatMoney(pacote.price_cents)} · ${
        pacote.kind === "sessions" ? `${pacote.sessions} sessões` : "uma sessão combinada"
      }`}
      size="md"
      onClose={onFechar}
    >
      <form onSubmit={vender}>
        {erro && <p className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{erro}</p>}

        <div>
          <label className="label" htmlFor="venda-cliente">
            A quem? *
          </label>
          <select
            id="venda-cliente"
            className="input"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
          >
            <option value="">Escolha na sua lista de clientes</option>
            {clientes.map((cliente) => (
              <option key={cliente.id} value={cliente.id}>
                {cliente.name}
                {cliente.phone ? ` — ${cliente.phone}` : ""}
              </option>
            ))}
          </select>
          <p className="field-hint">
            O pacote fica ligado a uma ficha de cliente — é por ela que o saldo se encontra
            depois, ao marcar.
          </p>
        </div>

        <div className="mt-4">
          <label className="label" htmlFor="venda-notas">
            Notas
          </label>
          <input
            id="venda-notas"
            className="input"
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Como pagou, o que combinaram…"
          />
        </div>

        {pacote.validity_days > 0 && (
          <p className="mt-4 rounded-xl bg-ink-50 px-4 py-2.5 text-xs text-ink-500">
            O saldo expira {pacote.validity_days} dias depois de hoje.
          </p>
        )}

        <div className="mt-6 flex gap-2">
          <button type="submit" disabled={aGuardar || !clientId} className="btn-primary flex-1">
            {aGuardar ? "A registar..." : "Registar venda"}
          </button>
          <button type="button" onClick={onFechar} className="btn-ghost">
            Cancelar
          </button>
        </div>
      </form>
    </Modal>
  );
}
