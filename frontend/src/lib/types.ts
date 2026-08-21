export type UserRole = "client" | "professional" | "admin";

export type ProfessionalStatus = "pending" | "active" | "suspended" | "inactive";

export type BookingStatus =
  | "pending"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "no_show";

export type SubscriptionStatus = "trialing" | "active" | "past_due" | "cancelled";

export interface User {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  role: UserRole;
  is_active: boolean;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
  professional_slug?: string | null;
}

export interface Category {
  id: number;
  slug: string;
  name: string;
  description?: string | null;
  icon: string;
  professional_count?: number | null;
}

export interface City {
  id: number;
  name: string;
  state: string;
  slug: string;
  latitude: number;
  longitude: number;
}

export interface Plan {
  id: number;
  slug: string;
  name: string;
  description?: string | null;
  price_cents: number;
  billing_interval: string;
  max_services: number;
  max_photos: number;
  max_bookings_per_month: number;
  featured_listing: boolean;
  online_agenda: boolean;
  analytics: boolean;
  priority_support: boolean;
  trial_days: number;
  is_active: boolean;
  is_default: boolean;
  sort_order: number;
}

export interface Service {
  id: number;
  name: string;
  description?: string | null;
  duration_min: number;
  price_cents: number;
  is_active: boolean;
  category_id?: number | null;
  sort_order: number;
}

export interface Availability {
  id: number;
  weekday: number;
  start_time: string;
  end_time: string;
}

export interface TimeOff {
  id: number;
  starts_at: string;
  ends_at: string;
  reason?: string | null;
}

export interface Review {
  id: number;
  author_name: string;
  rating: number;
  comment?: string | null;
  created_at: string;
}

/** As três camadas do resultado, na ordem em que aparecem. */
export type SearchGroup = "region" | "elsewhere" | "featured";

export interface ProfessionalCard {
  id: number;
  slug: string;
  display_name: string;
  headline?: string | null;
  avatar_url?: string | null;
  city?: string | null;
  state?: string | null;
  neighborhood?: string | null;
  rating_avg: number;
  rating_count: number;
  is_verified: boolean;
  is_featured: boolean;
  serves_at_home: boolean;
  serves_at_studio: boolean;
  categories: Category[];
  distance_km?: number | null;
  price_from_cents?: number | null;
  /** Camada do resultado na pesquisa. */
  group?: SearchGroup;
}

export interface ProfessionalPublic extends ProfessionalCard {
  bio?: string | null;
  cover_url?: string | null;
  public_phone?: string | null;
  whatsapp?: string | null;
  instagram?: string | null;
  address_line?: string | null;
  postal_code?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  home_service_radius_km: number;
  timezone: string;
  min_notice_hours: number;
  max_advance_days: number;
  completed_bookings: number;
  services: Service[];
  availabilities: Availability[];
  created_at: string;
}

export interface ProfessionalPrivate extends ProfessionalPublic {
  user_id: number;
  status: ProfessionalStatus;
  slot_interval_min: number;
  auto_confirm: boolean;
  suspension_reason?: string | null;
  profile_views: number;
  plan?: Plan | null;
}

export interface Slot {
  start: string;
  end: string;
  label: string;
}

export interface DayAgenda {
  date: string;
  weekday: number;
  is_open: boolean;
  slots: Slot[];
}

export interface Agenda {
  professional_slug: string;
  timezone: string;
  service_id?: number | null;
  duration_min: number;
  days: DayAgenda[];
}

export interface Booking {
  id: number;
  code: string;
  professional_id: number;
  service_id?: number | null;
  service_name: string;
  client_name: string;
  client_phone: string;
  client_email?: string | null;
  starts_at: string;
  ends_at: string;
  status: BookingStatus;
  price_cents: number;
  at_home: boolean;
  address_line?: string | null;
  notes?: string | null;
  cancel_reason?: string | null;
  professional_client_id?: number | null;
  created_by_professional?: boolean;
  created_at: string;
  professional_slug?: string | null;
  professional_name?: string | null;
  professional_avatar?: string | null;
}

export interface Client {
  id: number;
  name: string;
  phone?: string | null;
  email?: string | null;
  birth_date?: string | null;
  address_line?: string | null;
  notes?: string | null;
  is_active: boolean;
  created_from_booking: boolean;
  created_at: string;
  bookings_count: number;
  last_visit_at?: string | null;
}

