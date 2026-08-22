from datetime import date, datetime

from pydantic import BaseModel, EmailStr, Field, model_validator

from app.models.enums import BookingStatus
from app.schemas.common import ORMModel


class SlotOut(BaseModel):
    """Um horario livre na agenda publica."""

    start: datetime
    end: datetime
    label: str  # "09:30" no fuso do profissional


class DayAgenda(BaseModel):
    date: date
    weekday: int
    is_open: bool
    slots: list[SlotOut] = []


class AgendaOut(BaseModel):
    professional_slug: str
    timezone: str
    service_id: int | None = None
    duration_min: int
    days: list[DayAgenda]


class BookingCreate(BaseModel):
    service_id: int
    starts_at: datetime
    client_name: str = Field(min_length=2, max_length=160)
    client_phone: str = Field(min_length=8, max_length=32)
    client_email: EmailStr | None = None
    at_home: bool = False
    address_line: str | None = Field(default=None, max_length=255)
    notes: str | None = Field(default=None, max_length=1000)


class InternalBookingCreate(BaseModel):
    """Lancamento feito pelo profissional no painel.

    Diferente da agenda publica, aceita horario fora do expediente e por cima
    de bloqueios. A unica trava e nao ocupar o mesmo horario duas vezes.
    """

    starts_at: datetime
    # Um servico do catalogo, ou os campos avulsos abaixo para um encaixe.
    service_id: int | None = None
    service_name: str | None = Field(default=None, max_length=160)
    duration_min: int | None = Field(default=None, ge=5, le=600)
    price_cents: int | None = Field(default=None, ge=0)

    # Ficha ja cadastrada, ou os dados para abrir uma nova.
    client_id: int | None = None
    client_name: str | None = Field(default=None, max_length=160)
    client_phone: str | None = Field(default=None, max_length=32)
    client_email: EmailStr | None = None
    save_client: bool = True

    # Gastar uma sessão de um pacote já vendido. Quando vem preenchido, o
    # serviço, a duração e o preço saem do pacote — não se cobra outra vez o
    # que já foi pago.
    package_sale_id: int | None = None

    status: BookingStatus = BookingStatus.CONFIRMED
    at_home: bool = False
    address_line: str | None = Field(default=None, max_length=255)
    notes: str | None = Field(default=None, max_length=1000)

    @model_validator(mode="after")
    def validar(self) -> "InternalBookingCreate":
        # Com pacote, o serviço vem de lá: a validação abaixo não se aplica.
        if self.package_sale_id is not None:
            if self.client_id is None:
                raise ValueError("Um pacote pertence a um cliente da sua lista.")
            return self
        if self.service_id is None:
            if not (self.service_name and self.service_name.strip()):
                raise ValueError("Escolha um serviço do catálogo ou indique o nome do atendimento.")
            if not self.duration_min:
                raise ValueError("Indique a duração do atendimento.")
        if self.client_id is None and not (self.client_name and self.client_name.strip()):
            raise ValueError("Escolha um cliente da sua lista ou indique o nome.")
        if self.at_home and not (self.address_line and self.address_line.strip()):
            raise ValueError("Indique a morada para o atendimento ao domicílio.")
        return self


class BookingOut(ORMModel):
    id: int
    code: str
    professional_id: int
    service_id: int | None = None
    service_name: str
    client_name: str
    client_phone: str
    client_email: str | None = None
    starts_at: datetime
    ends_at: datetime
    status: BookingStatus
    price_cents: int
    at_home: bool
    address_line: str | None = None
    notes: str | None = None
    cancel_reason: str | None = None
    professional_client_id: int | None = None
    # De que saldo saiu, quando saiu de um: o preço a zero de uma marcação
    # paga por pacote não é o mesmo zero de uma cortesia.
    package_sale_id: int | None = None
    created_by_professional: bool = False
    created_at: datetime


class BookingLookup(BookingOut):
    """O que a consulta pelo código mostra a quem marcou sem conta.

    Traz a política já decidida — se pode mudar, até quando e porquê não — em
    vez de a mandar calcular ao ecrã. A regra do prazo é do servidor; se a
    página a repetisse, as duas versões acabariam por divergir.
    """

    professional_slug: str | None = None
    professional_name: str | None = None
    professional_whatsapp: str | None = None

    can_change: bool = False
    change_blocked_reason: str | None = None
    change_deadline: datetime | None = None
    cancel_notice_hours: int = 0

    # A mensagem de conclusão convida a avaliar e traz esta ligação: a página
    # tem de saber se o convite ainda está de pé.
    can_review: bool = False
    already_reviewed: bool = False


class BookingReschedule(BaseModel):
    starts_at: datetime


class BookingWithProfessional(BookingOut):
    professional_slug: str | None = None
    professional_name: str | None = None
    professional_avatar: str | None = None
    # O convite para avaliar tem de desaparecer depois de avaliada.
    already_reviewed: bool = False


class BookingStatusUpdate(BaseModel):
    status: BookingStatus
    cancel_reason: str | None = Field(default=None, max_length=255)
    # Avisar o cliente desta mudança? A interface pergunta antes de aplicar;
    # nulo significa "usar o que estiver configurado no gatilho".
    notify: bool | None = None


class StatusChangePreview(BaseModel):
    """O que sairia se esta mudança de estado fosse aplicada agora."""

    status: BookingStatus
    trigger: str | None = None
    trigger_label: str | None = None
    will_notify: bool
    channels: list[str] = []
    recipient_name: str | None = None
    subject: str | None = None
    body: str | None = None
    reason: str | None = None
