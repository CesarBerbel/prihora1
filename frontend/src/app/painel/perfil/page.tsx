"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import AvatarUploader from "@/components/AvatarUploader";
import AccountShell from "@/components/AccountShell";
import PlanCard from "@/components/PlanCard";
import { IconCheck } from "@/components/Icons";
import { ApiError, api } from "@/lib/api";
import { PROFESSIONAL_STATUS_LABEL, PROFESSIONAL_STATUS_STYLE, DISTRICTS } from "@/lib/format";
import { LocalizacaoError, detetarLocalizacao } from "@/lib/geo";
import type { Category, ProfessionalPrivate } from "@/lib/types";

export default function PerfilPage() {
  const [profile, setProfile] = useState<ProfessionalPrivate | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "erro"; text: string } | null>(null);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get<ProfessionalPrivate>("/me/professional", { auth: true }),
      api.get<Category[]>("/categories"),
    ])
      .then(([profileData, categoriesData]) => {
        setProfile(profileData);
        setCategories(categoriesData);
        setSelected(profileData.categories.map((item) => item.id));
        setForm({
          display_name: profileData.display_name,
          headline: profileData.headline ?? "",
          bio: profileData.bio ?? "",
          avatar_url: profileData.avatar_url ?? "",
          public_phone: profileData.public_phone ?? "",
          whatsapp: profileData.whatsapp ?? "",
          instagram: profileData.instagram ?? "",
          address_line: profileData.address_line ?? "",
          neighborhood: profileData.neighborhood ?? "",
          city: profileData.city ?? "",
          state: profileData.state ?? "",
          postal_code: profileData.postal_code ?? "",
          latitude: profileData.latitude ?? "",
          longitude: profileData.longitude ?? "",
          serves_at_studio: profileData.serves_at_studio,
          serves_at_home: profileData.serves_at_home,
          home_service_radius_km: profileData.home_service_radius_km,
          slot_interval_min: profileData.slot_interval_min,
          min_notice_hours: profileData.min_notice_hours,
          max_advance_days: profileData.max_advance_days,
          auto_confirm: profileData.auto_confirm,
        });
      })
      .catch(() => setMessage({ kind: "erro", text: "Não foi possível carregar seu perfil." }));
  }, []);

  function set(key: string, value: unknown) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function save(publish?: boolean) {
    setSaving(true);
    setMessage(null);
    try {
      const payload: Record<string, unknown> = {
        ...form,
        category_ids: selected,
        latitude: form.latitude === "" ? null : Number(form.latitude),
        longitude: form.longitude === "" ? null : Number(form.longitude),
      };
      if (publish !== undefined) payload.publish = publish;

      const updated = await api.put<ProfessionalPrivate>("/me/professional", payload, {
        auth: true,
      });
      setProfile(updated);
      setMessage({
        kind: "ok",
        text:
          publish === true
            ? "Perfil publicado! Já aparece nas pesquisas."
            : publish === false
              ? "Perfil despublicado."
              : "Alterações salvas.",
      });
    } catch (error) {
      setMessage({
        kind: "erro",
        text: error instanceof ApiError ? error.message : "Não foi possível guardar.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function usarMinhaLocalizacao() {
    setLocating(true);
    setMessage(null);
    try {
      const l = await detetarLocalizacao();
      // Só se escreve por cima do que veio preenchido: um campo em branco na
      // resposta não deve apagar o que já estava no formulário.
      setForm((atual) => ({
        ...atual,
        latitude: String(l.latitude),
        longitude: String(l.longitude),
        city: l.city ?? atual.city,
        state: l.state ?? atual.state,
        address_line: l.address_line ?? atual.address_line,
        postal_code: l.postal_code ?? atual.postal_code,
      }));
      setMessage({
        kind: "ok",
        text:
          l.source === "nominatim"
            ? "Preenchido a partir da sua localização. Confirme e guarde."
            : "Coordenadas guardadas. A morada não foi encontrada — escreva-a à mão.",
      });
    } catch (e) {
      setMessage({
        kind: "erro",
        text: e instanceof LocalizacaoError ? e.message : "Não foi possível obter a localização.",
      });
    } finally {
      setLocating(false);
    }
  }

  const value = (key: string) => (form[key] as string | number | undefined) ?? "";

  return (
    <AccountShell
      title="Meu perfil"
      subtitle="Estas informações aparecem na sua página pública."
      allow={["professional"]}
      actions={
        profile && (
          <div className="flex items-center gap-2">
            <span className={`chip ${PROFESSIONAL_STATUS_STYLE[profile.status]}`}>
              {PROFESSIONAL_STATUS_LABEL[profile.status]}
            </span>
            <Link href={`/p/${profile.slug}`} className="btn-secondary btn-sm">
              Ver público
            </Link>
          </div>
        )
      }
    >
      {message && (
        <p
          className={`mb-6 rounded-xl px-4 py-3 text-sm ${
            message.kind === "ok"
              ? "bg-emerald-50 text-emerald-800"
              : "bg-rose-50 text-rose-700"
          }`}
        >
          {message.text}
        </p>
      )}

      {!profile ? (
        <div className="h-96 animate-pulse rounded-xl2 bg-ink-100" />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
          <div className="space-y-6">
            {/* ------------------------------------------------ apresentacao --- */}
            <section className="card p-6">
              <h2 className="font-bold">Apresentacao</h2>

              <div className="mt-4 space-y-4">
                <div>
                  <label className="label" htmlFor="display_name">
                    Nome público *
                  </label>
                  <input
                    id="display_name"
                    className="input"
                    value={value("display_name")}
                    onChange={(event) => set("display_name", event.target.value)}
                  />
                  <p className="field-hint">
                    Mudar o nome também muda a morada do seu perfil público.
                  </p>
                </div>

                <div>
                  <label className="label" htmlFor="headline">
                    Frase de destaque
                  </label>
                  <input
                    id="headline"
                    className="input"
                    maxLength={200}
                    value={value("headline")}
                    onChange={(event) => set("headline", event.target.value)}
                    placeholder="Ex.: Nail designer há 8 anos — alongamento em gel"
                  />
                </div>

                <div>
                  <label className="label" htmlFor="bio">
                    Sobre o seu trabalho
                  </label>
                  <textarea
                    id="bio"
                    className="input min-h-32 resize-y"
                    value={value("bio")}
                    onChange={(event) => set("bio", event.target.value)}
                    placeholder="Conte a sua experiência, as técnicas que domina e como é o seu atendimento."
                  />
                </div>

                <AvatarUploader
                  professional={profile}
                  onChange={(updated) => {
                    setProfile(updated);
                    // O upload já persistiu a foto; o formulario aberto não pode
                    // reenviar a URL antiga em um "Guardar alterações" posterior.
                    set("avatar_url", updated.avatar_url ?? "");
                  }}
                />

                <div>
                  <span className="label">Especialidades</span>
                  <div className="flex flex-wrap gap-2">
                    {categories.map((category) => {
                      const active = selected.includes(category.id);
                      return (
                        <button
                          key={category.id}
                          type="button"
                          onClick={() =>
                            setSelected((current) =>
                              active
                                ? current.filter((id) => id !== category.id)
                                : [...current, category.id],
                            )
                          }
                          className={`chip transition ${
                            active
                              ? "bg-brand-600 text-white ring-brand-600"
                              : "bg-white text-ink-600 ring-ink-200 hover:ring-brand-300"
                          }`}
                        >
                          {active && <IconCheck className="h-3 w-3" />}
                          {category.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>

            {/* ---------------------------------------------------- contato --- */}
            <section className="card p-6">
              <h2 className="font-bold">Contato</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="public_phone">
                    Telefone público
                  </label>
                  <input
                    id="public_phone"
                    className="input"
                    value={value("public_phone")}
                    onChange={(event) => set("public_phone", event.target.value)}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="whatsapp">
                    WhatsApp
                  </label>
                  <input
                    id="whatsapp"
                    className="input"
                    value={value("whatsapp")}
                    onChange={(event) => set("whatsapp", event.target.value)}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="label" htmlFor="instagram">
                    Instagram
                  </label>
                  <input
                    id="instagram"
                    className="input"
                    value={value("instagram")}
                    onChange={(event) => set("instagram", event.target.value)}
                    placeholder="seu.utilizador"
                  />
                </div>
              </div>
            </section>

            {/* ------------------------------------------- local e atendimento --- */}
            <section className="card p-6">
              <h2 className="font-bold">Onde você atende</h2>
              <p className="mt-1 text-sm text-ink-500">
                A localização define em quais pesquisas por proximidade você aparece.
              </p>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="label" htmlFor="address_line">
                    Morada
                  </label>
                  <input
                    id="address_line"
                    className="input"
                    value={value("address_line")}
                    onChange={(event) => set("address_line", event.target.value)}
                    placeholder="Rua, número e andar"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="neighborhood">
                    Freguesia
                  </label>
                  <input
                    id="neighborhood"
                    className="input"
                    value={value("neighborhood")}
                    onChange={(event) => set("neighborhood", event.target.value)}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="postal_code">
                    Código postal
                  </label>
                  <input
                    id="postal_code"
                    className="input"
                    value={value("postal_code")}
                    onChange={(event) => set("postal_code", event.target.value)}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="city">
                    Cidade *
                  </label>
                  <input
                    id="city"
                    className="input"
                    value={value("city")}
                    onChange={(event) => set("city", event.target.value)}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="state">
                    Distrito
                  </label>
                  <select
                    id="state"
                    className="input"
                    value={value("state")}
                    onChange={(event) => set("state", event.target.value)}
                  >
                    <option value="">--</option>
                    {DISTRICTS.map((distrito: string) => (
                      <option key={distrito} value={distrito}>
                        {distrito}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label" htmlFor="latitude">
                    Latitude
                  </label>
                  <input
                    id="latitude"
                    className="input"
                    value={value("latitude")}
                    onChange={(event) => set("latitude", event.target.value)}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="longitude">
                    Longitude
                  </label>
                  <input
                    id="longitude"
                    className="input"
                    value={value("longitude")}
                    onChange={(event) => set("longitude", event.target.value)}
                  />
                </div>

                <div className="sm:col-span-2">
                  <button
                    type="button"
                    onClick={usarMinhaLocalizacao}
                    disabled={locating}
                    className="btn-secondary btn-sm"
                  >
                    {locating ? "A localizar..." : "Usar a minha localização"}
                  </button>
                  <p className="field-hint">
                    Sem coordenadas, só aparece em pesquisas pelo nome da localidade.
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-2 border-t border-ink-100 pt-5">
                <label className="flex cursor-pointer items-center gap-2.5 text-sm text-ink-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                    checked={Boolean(form.serves_at_studio)}
                    onChange={(event) => set("serves_at_studio", event.target.checked)}
                  />
                  Atendo no meu espaco / estúdio
                </label>
                <label className="flex cursor-pointer items-center gap-2.5 text-sm text-ink-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                    checked={Boolean(form.serves_at_home)}
                    onChange={(event) => set("serves_at_home", event.target.checked)}
                  />
                  Atendo ao domicílio
                </label>

                {Boolean(form.serves_at_home) && (
                  <div className="pt-2">
                    <label className="label" htmlFor="raio">
                      Raio de atendimento ao domicílio (km)
                    </label>
                    <input
                      id="raio"
                      type="number"
                      min={1}
                      max={200}
                      className="input max-w-40"
                      value={value("home_service_radius_km")}
                      onChange={(event) =>
                        set("home_service_radius_km", Number(event.target.value))
                      }
                    />
                  </div>
                )}
              </div>
            </section>

            {/* --------------------------------------- preferências de agenda --- */}
            <section className="card p-6">
              <h2 className="font-bold">Preferências de agenda</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="label" htmlFor="slot_interval_min">
                    Intervalo entre horários
                  </label>
                  <select
                    id="slot_interval_min"
                    className="input"
                    value={value("slot_interval_min")}
                    onChange={(event) => set("slot_interval_min", Number(event.target.value))}
                  >
                    {[15, 20, 30, 45, 60].map((minutes) => (
                      <option key={minutes} value={minutes}>
                        {minutes} minutos
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="min_notice_hours">
                    Antecedência mínima
                  </label>
                  <select
                    id="min_notice_hours"
                    className="input"
                    value={value("min_notice_hours")}
                    onChange={(event) => set("min_notice_hours", Number(event.target.value))}
                  >
                    {[0, 1, 2, 4, 8, 12, 24, 48].map((hours) => (
                      <option key={hours} value={hours}>
                        {hours === 0 ? "Sem mínimo" : `${hours} horas`}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="max_advance_days">
                    Agenda aberta por
                  </label>
                  <select
                    id="max_advance_days"
                    className="input"
                    value={value("max_advance_days")}
                    onChange={(event) => set("max_advance_days", Number(event.target.value))}
                  >
                    {[7, 14, 30, 60, 90, 180].map((days) => (
                      <option key={days} value={days}>
                        {days} dias
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-sm text-ink-700">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                  checked={Boolean(form.auto_confirm)}
                  onChange={(event) => set("auto_confirm", event.target.checked)}
                />
                <span>
                  Confirmar marcações automaticamente
                  <span className="block text-xs text-ink-400">
                    Sem isso, cada reserva fica a aguardar a sua confirmação.
                  </span>
                </span>
              </label>
            </section>
          </div>

          {/* ------------------------------------------------------ ações --- */}
          <aside className="space-y-4 lg:sticky lg:top-24">
            <div className="card p-6">
              <h2 className="font-bold">Publicacao</h2>
              <p className="mt-2 text-sm text-ink-500">
                {profile.status === "active"
                  ? "O seu perfil esta visível e recebendo marcações."
                  : profile.status === "suspended"
                    ? "Perfil suspenso pela administracao."
                    : "O seu perfil ainda não esta visível para os clientes."}
              </p>

              <div className="mt-4 space-y-2">
                <button
                  onClick={() => save()}
                  disabled={saving}
                  className="btn-primary w-full"
                >
                  {saving ? "A guardar..." : "Guardar alterações"}
                </button>

                {profile.status !== "suspended" &&
                  (profile.status === "active" ? (
                    <button
                      onClick={() => save(false)}
                      disabled={saving}
                      className="btn-secondary w-full"
                    >
                      Despublicar perfil
                    </button>
                  ) : (
                    <button
                      onClick={() => save(true)}
                      disabled={saving}
                      className="btn-secondary w-full"
                    >
                      Publicar perfil
                    </button>
                  ))}
              </div>

              <p className="field-hint mt-3">
                Para publicar e preciso ter cidade, ao menos um serviço ativo e um horário de
                atendimento.
              </p>
            </div>

            <PlanCard />
          </aside>
        </div>
      )}
    </AccountShell>
  );
}
