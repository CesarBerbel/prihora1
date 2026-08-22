import enum


class UserRole(str, enum.Enum):
    CLIENT = "client"
    PROFESSIONAL = "professional"
    ADMIN = "admin"


class ProfessionalStatus(str, enum.Enum):
    PENDING = "pending"        # cadastrou, aguardando revisao
    ACTIVE = "active"          # aprovado e visivel
    SUSPENDED = "suspended"    # bloqueado pelo admin
    INACTIVE = "inactive"      # desativado pelo proprio profissional


class BookingStatus(str, enum.Enum):
    PENDING = "pending"        # solicitado pelo cliente
    CONFIRMED = "confirmed"    # confirmado pelo profissional
    COMPLETED = "completed"    # atendimento realizado
    CANCELLED = "cancelled"    # cancelado por qualquer lado
    NO_SHOW = "no_show"        # cliente nao compareceu


class SubscriptionStatus(str, enum.Enum):
    TRIALING = "trialing"
    ACTIVE = "active"
    PAST_DUE = "past_due"
    CANCELLED = "cancelled"


class BillingInterval(str, enum.Enum):
    MONTHLY = "monthly"
    YEARLY = "yearly"


class MessageChannel(str, enum.Enum):
    WHATSAPP = "whatsapp"
    # O e-mail foi retirado, mas o valor fica: há mensagens antigas no
    # histórico que o usam e devem continuar legíveis.
    EMAIL = "email"


class MessageStatus(str, enum.Enum):
    QUEUED = "queued"      # aceite, ainda por sair
    SENT = "sent"          # entregue ao canal
    FAILED = "failed"      # o canal recusou


class NotificationTrigger(str, enum.Enum):
    """Momentos que podem dar origem a uma mensagem automática."""

    BOOKING_REQUESTED = "booking_requested"    # o cliente pediu a marcação
    BOOKING_CONFIRMED = "booking_confirmed"    # o profissional confirmou
    BOOKING_COMPLETED = "booking_completed"    # o atendimento foi feito
    BOOKING_NO_SHOW = "booking_no_show"        # o cliente não compareceu
    BOOKING_CANCELLED = "booking_cancelled"    # a marcação foi cancelada
    REMINDER_BEFORE = "reminder_before"        # lembrete antes do atendimento
    REMINDER_AFTER = "reminder_after"          # seguimento depois do atendimento


class NotificationAudience(str, enum.Enum):
    CLIENT = "client"
    PROFESSIONAL = "professional"


class PackageKind(str, enum.Enum):
    """Como o pacote se consome."""

    # O mesmo serviço, várias vezes: fica um saldo que se gasta ao longo do tempo.
    SESSIONS = "sessions"
    # Serviços diferentes na mesma sessão: um atendimento só, mais longo.
    COMBO = "combo"


class PackageSaleStatus(str, enum.Enum):
    ACTIVE = "active"
    USED = "used"
    EXPIRED = "expired"
    CANCELLED = "cancelled"
