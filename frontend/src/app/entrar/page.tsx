"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { IconSparkles } from "@/components/Icons";
import { ApiError } from "@/lib/api";
import { homeForRole, useSession } from "@/lib/auth";

function LoginForm() {
  const { login, user, loading: checkingSession } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");

  // Sessao ativa: vai direto para o painel em vez de pedir login de novo.
  useEffect(() => {
    if (!checkingSession && user) router.replace(next || homeForRole(user.role));
  }, [checkingSession, user, next, router]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await login(email, password);
      router.replace(next || homeForRole(data.user.role));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível entrar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
      )}

      <div>
        <label className="label" htmlFor="email">
          E-mail
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          className="input"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="você@email.com"
        />
      </div>

      <div>
        <label className="label" htmlFor="password">
          Palavra-passe
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          className="input"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Sua palavra-passe"
        />
      </div>

      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? "A entrar..." : "Entrar"}
      </button>
    </form>
  );
}

export default function EntrarPage() {
  return (
    <div className="container-page flex min-h-[70vh] items-center justify-center py-12">
      <div className="w-full max-w-md">
        <div className="text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-brand-600 text-white">
            <IconSparkles className="h-6 w-6" />
          </span>
          <h1 className="mt-4 text-2xl font-bold tracking-tight">Entrar no prihora</h1>
          <p className="mt-1.5 text-sm text-ink-500">
            Entre no seu painel, agenda e histórico de atendimentos.
          </p>
        </div>

        <div className="card mt-8 p-6 sm:p-8">
          <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-ink-100" />}>
            <LoginForm />
          </Suspense>

          {/* A mesma porta de entrada serve os dois lados: a criacao de conta e
              que se separa, conforme quem esta a chegar. */}
          <div className="mt-6 space-y-1 text-center text-sm text-ink-500">
            <p>
              Ainda não tem conta?{" "}
              <Link href="/cadastro" className="font-semibold text-brand-600 hover:text-brand-700">
                Criar conta de cliente
              </Link>
            </p>
            <p>
              É profissional?{" "}
              <Link
                href="/para-profissionais/registo"
                className="font-semibold text-brand-600 hover:text-brand-700"
              >
                Registar o meu trabalho
              </Link>
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-ink-200 bg-white/60 p-4 text-xs text-ink-500">
          <p className="font-semibold text-ink-700">Contas de demonstração</p>
          <ul className="mt-2 space-y-1">
            <li>Admin: admin@prihora.pt / admin123</li>
            <li>Profissional: ana.sousa@prihora.pt / demo123</li>
            <li>Cliente: cliente@prihora.pt / demo123</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
