import { mediaUrl } from "@/lib/api";

export { CURRENCY, LOCALE, formatMoney, formatPrice, formatPriceShort } from "@/lib/money";
export { instagramHandle, instagramUrl, whatsappLink } from "@/lib/social";
import { LOCALE } from "@/lib/money";

export const WEEKDAYS = [
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
  "Domingo",
];

export const WEEKDAYS_SHORT = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (rest === 0) return `${hours}h`;
  return `${hours}h${String(rest).padStart(2, "0")}`;
}

export function formatDistance(km?: number | null): string | null {
  if (km === null || km === undefined) return null;
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1).replace(".", ",")} km`;
}

/** Data e hora no fuso do navegador (ou o informado). */
export function formatDateTime(iso: string, timeZone?: string): string {
  return new Date(iso).toLocaleString(LOCALE, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  });
}

export function formatDate(iso: string, timeZone?: string): string {
  return new Date(iso).toLocaleDateString(LOCALE, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone,
  });
}

export function formatTime(iso: string, timeZone?: string): string {
  return new Date(iso).toLocaleTimeString(LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  });
}

export function formatDayLabel(isoDate: string): string {
  // isoDate vem como YYYY-MM-DD; montamos local para nao deslocar o dia.
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString(LOCALE, { day: "2-digit", month: "short" });
}

export function relativeDay(isoDate: string): string | null {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((date.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return "Hoje";
  if (diff === 1) return "Amanhã";
  return null;
}

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * Foto do profissional, com fallback para um avatar de iniciais.
 *
 * As fotos enviadas ficam em /media/..., um caminho relativo. Em producao isso
 * ja resolve sozinho (nginx serve tudo na mesma origem), mas em desenvolvimento
 * o site esta na 3000 e a API na 8000 — por isso passamos pelo mediaUrl.
 */
export function avatarUrl(name: string, url?: string | null): string {
  const resolved = mediaUrl(url);
  if (resolved) return resolved;

  const seed = encodeURIComponent(name);
  return `https://ui-avatars.com/api/?name=${seed}&background=fecdda&color=881342&size=256&bold=true`;
}

export const BOOKING_STATUS_LABEL: Record<string, string> = {
  pending: "A aguardar confirmação",
  confirmed: "Confirmada",
  completed: "Concluída",
  cancelled: "Cancelada",
  no_show: "Não compareceu",
};

export const BOOKING_STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-50 text-amber-800 ring-amber-200",
  confirmed: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  completed: "bg-sky-50 text-sky-800 ring-sky-200",
  cancelled: "bg-ink-100 text-ink-600 ring-ink-200",
  no_show: "bg-rose-50 text-rose-800 ring-rose-200",
};

export const PROFESSIONAL_STATUS_LABEL: Record<string, string> = {
  pending: "A aguardar aprovação",
  active: "Ativo",
  suspended: "Suspenso",
  inactive: "Inativo",
};

export const PROFESSIONAL_STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-50 text-amber-800 ring-amber-200",
  active: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  suspended: "bg-rose-50 text-rose-800 ring-rose-200",
  inactive: "bg-ink-100 text-ink-600 ring-ink-200",
};

/** Distritos de Portugal e regioes autonomas, para o formulario de perfil. */
export const DISTRICTS = [
  "Aveiro", "Beja", "Braga", "Bragança", "Castelo Branco", "Coimbra",
  "Évora", "Faro", "Guarda", "Leiria", "Lisboa", "Portalegre", "Porto",
  "Santarém", "Setúbal", "Viana do Castelo", "Vila Real", "Viseu",
  "Açores", "Madeira",
];

/** Indicativo de Portugal, usado nas ligacoes para o WhatsApp. */
export const COUNTRY_CODE = "351";
const NATIONAL_LENGTH = 9;

/** Numero em digitos, sem indicativo: a forma canonica para comparar. */
export function phoneDigits(phone?: string | null): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.startsWith("00" + COUNTRY_CODE)) return digits.slice(2 + COUNTRY_CODE.length);
  if (digits.startsWith(COUNTRY_CODE) && digits.length > NATIONAL_LENGTH) {
    return digits.slice(COUNTRY_CODE.length);
  }
  return digits;
}

/** Apresentacao portuguesa: tres grupos de tres digitos, "912 345 678". */
export function formatPhone(phone?: string | null): string {
  const digits = phoneDigits(phone);
  if (digits.length !== NATIONAL_LENGTH) return phone ?? "";
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
}

/** Ligacao para o WhatsApp, sempre com o indicativo do pais. */

export const MESSAGE_STATUS_LABEL: Record<string, string> = {
  queued: "Na fila",
  sent: "Enviada",
  failed: "Falhou",
};

export const MESSAGE_STATUS_STYLE: Record<string, string> = {
  queued: "bg-amber-50 text-amber-800 ring-amber-200",
  sent: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  failed: "bg-rose-50 text-rose-700 ring-rose-200",
};

/** Como está a ligação de WhatsApp, em palavras. */
export const WHATSAPP_STATUS_LABEL: Record<string, string> = {
  disconnected: "Desligado",
  connecting: "A ligar...",
  qr: "À espera da leitura do código",
  connected: "Ligado",
  unavailable: "Serviço indisponível",
};

/** "2 horas", "1 dia" — o desvio dos lembretes em linguagem corrente. */
export function formatOffset(minutes: number): string {
  if (minutes < 60) return `${minutes} minutos`;
  if (minutes < 1440) {
    const horas = Math.round(minutes / 60);
    return horas === 1 ? "1 hora" : `${horas} horas`;
  }
  const dias = Math.round(minutes / 1440);
  return dias === 1 ? "1 dia" : `${dias} dias`;
}
