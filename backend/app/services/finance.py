"""Contas do mês: o que entrou, o que ainda vai entrar e o que sai.

A ideia é simples e é toda ela sobre uma distinção: **feito** e **previsto**.

*Feito* é o dinheiro que já foi ganho — atendimentos concluídos. Não muda mais.
*Previsto* é o que está marcado e ainda pode acontecer — confirmado ou à espera
de confirmação, com hora no futuro. Somar os dois num número só daria uma
faturação que parece garantida e não é; separá-los é a razão de existir deste
módulo.

O que não entra em nenhum dos dois: cancelados e faltas. Um atendimento a que
o cliente não compareceu não rendeu nada, e continuar a contá-lo como previsto
seria mentir para o próprio dono do negócio.

Tudo em cêntimos e inteiros, e sempre no fuso do profissional — é lá que o mês
dele começa e acaba.
"""

from calendar import monthrange
from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Booking, BookingStatus, Expense, Professional

# Rótulos conhecidos. Livre no modelo, sugerido aqui: é o que o ecrã oferece.
EXPENSE_CATEGORIES: dict[str, str] = {
    "material": "Material e produtos",
    "espaco": "Espaço e renda",
    "equipamento": "Equipamento",
    "formacao": "Formação",
    "deslocacao": "Deslocações",
    "impostos": "Impostos e taxas",
    "software": "Software e serviços",
    "outros": "Outros",
}

# Situações que contam para cada lado da conta.
FEITO = {BookingStatus.COMPLETED}
PREVISTO = {BookingStatus.CONFIRMED, BookingStatus.PENDING}


def month_bounds(ano: int, mes: int, tz: str) -> tuple[datetime, datetime]:
    """Início e fim de um mês, no fuso do profissional. Fim exclusivo."""
    fuso = ZoneInfo(tz or "Europe/Lisbon")
    inicio = datetime(ano, mes, 1, tzinfo=fuso)
    if mes == 12:
        fim = datetime(ano + 1, 1, 1, tzinfo=fuso)
    else:
        fim = datetime(ano, mes + 1, 1, tzinfo=fuso)
    return inicio, fim


def comissao(valor_cents: int, percentagem: float) -> int:
    """A comissão devida sobre um valor.

    Arredonda ao cêntimo mais próximo. Percentagens fora de 0–100 não fazem
    sentido nenhum e são cortadas em vez de gerarem uma dívida absurda.
    """
    taxa = min(max(percentagem or 0.0, 0.0), 100.0)
    return int(round(valor_cents * taxa / 100))


@dataclass
class Linha:
    """Um lado da conta: quantos atendimentos e quanto valem."""

    quantidade: int = 0
    bruto_cents: int = 0
    comissao_cents: int = 0

    @property
    def liquido_cents(self) -> int:
        return self.bruto_cents - self.comissao_cents


@dataclass
class DiaDoMes:
    dia: date
    feito_cents: int = 0
    previsto_cents: int = 0


@dataclass
class ResumoFinanceiro:
    ano: int
    mes: int
    commission_percent: float

    feito: Linha = field(default_factory=Linha)
    previsto: Linha = field(default_factory=Linha)

    perdido_cents: int = 0
    perdido_quantidade: int = 0

    despesas_cents: int = 0
    despesas_por_categoria: dict[str, int] = field(default_factory=dict)

    dias: list[DiaDoMes] = field(default_factory=list)

    @property
    def bruto_total_cents(self) -> int:
        """Feito mais previsto: o cenário em que tudo o que está marcado acontece."""
        return self.feito.bruto_cents + self.previsto.bruto_cents

    @property
    def comissao_total_cents(self) -> int:
        return self.feito.comissao_cents + self.previsto.comissao_cents

    @property
    def resultado_cents(self) -> int:
        """O que sobra do que já aconteceu, depois de comissão e despesas."""
        return self.feito.liquido_cents - self.despesas_cents

    @property
    def resultado_projetado_cents(self) -> int:
        """O mesmo, contando também o que está marcado até ao fim do mês."""
        return self.feito.liquido_cents + self.previsto.liquido_cents - self.despesas_cents


