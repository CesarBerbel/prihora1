"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import DashboardShell from "@/components/DashboardShell";
import { IconCheck, IconPin } from "@/components/Icons";
import { PANEL_NAV } from "@/components/PanelNav";
import { ApiError, api } from "@/lib/api";
import { DISTRICTS } from "@/lib/format";
import { LocalizacaoError, detetarLocalizacao } from "@/lib/geo";
import { computeProgress, type StepId } from "@/lib/onboarding";
import type { Category, ProfessionalPrivate, ServiceSuggestion } from "@/lib/types";

/** Grelhas prontas: a maioria das pessoas cai numa destas. */
const GRELHAS = [
  { id: "uteis", rotulo: "Segunda a sexta, 9h–18h", dias: [0, 1, 2, 3, 4], inicio: "09:00", fim: "18:00" },
  { id: "sabado", rotulo: "Segunda a sábado, 9h–18h", dias: [0, 1, 2, 3, 4, 5], inicio: "09:00", fim: "18:00" },
  { id: "tardes", rotulo: "Segunda a sexta, 13h–20h", dias: [0, 1, 2, 3, 4], inicio: "13:00", fim: "20:00" },
];

export default function ComecarPage() {
  const [profile, setProfile] = useState<ProfessionalPrivate | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [aberto, setAberto] = useState<StepId>("perfil");
  const [aGuardar, setAGuardar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [perfil, setPerfil] = useState({
    display_name: "",
    headline: "",
    bio: "",
    categorias: [] as number[],
  });
  const [local, setLocal] = useState({ city: "", state: "", address_line: "", latitude: "", longitude: "" });
  const [servico, setServico] = useState({ name: "", duration_min: 60, preco: "" });
  const [grelha, setGrelha] = useState(GRELHAS[0].id);
  const [aLocalizar, setALocalizar] = useState(false);
  const [sugestoes, setSugestoes] = useState<ServiceSuggestion[]>([]);
  const [aAdicionar, setAAdicionar] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const dados = await api.get<ProfessionalPrivate>("/me/professional", { auth: true });
    setProfile(dados);

    // Dependem das especialidades escolhidas no primeiro passo.
    api
      .get<ServiceSuggestion[]>("/me/services/suggestions", { auth: true })
      .then(setSugestoes)
      .catch(() => setSugestoes([]));
    setPerfil({
      display_name: dados.display_name ?? "",
      headline: dados.headline ?? "",
      bio: dados.bio ?? "",
      categorias: dados.categories.map((c) => c.id),
    });
    setLocal({
      city: dados.city ?? "",
      state: dados.state ?? "",
      address_line: dados.address_line ?? "",
      latitude: dados.latitude ? String(dados.latitude) : "",
      longitude: dados.longitude ? String(dados.longitude) : "",
    });
    return dados;
  }, []);

  useEffect(() => {
    Promise.all([carregar(), api.get<Category[]>("/categories")])
      .then(([dados, cats]) => {
        setCategories(cats);
        // Abre no primeiro passo por fazer, para não obrigar a procurar.
        const proximo = computeProgress(dados).proximo;
        if (proximo) setAberto(proximo.id);
      })
      .catch(() => setErro("Não foi possível carregar o seu perfil."));
  }, [carregar]);

  const progresso = computeProgress(profile);
  // A localidade diz onde; as coordenadas dizem quao perto. Sem as duas o
  // perfil nao entra na ordenacao por distancia.
  const temMapa = Boolean(local.latitude.trim() && local.longitude.trim());

  async function executar(accao: () => Promise<unknown>, seguinte?: StepId) {
    setAGuardar(true);
    setErro(null);
    try {
      await accao();
      const dados = await carregar();
      const proximo = seguinte ?? computeProgress(dados).proximo?.id;
      if (proximo) setAberto(proximo);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível guardar.");
    } finally {
      setAGuardar(false);
    }
  }

  /** Acrescenta uma sugestão tal como está; o preço afina-se depois. */
  async function adicionarSugestao(s: ServiceSuggestion) {
    setAAdicionar(s.name);
    setErro(null);
    try {
      await api.post(
        "/me/services",
        {
          name: s.name,
          duration_min: s.duration_min,
          price_cents: s.price_cents,
          category_id: s.category_id ?? null,
        },
        { auth: true },
      );
      await carregar();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível acrescentar.");
    } finally {
      setAAdicionar(null);
    }
  }

  function precoEmCentimos(texto: string): number {
    const n = Number.parseFloat(texto.replace(/[^\d,.-]/g, "").replace(",", "."));
    return Number.isFinite(n) ? Math.round(n * 100) : 0;
  }

  async function usarMinhaLocalizacao() {
    setALocalizar(true);
    setErro(null);
    try {
      const l = await detetarLocalizacao();
      // Só se escreve por cima do que o serviço soube responder: um campo que
      // veio vazio não deve apagar o que a pessoa já tinha escrito.
      setLocal((c) => ({
        city: l.city ?? c.city,
        state: l.state ?? c.state,
        address_line: l.address_line ?? c.address_line,
        latitude: String(l.latitude),
        longitude: String(l.longitude),
      }));
    } catch (e) {
      setErro(e instanceof LocalizacaoError ? e.message : "Não foi possível obter a localização.");
    } finally {
      setALocalizar(false);
    }
  }

  const conteudo: Record<StepId, React.ReactNode> = {
    perfil: (
      <div className="space-y-4">
        <div>
          <label className="label" htmlFor="ob-nome">
            Nome público *
          </label>
          <input
            id="ob-nome"
            className="input"
            maxLength={160}
            value={perfil.display_name}
            onChange={(e) => setPerfil({ ...perfil, display_name: e.target.value })}
            placeholder="Ex.: Ana Sousa Nail Designer"
          />
          <p className="field-hint">É o nome que aparece no seu perfil público.</p>
        </div>
        <div>
          <label className="label" htmlFor="ob-headline">
            Frase de destaque
          </label>
          <input
            id="ob-headline"
            className="input"
            maxLength={200}
            value={perfil.headline}
            onChange={(e) => setPerfil({ ...perfil, headline: e.target.value })}
            placeholder="Ex.: Nail designer há 8 anos — gel e fibra de vidro"
          />
        </div>
        <div>
          <label className="label" htmlFor="ob-bio">
            Sobre o seu trabalho *
          </label>
          <textarea
            id="ob-bio"
            className="input min-h-28 resize-y"
            value={perfil.bio}
            onChange={(e) => setPerfil({ ...perfil, bio: e.target.value })}
            placeholder="A sua experiência, as técnicas que domina e como é o seu atendimento."
          />
        </div>
        {categories.length > 0 && (
          <div>
            <span className="label">O que faz</span>
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => {
                const activo = perfil.categorias.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() =>
                      // Forma funcional: ler `perfil` do closure faria o segundo
                        // clique sobrepor-se ao primeiro, porque não há
                        // re-render entre dois cliques seguidos.
                        setPerfil((atual) => ({
                          ...atual,
                          categorias: atual.categorias.includes(c.id)
                            ? atual.categorias.filter((id) => id !== c.id)
                            : [...atual.categorias, c.id],
                        }))
                    }
                    className={`chip transition ${
                      activo
                        ? "bg-brand-600 text-white ring-brand-600"
                        : "bg-white text-ink-600 ring-ink-200 hover:ring-brand-300"
                    }`}
                  >
                    {activo && <IconCheck className="h-3 w-3" />}
                    {c.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <button
          onClick={() =>
            executar(() =>
              api.put(
                "/me/professional",
                {
                  display_name: perfil.display_name.trim() || undefined,
                  headline: perfil.headline,
                  bio: perfil.bio,
                  category_ids: perfil.categorias,
                },
                { auth: true },
              ),
            )
          }
          disabled={aGuardar || !perfil.bio.trim() || !perfil.display_name.trim()}
          className="btn-primary"
        >
          {aGuardar ? "A guardar..." : "Guardar e continuar"}
        </button>
      </div>
    ),

    local: (
      <div className="space-y-4">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={usarMinhaLocalizacao}
            disabled={aLocalizar}
            className="btn-ghost btn-sm text-brand-700"
          >
            <IconPin className="h-3.5 w-3.5" />
            {aLocalizar ? "A localizar..." : "Usar a minha localização"}
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="ob-cidade">
              Localidade *
            </label>
            <input
              id="ob-cidade"
              className="input"
              value={local.city}
              onChange={(e) => setLocal({ ...local, city: e.target.value })}
              placeholder="Braga"
            />
          </div>
          <div>
            <label className="label" htmlFor="ob-distrito">
              Distrito
            </label>
            <select
              id="ob-distrito"
              className="input"
              value={local.state}
              onChange={(e) => setLocal({ ...local, state: e.target.value })}
            >
              <option value="">Escolher...</option>
              {DISTRICTS.map((d: string) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="label" htmlFor="ob-morada">
            Morada
          </label>
          <input
            id="ob-morada"
            className="input"
            value={local.address_line}
            onChange={(e) => setLocal({ ...local, address_line: e.target.value })}
            placeholder="Rua, número e andar"
          />
        </div>
        <div className="rounded-xl border border-ink-200 p-4">
          <span className="text-sm font-semibold text-ink-800">Coordenadas</span>

          {/* Nem sempre o navegador acerta, e quem atende noutro sítio que não
              o seu precisa de as poder escrever. */}
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="ob-lat">
                Latitude
              </label>
              <input
                id="ob-lat"
                className="input"
                inputMode="decimal"
                value={local.latitude}
                onChange={(e) => setLocal({ ...local, latitude: e.target.value })}
                placeholder="38.7223"
              />
            </div>
            <div>
              <label className="label" htmlFor="ob-lng">
                Longitude
              </label>
              <input
                id="ob-lng"
                className="input"
                inputMode="decimal"
                value={local.longitude}
                onChange={(e) => setLocal({ ...local, longitude: e.target.value })}
                placeholder="-9.1393"
              />
            </div>
          </div>

          <p className="field-hint">
            {local.latitude && local.longitude
              ? "Guardadas: vai aparecer nas pesquisas por proximidade."
              : "Sem coordenadas só aparece em pesquisas pelo nome da localidade. Pode copiá-las do Google Maps."}
          </p>
        </div>
        <button
          onClick={() =>
            executar(() =>
              api.put(
                "/me/professional",
                {
                  city: local.city,
                  state: local.state || null,
                  address_line: local.address_line || null,
                  latitude: local.latitude ? Number(local.latitude) : null,
                  longitude: local.longitude ? Number(local.longitude) : null,
                },
                { auth: true },
              ),
            )
          }
          disabled={aGuardar || !local.city.trim() || !temMapa}
          className="btn-primary"
        >
          {aGuardar ? "A guardar..." : "Guardar e continuar"}
        </button>

        {!temMapa && (
          <p className="text-xs text-amber-700">
            Falta a localização no mapa. Carregue em <strong>usar a minha localização</strong>{" "}
            ou escreva a latitude e a longitude — sem elas o seu perfil aparece sempre no fim
            das pesquisas por proximidade.
          </p>
        )}
      </div>
    ),

    servicos: (
      <div className="space-y-4">
        {(profile?.services.length ?? 0) > 0 && (
          <ul className="divide-y divide-ink-100 rounded-xl border border-ink-100">
            {profile?.services.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="font-medium text-ink-800">{s.name}</span>
                <span className="text-ink-500">
                  {s.duration_min} min · {(s.price_cents / 100).toFixed(2).replace(".", ",")} €
                </span>
              </li>
            ))}
          </ul>
        )}

        {sugestoes.length > 0 && (
          <div>
            <span className="label">Serviços habituais nas suas especialidades</span>
            <p className="field-hint mb-2">
              Toque para acrescentar. O preço e a duração ficam editáveis depois.
            </p>
            <div className="flex flex-wrap gap-2">
              {sugestoes.map((s) => (
                <button
                  key={s.name}
                  type="button"
                  onClick={() => adicionarSugestao(s)}
                  disabled={aAdicionar !== null}
                  className="group flex items-center gap-2 rounded-xl border border-ink-200 bg-white px-3 py-2 text-left text-sm transition hover:border-brand-300 hover:bg-brand-50 disabled:opacity-50"
                >
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-ink-100 text-ink-500 transition group-hover:bg-brand-600 group-hover:text-white">
                    {aAdicionar === s.name ? "…" : "+"}
                  </span>
                  <span>
                    <span className="block font-medium text-ink-800">{s.name}</span>
                    <span className="block text-xs text-ink-500">
                      {s.duration_min} min ·{" "}
                      {s.price_cents === 0
                        ? "grátis"
                        : `${(s.price_cents / 100).toFixed(2).replace(".", ",")} €`}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="border-t border-ink-100 pt-4">
          <span className="label">Acrescentar à mão</span>
        </div>

        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_110px_120px]">
          <div>
            <label className="label" htmlFor="ob-servico">
              Serviço
            </label>
            <input
              id="ob-servico"
              className="input"
              value={servico.name}
              onChange={(e) => setServico({ ...servico, name: e.target.value })}
              placeholder="Ex.: Manicure simples"
            />
          </div>
          <div>
            <label className="label" htmlFor="ob-duracao">
              Minutos
            </label>
            <input
              id="ob-duracao"
              type="number"
              min={5}
              step={5}
              className="input"
              value={servico.duration_min}
              onChange={(e) => setServico({ ...servico, duration_min: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="label" htmlFor="ob-preco">
              Preço (€)
            </label>
            <input
              id="ob-preco"
              className="input"
              value={servico.preco}
              onChange={(e) => setServico({ ...servico, preco: e.target.value })}
              placeholder="14,00"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() =>
              executar(
                () =>
                  api.post(
                    "/me/services",
                    {
                      name: servico.name,
                      duration_min: servico.duration_min,
                      price_cents: precoEmCentimos(servico.preco),
                    },
                    { auth: true },
                  ).then(() => setServico({ name: "", duration_min: 60, preco: "" })),
                // Fica no mesmo passo: quase toda a gente tem mais do que um serviço.
                "servicos",
              )
            }
            disabled={aGuardar || !servico.name.trim()}
            className="btn-secondary"
          >
            {aGuardar ? "A guardar..." : "Adicionar serviço"}
          </button>

          {(profile?.services.length ?? 0) > 0 && (
            <button onClick={() => setAberto("horarios")} className="btn-primary">
              Continuar
            </button>
          )}
        </div>
        <p className="field-hint">
          Pode afinar descrições e categorias depois, em{" "}
          <Link href="/painel/servicos" className="underline">
            Serviços
          </Link>
          .
        </p>
      </div>
    ),

    horarios: (
      <div className="space-y-4">
        <p className="text-sm text-ink-500">
          Escolha um horário para começar. Depois pode acertar dia a dia.
        </p>
        <div className="space-y-2">
          {GRELHAS.map((g) => (
            <label
              key={g.id}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition ${
                grelha === g.id ? "border-brand-400 bg-brand-50" : "border-ink-200 hover:bg-ink-50"
              }`}
            >
              <input
                type="radio"
                name="grelha"
                className="h-4 w-4 border-ink-300 text-brand-600 focus:ring-brand-500"
                checked={grelha === g.id}
                onChange={() => setGrelha(g.id)}
              />
              <span className="font-medium text-ink-800">{g.rotulo}</span>
            </label>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              const escolhida = GRELHAS.find((g) => g.id === grelha)!;
              return executar(() =>
                api.put(
                  "/me/availability",
                  {
                    items: escolhida.dias.map((weekday) => ({
                      weekday,
                      start_time: `${escolhida.inicio}:00`,
                      end_time: `${escolhida.fim}:00`,
                    })),
                  },
                  { auth: true },
                ),
              );
            }}
            disabled={aGuardar}
            className="btn-primary"
          >
            {aGuardar ? "A guardar..." : "Usar este horário"}
          </button>
        </div>
      </div>
    ),

    publicar: (
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-ink-600">
          Está tudo pronto. Ao publicar, o seu perfil passa a aparecer nas pesquisas e a agenda
          fica aberta para marcações. Pode retirá-lo do ar quando quiser.
        </p>
        {progresso.bloqueado ? (
          <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {profile?.suspension_reason ??
              "O perfil está suspenso. Fale connosco para o reativar."}
          </p>
        ) : (
          <button
            onClick={() =>
              executar(() => api.put("/me/professional", { publish: true }, { auth: true }))
            }
            disabled={aGuardar}
            className="btn-primary"
          >
            {aGuardar ? "A publicar..." : "Publicar o meu perfil"}
          </button>
        )}
      </div>
    ),
  };

  return (
    <DashboardShell
      title="Começar"
      subtitle="Cinco passos até receber a primeira marcação."
      nav={PANEL_NAV}
      allow={["professional"]}
      actions={
        <Link href="/painel" className="btn-ghost btn-sm">
          Ir para o painel
        </Link>
      }
    >
      {erro && (
        <p className="mb-6 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{erro}</p>
      )}

      {!profile ? (
        <div className="h-96 animate-pulse rounded-xl2 bg-ink-100" />
      ) : progresso.completo ? (
        <div className="card p-8 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-600 text-white">
            <IconCheck className="h-6 w-6" />
          </span>
          <h2 className="mt-4 text-xl font-bold">O seu perfil está no ar</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-500">
            Não falta nada. A partir de agora é acompanhar as marcações pelo painel.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Link href="/painel" className="btn-primary">
              Ir para o painel
            </Link>
            <Link href={`/p/${profile.slug}`} className="btn-secondary">
              Ver o meu perfil público
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="card mb-6 p-5">
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="font-semibold text-ink-800">
                {progresso.concluidos} de {progresso.total} passos concluídos
              </span>
              <span className="text-ink-500">{progresso.percentagem}%</span>
            </div>
            <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-ink-100">
              <div
                className="h-full rounded-full bg-brand-600 transition-all"
                style={{ width: `${progresso.percentagem}%` }}
              />
            </div>
          </div>

          <ol className="space-y-3">
            {progresso.steps.map((step, indice) => {
              const activo = aberto === step.id;
              return (
                <li key={step.id} className="card overflow-hidden">
                  <button
                    onClick={() => setAberto(step.id)}
                    className="flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-ink-50/60"
                    aria-expanded={activo}
                  >
                    <span
                      className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold ${
                        step.concluido
                          ? "bg-emerald-600 text-white"
                          : activo
                            ? "bg-brand-600 text-white"
                            : "bg-ink-100 text-ink-500"
                      }`}
                    >
                      {step.concluido ? <IconCheck className="h-4 w-4" /> : indice + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-ink-900">{step.titulo}</span>
                      <span className="block text-sm text-ink-500">{step.resumo}</span>
                    </span>
                    {step.concluido && !activo && (
                      <span className="chip shrink-0 bg-emerald-50 text-emerald-700 ring-emerald-200">
                        Feito
                      </span>
                    )}
                  </button>

                  {activo && (
                    <div className="border-t border-ink-100 px-5 py-5">{conteudo[step.id]}</div>
                  )}
                </li>
              );
            })}
          </ol>

          <p className="mt-6 text-center text-sm text-ink-400">
            Pode sair e voltar quando quiser: o que já guardou fica.
          </p>
        </>
      )}
    </DashboardShell>
  );
}
