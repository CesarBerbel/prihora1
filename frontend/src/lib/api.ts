/**
 * Cliente HTTP do prihora.
 *
 * No navegador usamos NEXT_PUBLIC_API_URL (em producao, "/api" atras do nginx).
 * No servidor Next usamos API_INTERNAL_URL, que fala direto com o container.
 */

const BROWSER_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const SERVER_BASE = process.env.API_INTERNAL_URL || BROWSER_BASE;

export const TOKEN_KEY = "prihora.token";

export function apiBase(): string {
  return typeof window === "undefined" ? SERVER_BASE : BROWSER_BASE;
}

function buildUrl(path: string, params?: Record<string, unknown>): string {
  const base = apiBase().replace(/\/+$/, "");
  const prefix = path.startsWith("/api/") ? "" : "/api/v1";
  let url = `${base}${prefix}${path}`;

  if (params) {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === "") continue;
      search.append(key, String(value));
    }
    const qs = search.toString();
    if (qs) url += `?${qs}`;
  }
  return url;
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  params?: Record<string, unknown>;
  auth?: boolean;
  /** Segundos de cache no fetch do servidor. 0 desliga. */
  revalidate?: number;
  signal?: AbortSignal;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, params, auth = false, revalidate, signal } = options;

  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const init: RequestInit & { next?: { revalidate: number } } = {
    method,
    headers,
    signal,
    body: body === undefined ? undefined : JSON.stringify(body),
  };

  if (typeof window === "undefined") {
    if (revalidate && revalidate > 0) init.next = { revalidate };
    else init.cache = "no-store";
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path, params), init);
  } catch {
    throw new ApiError("Não foi possível contactar o servidor. Tente novamente.", 0);
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const payload = text ? safeParse(text) : null;

  if (!response.ok) {
    throw new ApiError(extractDetail(payload) ?? `Erro ${response.status}`, response.status);
  }
  return payload as T;
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function extractDetail(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const detail = (payload as { detail?: unknown }).detail;

  if (typeof detail === "string") return detail;
  // Erros de validacao do FastAPI vem como lista de objetos.
  if (Array.isArray(detail)) {
    const first = detail[0] as { msg?: string; loc?: string[] } | undefined;
    if (first?.msg) {
      const field = first.loc?.slice(-1)[0];
      return field ? `${field}: ${first.msg}` : first.msg;
    }
  }
  return null;
}

/**
 * Envio de arquivo (multipart). Nao passa pelo `request` porque o corpo nao e
 * JSON: o Content-Type precisa ser definido pelo proprio browser, junto com o
 * boundary do multipart.
 */
export async function upload<T>(
  path: string,
  file: Blob,
  options: { field?: string; filename?: string; method?: string } = {},
): Promise<T> {
  const { field = "file", filename = "upload.jpg", method = "POST" } = options;

  const form = new FormData();
  form.append(field, file, filename);

  const headers: Record<string, string> = { Accept: "application/json" };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(buildUrl(path), { method, headers, body: form });
  } catch {
    throw new ApiError("Não foi possível enviar o ficheiro. Tente novamente.", 0);
  }

  const text = await response.text();
  const payload = text ? safeParse(text) : null;

  if (!response.ok) {
    throw new ApiError(extractDetail(payload) ?? `Erro ${response.status}`, response.status);
  }
  return payload as T;
}

/** Resolve uma URL de midia devolvida pela API (ex.: /media/avatars/x.jpg). */
export function mediaUrl(path?: string | null): string | null {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;

  const base = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/+$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export const api = {
  get: <T,>(path: string, options: Omit<RequestOptions, "method" | "body"> = {}) =>
    request<T>(path, { ...options, method: "GET" }),
  post: <T,>(path: string, body?: unknown, options: RequestOptions = {}) =>
    request<T>(path, { ...options, method: "POST", body }),
  put: <T,>(path: string, body?: unknown, options: RequestOptions = {}) =>
    request<T>(path, { ...options, method: "PUT", body }),
  patch: <T,>(path: string, body?: unknown, options: RequestOptions = {}) =>
    request<T>(path, { ...options, method: "PATCH", body }),
  delete: <T,>(path: string, options: RequestOptions = {}) =>
    request<T>(path, { ...options, method: "DELETE" }),
};