def despesas_do_mes(db: Session, professional_id: int, inicio: date, fim: date) -> list[Expense]:
    """As despesas que pesam num mês: as pontuais dele e as recorrentes em vigor.

    Uma recorrente conta em todos os meses entre a data em que começou e a data
    em que acabou — por isso é registada uma vez e não todos os meses.
    """
    pontuais = select(Expense).where(
        Expense.professional_id == professional_id,
        Expense.recurring.is_(False),
        Expense.incurred_on >= inicio,
        Expense.incurred_on <= fim,
    )
    recorrentes = select(Expense).where(
        Expense.professional_id == professional_id,
        Expense.recurring.is_(True),
        # Já tinha começado quando o mês acabou...
        Expense.incurred_on <= fim,
        # ...e ainda não tinha acabado quando o mês começou.
        (Expense.ends_on.is_(None)) | (Expense.ends_on >= inicio),
    )
    return [
        *db.scalars(pontuais).all(),
        *db.scalars(recorrentes).all(),
    ]


def resumo_do_mes(
    db: Session,
    professional: Professional,
    ano: int,
    mes: int,
    *,
    agora: datetime | None = None,
) -> ResumoFinanceiro:
    """Junta receitas, comissão e despesas de um mês num só objecto."""
    agora = agora or datetime.now(timezone.utc)
    percentagem = professional.commission_percent or 0.0
    inicio, fim = month_bounds(ano, mes, professional.timezone)
    fuso = ZoneInfo(professional.timezone or "Europe/Lisbon")

    resumo = ResumoFinanceiro(ano=ano, mes=mes, commission_percent=percentagem)

    dias_no_mes = monthrange(ano, mes)[1]
    por_dia = {
        d: DiaDoMes(dia=date(ano, mes, d)) for d in range(1, dias_no_mes + 1)
    }

    marcacoes = db.scalars(
        select(Booking).where(
            Booking.professional_id == professional.id,
            Booking.starts_at >= inicio,
            Booking.starts_at < fim,
        )
    ).all()

    for booking in marcacoes:
        valor = booking.price_cents or 0
        dia = booking.starts_at.astimezone(fuso).day
        registo = por_dia[dia]

        if booking.status in FEITO:
            resumo.feito.quantidade += 1
            resumo.feito.bruto_cents += valor
            registo.feito_cents += valor
        elif booking.status in PREVISTO:
            # Um "confirmado" que já passou e ninguém concluiu não é receita
            # nenhuma: fica de fora dos dois lados até alguém lhe tocar.
            if booking.ends_at <= agora:
                continue
            resumo.previsto.quantidade += 1
            resumo.previsto.bruto_cents += valor
            registo.previsto_cents += valor
        else:
            # Cancelados e faltas: o que se deixou na mesa.
            resumo.perdido_quantidade += 1
            resumo.perdido_cents += valor

    resumo.feito.comissao_cents = comissao(resumo.feito.bruto_cents, percentagem)
    resumo.previsto.comissao_cents = comissao(resumo.previsto.bruto_cents, percentagem)

    for despesa in despesas_do_mes(db, professional.id, inicio.date(), (fim - timedelta(days=1)).date()):
        resumo.despesas_cents += despesa.amount_cents
        categoria = despesa.category or "outros"
        resumo.despesas_por_categoria[categoria] = (
            resumo.despesas_por_categoria.get(categoria, 0) + despesa.amount_cents
        )

    resumo.dias = [por_dia[d] for d in range(1, dias_no_mes + 1)]
    return resumo


# --- relatórios ---------------------------------------------------------------


@dataclass
class LinhaRanking:
    """Uma linha de um ranking: quem/o quê, quantos e quanto."""

    nome: str
    quantidade: int
    bruto_cents: int


@dataclass
class Relatorio:
    de: date
    ate: date

    concluidos: int
    cancelados: int
    faltas: int
    receita_cents: int
    ticket_medio_cents: int

    novos_clientes: int
    clientes_recorrentes: int

    por_servico: list[LinhaRanking]
    por_cliente: list[LinhaRanking]
    por_dia_da_semana: list[LinhaRanking]
    por_hora: list[LinhaRanking]

    @property
    def marcados(self) -> int:
        return self.concluidos + self.cancelados + self.faltas

    @property
    def taxa_comparencia(self) -> float:
        """Dos que foram marcados e chegaram ao fim, quantos aconteceram."""
        total = self.marcados
        return round(self.concluidos / total * 100, 1) if total else 0.0


