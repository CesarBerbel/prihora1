from datetime import date

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class ExpenseIn(BaseModel):
    description: str = Field(min_length=2, max_length=160)
    amount_cents: int = Field(ge=0)
    incurred_on: date
    category: str = Field(default="outros", max_length=40)
    recurring: bool = False
    ends_on: date | None = None
    notes: str | None = Field(default=None, max_length=500)


class ExpenseOut(ORMModel):
    id: int
    description: str
    amount_cents: int
    incurred_on: date
    category: str
    recurring: bool
    ends_on: date | None = None
    notes: str | None = None


class CommissionIn(BaseModel):
    """A percentagem devida a terceiros sobre o valor de cada atendimento."""

    commission_percent: float = Field(ge=0, le=100)


class LinhaOut(BaseModel):
    quantidade: int
    bruto_cents: int
    comissao_cents: int
    liquido_cents: int


class DiaOut(BaseModel):
    dia: date
    feito_cents: int
    previsto_cents: int


class FinanceSummaryOut(BaseModel):
    ano: int
    mes: int
    commission_percent: float

    feito: LinhaOut
    previsto: LinhaOut

    perdido_cents: int
    perdido_quantidade: int

    despesas_cents: int
    despesas_por_categoria: dict[str, int]

    bruto_total_cents: int
    comissao_total_cents: int
    resultado_cents: int
    resultado_projetado_cents: int

    dias: list[DiaOut]
    categorias: dict[str, str]


class LinhaRankingOut(BaseModel):
    nome: str
    quantidade: int
    bruto_cents: int


class RelatorioOut(BaseModel):
    de: date
    ate: date

    concluidos: int
    cancelados: int
    faltas: int
    marcados: int
    taxa_comparencia: float

    receita_cents: int
    ticket_medio_cents: int

    novos_clientes: int
    clientes_recorrentes: int

    por_servico: list[LinhaRankingOut]
    por_cliente: list[LinhaRankingOut]
    por_dia_da_semana: list[LinhaRankingOut]
    por_hora: list[LinhaRankingOut]