export interface ClientDetail extends Client {
  bookings: Booking[];
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface SearchResult extends Paged<ProfessionalCard> {
  matched_city?: City | null;
  radius_km?: number | null;
  /** true quando nao havia ninguém no raio e a busca foi ampliada. */
  expanded?: boolean;
  /** Distancia do resultado mais proximo, em km. */
  nearest_km?: number | null;
  /** Quantos ha em cada camada. */
  region_total?: number;
  elsewhere_total?: number;
  featured_total?: number;
}

export interface AdminStats {
  total_users: number;
  total_clients: number;
  total_professionals: number;
  professionals_pending: number;
  professionals_active: number;
  professionals_suspended: number;
  total_bookings: number;
  bookings_last_30d: number;
  bookings_by_status: Record<string, number>;
  active_subscriptions: number;
  mrr_cents: number;
  top_categories: { name: string; slug: string; professionals: number }[];
  signups_by_day: { date: string; count: number }[];
}

export interface AdminProfessional {
  id: number;
  slug: string;
  display_name: string;
  email?: string | null;
  city?: string | null;
  state?: string | null;
  status: ProfessionalStatus;
  is_verified: boolean;
  is_featured: boolean;
  rating_avg: number;
  rating_count: number;
  completed_bookings: number;
  services_count: number;
  bookings_count: number;
  plan_name?: string | null;
  subscription_status?: SubscriptionStatus | null;
  suspension_reason?: string | null;
  created_at: string;
}

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  professional_slug?: string | null;
}

export interface AuditLog {
  id: number;
  actor_email?: string | null;
  action: string;
  entity: string;
  entity_id?: string | null;
  detail?: string | null;
  created_at: string;
}

/** Só o WhatsApp continua ativo; "email" existe para o histórico antigo. */
export type MessageChannel = "whatsapp" | "email";
export type MessageStatus = "queued" | "sent" | "failed";

export interface Message {
  id: number;
  channel: MessageChannel;
  recipient: string;
  recipient_name?: string | null;
  subject?: string | null;
  body: string;
  status: MessageStatus;
  error?: string | null;
  professional_client_id?: number | null;
  created_at: string;
  sent_at?: string | null;
}

export interface WhatsappStatus {
  status: string;
  /** Imagem do QR em data URL, válida por cerca de um minuto. */
  qr?: string | null;
  phone_number?: string | null;
  connected_at?: string | null;
  last_error?: string | null;
  messages_sent: number;
  enabled: boolean;
}

export interface ChannelsStatus {
  whatsapp: WhatsappStatus;
}

export type NotificationTrigger =
  | "booking_requested"
  | "booking_confirmed"
  | "booking_completed"
  | "booking_no_show"
  | "booking_cancelled"
  | "reminder_before"
  | "reminder_after";

export interface NotificationRule {
  id: number;
  trigger: NotificationTrigger;
  label: string;
  /** Cada destinatário tem o seu interruptor e o seu texto. */
  to_client: boolean;
  client_body: string;
  to_professional: boolean;
  professional_body: string;
  offset_minutes: number;
  /** Só os lembretes usam o desvio de tempo. */
  uses_offset: boolean;
}

export interface TemplateVariable {
  name: string;
  description: string;
}

export interface RulesResponse {
  rules: NotificationRule[];
  variables: TemplateVariable[];
}

/** O que o cliente receberia se a mudança de estado fosse aplicada. */
export interface StatusChangePreview {
  status: BookingStatus;
  trigger?: string | null;
  trigger_label?: string | null;
  will_notify: boolean;
  recipient_name?: string | null;
  recipient?: string | null;
  subject?: string | null;
  body?: string | null;
  reason?: string | null;
}

/** Serviço de exemplo, pronto a acrescentar com um toque. */
export interface ServiceSuggestion {
  name: string;
  duration_min: number;
  price_cents: number;
  category_id?: number | null;
  category_name?: string | null;
}

// --- financeiro -------------------------------------------------------------

export interface Expense {
  id: number;
  description: string;
  amount_cents: number;
  incurred_on: string;
  category: string;
  recurring: boolean;
  ends_on?: string | null;
  notes?: string | null;
}

/** Um lado da conta: feito ou previsto. */
export interface FinanceLine {
  quantidade: number;
  bruto_cents: number;
  comissao_cents: number;
  liquido_cents: number;
}

export interface FinanceDay {
  dia: string;
  feito_cents: number;
  previsto_cents: number;
}

export interface FinanceSummary {
  ano: number;
  mes: number;
  commission_percent: number;
  feito: FinanceLine;
  previsto: FinanceLine;
  perdido_cents: number;
  perdido_quantidade: number;
  despesas_cents: number;
  despesas_por_categoria: Record<string, number>;
  bruto_total_cents: number;
  comissao_total_cents: number;
  resultado_cents: number;
  resultado_projetado_cents: number;
  dias: FinanceDay[];
  categorias: Record<string, string>;
}
