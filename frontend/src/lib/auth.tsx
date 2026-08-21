"use client";

/** Sessao do utilizador no navegador, compartilhada via contexto. */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { api, getToken, setToken as persistToken } from "@/lib/api";
import type { AuthResponse, User } from "@/lib/types";

interface Session {
  user: User | null;
  professionalSlug: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthResponse>;
  register: (payload: Record<string, unknown>) => Promise<AuthResponse>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const SessionContext = createContext<Session | null>(null);

/** Painel inicial de cada papel, usado após o login e no registo. */
export function homeForRole(role: User["role"]): string {
  if (role === "admin") return "/admin";
  if (role === "professional") return "/painel";
  return "/minha-conta";
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [professionalSlug, setProfessionalSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const apply = useCallback((data: AuthResponse) => {
    persistToken(data.access_token);
    setUser(data.user);
    setProfessionalSlug(data.professional_slug ?? null);
  }, []);

  const refresh = useCallback(async () => {
    // Sem token guardado não há sessao para conferir: evita um 401 previsivel
    // a cada visita de quem nunca entrou.
    if (!getToken()) {
      setUser(null);
      setProfessionalSlug(null);
      setLoading(false);
      return;
    }
    try {
      const data = await api.get<AuthResponse>("/auth/me", { auth: true });
      apply(data);
    } catch {
      persistToken(null);
      setUser(null);
      setProfessionalSlug(null);
    } finally {
      setLoading(false);
    }
  }, [apply]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await api.post<AuthResponse>("/auth/login", { email, password });
      apply(data);
      return data;
    },
    [apply],
  );

  const register = useCallback(
    async (payload: Record<string, unknown>) => {
      const data = await api.post<AuthResponse>("/auth/register", payload);
      apply(data);
      return data;
    },
    [apply],
  );

  const logout = useCallback(() => {
    persistToken(null);
    setUser(null);
    setProfessionalSlug(null);
  }, []);

  const value = useMemo<Session>(
    () => ({ user, professionalSlug, loading, login, register, logout, refresh }),
    [user, professionalSlug, loading, login, register, logout, refresh],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession precisa estar dentro de <SessionProvider>.");
  }
  return context;
}
