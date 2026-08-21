"use client";

/**
 * Criacao de conta. O papel vem fixado pela pagina que monta o formulario —
 * o cliente regista-se do lado do cliente, o profissional do lado dele — para
 * que ninguem acabe com o tipo de conta errado por ter carregado num separador.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { IconCheck, IconSparkles } from "@/components/Icons";
import { ApiError } from "@/lib/api";
import { homeForRole, useSession } from "@/lib/auth";

const VANTAGENS_PROFISSIONAL = [
  "Perfil público com os seus serviços, preços e avaliações",
  "Agenda online que evita horário duplicado sozinha",
  "Aparecer na pesquisa por proximidade da sua região",
  "Começar no plano gratuito, sem cartão",
];

const VANTAGENS_CLIENTE = [
  "Guardar as suas marcações num só sítio",
  "Ver o histórico de quem já o atendeu",
  "Voltar a marcar com dois cliques",
];

export default function SignupForm({ papel }: { papel: "cliente" | "profissional" }) {
  const { register } = useSession();
  const router = useRouter();
  const pro = papel === "profissional";

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    passwordConfirm: "",
    phone: "",
  });

  const naoCoincidem =
    form.passwordConfirm.length > 0 && form.password !== form.passwordConfirm;

  async function submit(event: React.FormEvent) {
    event.preventDefault();

    // A confirmação nunca chega ao servidor: existe só para apanhar um engano
    // ao escrever, antes de a conta ser criada com uma palavra-passe errada.
    if (form.password !== form.passwordConfirm) {
      setError("As palavras-passe não coincidem.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // Só o essencial para criar a conta. O perfil — nome público,
      // especialidades e localidade — fica para o guia de arranque, onde há
      // espaço para explicar cada campo.
      await register({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        phone: form.phone.trim() || null,
        role: pro ? "professional" : "client",
      });
      // Quem acaba de criar um perfil profissional vai para o guia de arranque,
      // e nao para um painel ainda vazio.
      router.replace(pro ? "/painel/comecar" : homeForRole("client"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível criar a conta.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-start">
      <div className="order-2 lg:order-1">
        <div className="card p-6 sm:p-8">
          <form onSubmit={submit} className="space-y-4">
            {error && (
              <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
            )}

            <div>
              <label className="label" htmlFor="nome">
                Nome completo *
              </label>
              <input
                id="nome"
                required
                minLength={2}
                className="input"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="email-cadastro">
                  E-mail *
                </label>
                <input
                  id="email-cadastro"
                  type="email"
                  required
                  className="input"
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                />
              </div>
              <div>
                <label className="label" htmlFor="telefone">
                  Telemóvel
                </label>
                <input
                  id="telefone"
                  className="input"
                  value={form.phone}
                  onChange={(event) => setForm({ ...form, phone: event.target.value })}
                  placeholder="912 345 678"
                />
              </div>
            </div>

            <div>
              <label className="label" htmlFor="senha">
                Palavra-passe *
              </label>
              <input
                id="senha"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                className="input"
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
              />
              <p className="field-hint">Mínimo de 6 caracteres.</p>
            </div>

            <div>
              <label className="label" htmlFor="senha-confirmacao">
                Confirmar palavra-passe *
              </label>
              <input
                id="senha-confirmacao"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                className="input"
                value={form.passwordConfirm}
                onChange={(event) =>
                  setForm({ ...form, passwordConfirm: event.target.value })
                }
              />
              {naoCoincidem && (
                <p className="mt-1 text-xs text-rose-600">
                  As palavras-passe não coincidem.
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || naoCoincidem}
              className="btn-primary w-full"
            >
              {loading ? "A criar conta..." : pro ? "Registar o meu trabalho" : "Criar conta"}
            </button>

            <p className="text-center text-xs text-ink-400">
              Ao continuar aceita os{" "}
              <Link href="/termos" className="underline">
                termos de utilização
              </Link>
              .
            </p>
          </form>

          <p className="mt-6 text-center text-sm text-ink-500">
            Já tem conta?{" "}
            <Link href="/entrar" className="font-semibold text-brand-600 hover:text-brand-700">
              Entrar
            </Link>
          </p>

          {/* A ponte entre os dois lados, para quem entrou pela porta errada. */}
          <p className="mt-2 text-center text-sm text-ink-400">
            {pro ? (
              <>
                Quer apenas marcar para si?{" "}
                <Link href="/cadastro" className="font-semibold text-ink-600 hover:text-brand-700">
                  Criar conta de cliente
                </Link>
              </>
            ) : (
              <>
                É profissional?{" "}
                <Link
                  href="/para-profissionais/registo"
                  className="font-semibold text-ink-600 hover:text-brand-700"
                >
                  Registar o meu trabalho
                </Link>
              </>
            )}
          </p>
        </div>
      </div>

      <aside className="order-1 lg:order-2 lg:sticky lg:top-24">
        <div className="rounded-xl2 bg-ink-950 p-8 text-white">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-600">
            <IconSparkles className="h-5 w-5" />
          </span>
          <h2 className="mt-4 text-xl font-bold">
            {pro ? "A sua agenda a trabalhar por si" : "Marque em poucos cliques"}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-300">
            {pro
              ? "Publique os seus serviços, defina os seus horários e receba marcações sem trocar mensagem."
              : "Encontre profissionais perto de si, veja horários livres e reserve na hora."}
          </p>

          <ul className="mt-6 space-y-2.5">
            {(pro ? VANTAGENS_PROFISSIONAL : VANTAGENS_CLIENTE).map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-ink-200">
                <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-400" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