def relatorio(
    db: Session, professional: Professional, de: date, ate: date
) -> Relatorio:
    """O que aconteceu entre duas datas, olhado de quatro ângulos.

    Só conta o que já terminou — concluído, cancelado ou falta. O que ainda
    está marcado é previsão, e previsão vive no financeiro; misturar as duas
    coisas num relatório daria números que mudam sozinhos.
    """
    fuso = ZoneInfo(professional.timezone or "Europe/Lisbon")
    inicio = datetime.combine(de, time.min, tzinfo=fuso)
    fim = datetime.combine(ate, time.max, tzinfo=fuso)

    marcacoes = db.scalars(
        select(Booking).where(
            Booking.professional_id == professional.id,
            Booking.starts_at >= inicio,
            Booking.starts_at <= fim,
        )
    ).all()

    concluidas = [b for b in marcacoes if b.status == BookingStatus.COMPLETED]
    receita = sum(b.price_cents or 0 for b in concluidas)

    # Um cliente é novo se o primeiro atendimento concluído dele com este
    # profissional cai dentro do período. Contá-lo pelo registo seria contar
    # como novo quem já vinha há anos e só agora foi registado.
    primeiras: dict[str, datetime] = {}
    todas = db.scalars(
        select(Booking).where(
            Booking.professional_id == professional.id,
            Booking.status == BookingStatus.COMPLETED,
        )
    ).all()
    for b in todas:
        chave = _chave_do_cliente(b)
        if chave not in primeiras or b.starts_at < primeiras[chave]:
            primeiras[chave] = b.starts_at

    vistos = {_chave_do_cliente(b) for b in concluidas}
    novos = sum(1 for chave in vistos if inicio <= primeiras[chave] <= fim)

    return Relatorio(
        de=de,
        ate=ate,
        concluidos=len(concluidas),
        cancelados=sum(1 for b in marcacoes if b.status == BookingStatus.CANCELLED),
        faltas=sum(1 for b in marcacoes if b.status == BookingStatus.NO_SHOW),
        receita_cents=receita,
        ticket_medio_cents=round(receita / len(concluidas)) if concluidas else 0,
        novos_clientes=novos,
        clientes_recorrentes=len(vistos) - novos,
        por_servico=_ranking(concluidas, lambda b: b.service_name or "Sem nome"),
        por_cliente=_ranking(concluidas, lambda b: b.client_name or "Sem nome"),
        por_dia_da_semana=_ranking(
            concluidas,
            lambda b: DIAS_DA_SEMANA[b.starts_at.astimezone(fuso).weekday()],
            ordenar=False,
        ),
        por_hora=_ranking(
            concluidas,
            lambda b: f"{b.starts_at.astimezone(fuso).hour:02d}h",
            ordenar=False,
        ),
    )


DIAS_DA_SEMANA = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"]


def _chave_do_cliente(booking: Booking) -> str:
    """Quem é o cliente, quando nem sempre há um registo por trás.

    O telefone é o que identifica uma pessoa neste sistema — o nome repete-se
    e o registo pode nem existir, porque marcar não obriga a ter conta.
    """
    if booking.professional_client_id:
        return f"c{booking.professional_client_id}"
    digitos = "".join(ch for ch in (booking.client_phone or "") if ch.isdigit())
    return digitos or f"n{(booking.client_name or '').strip().lower()}"


def _ranking(marcacoes, chave, *, ordenar: bool = True, limite: int = 10) -> list[LinhaRanking]:
    contas: dict[str, LinhaRanking] = {}
    for b in marcacoes:
        nome = chave(b)
        linha = contas.setdefault(nome, LinhaRanking(nome=nome, quantidade=0, bruto_cents=0))
        linha.quantidade += 1
        linha.bruto_cents += b.price_cents or 0

    linhas = list(contas.values())
    if ordenar:
        linhas.sort(key=lambda l: (-l.bruto_cents, -l.quantidade, l.nome))
        return linhas[:limite]
    return linhas
