"""Regras dos pacotes: o que se pode vender e como o saldo se gasta.

A parte delicada é o saldo. Um crédito gasto por engano não dá erro nenhum —
o cliente é que descobre, meses depois, que lhe falta uma sessão. Por isso as
contas vivem aqui, longe dos endpoints, e há uma regra que as governa a todas:
**um crédito só se gasta quando a marcação existe, e volta se ela desaparecer.**
"""

from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import (
    Booking,
    BookingStatus,
    PackageItem,
    PackageKind,
    PackageSale,
    PackageSaleStatus,
    Professional,
    Service,
    ServicePackage,
)

# Situações em que a marcação ainda "segura" o crédito. Uma cancelada devolve-o.
SEGURA_CREDITO = {
    BookingStatus.PENDING,
    BookingStatus.CONFIRMED,
    BookingStatus.COMPLETED,
    # A falta também consome: o horário foi reservado e perdido.
    BookingStatus.NO_SHOW,
}


def duracao_total(package: ServicePackage) -> int:
    """Quanto tempo o pacote ocupa numa sessão.

    Num combinado é a soma dos serviços, porque acontecem de seguida. Num
    pacote de sessões é a duração do serviço, que se repete noutro dia.
    """
    if not package.items:
        return 0
    if package.kind == PackageKind.COMBO:
        return sum(item.service.duration_min for item in package.items)
    return package.items[0].service.duration_min


def valor_avulso(package: ServicePackage) -> int:
    """Quanto custaria comprar o mesmo, serviço a serviço.

    Serve para mostrar a poupança — que é a razão de existir de um pacote.
    """
    if not package.items:
        return 0
    if package.kind == PackageKind.COMBO:
        return sum(item.service.price_cents for item in package.items)
    return package.items[0].service.price_cents * max(1, package.sessions)


def sessoes_do_pacote(package: ServicePackage) -> int:
    """Um combinado é sempre uma sessão só: os serviços fazem-se de seguida."""
    return 1 if package.kind == PackageKind.COMBO else max(1, package.sessions)


def vender(
    db: Session,
    professional: Professional,
    package: ServicePackage,
    client_id: int,
    *,
    notes: str | None = None,
    hoje: date | None = None,
) -> PackageSale:
    """Põe um pacote nas mãos de um cliente.

    Copia o nome e o preço do dia da venda: se o profissional mudar a tabela
    depois, quem já comprou não vê o passado mudar debaixo dos pés.
    """
    hoje = hoje or datetime.now(timezone.utc).date()
    validade = max(0, int(package.validity_days or 0))

    venda = PackageSale(
        professional_id=professional.id,
        package_id=package.id,
        client_id=client_id,
        package_name=package.name,
        kind=package.kind,
        price_cents=package.price_cents,
        sessions_total=sessoes_do_pacote(package),
        sessions_used=0,
        expires_on=hoje + timedelta(days=validade) if validade else None,
        status=PackageSaleStatus.ACTIVE,
        notes=notes,
    )
    db.add(venda)
    return venda


def esta_disponivel(venda: PackageSale, *, hoje: date | None = None) -> tuple[bool, str]:
    """O saldo dá para marcar mais uma?"""
    hoje = hoje or datetime.now(timezone.utc).date()

    if venda.status == PackageSaleStatus.CANCELLED:
        return False, "Este pacote foi cancelado."
    if venda.expires_on and venda.expires_on < hoje:
        return False, f"Este pacote expirou a {venda.expires_on.strftime('%d/%m/%Y')}."
    if venda.sessions_left <= 0:
        return False, "Este pacote já não tem sessões por usar."
    return True, ""


def recontar(db: Session, venda: PackageSale, *, hoje: date | None = None) -> PackageSale:
    """Recalcula o gasto a partir das marcações, em vez de confiar num contador.

    Um contador que se incrementa à mão fica errado à primeira exceção — uma
    marcação apagada, um estado mudado duas vezes. Contar as marcações que
    ainda seguram o crédito dá sempre o mesmo resultado, corra-se quando se
    correr.
    """
    hoje = hoje or datetime.now(timezone.utc).date()

    usadas = db.scalar(
        select(func.count(Booking.id)).where(
            Booking.package_sale_id == venda.id,
            Booking.status.in_(SEGURA_CREDITO),
        )
    )
    venda.sessions_used = min(int(usadas or 0), venda.sessions_total)

    if venda.status != PackageSaleStatus.CANCELLED:
        if venda.sessions_left <= 0:
            venda.status = PackageSaleStatus.USED
        elif venda.expires_on and venda.expires_on < hoje:
            venda.status = PackageSaleStatus.EXPIRED
        else:
            venda.status = PackageSaleStatus.ACTIVE
    return venda


def servicos_do_pacote(db: Session, package: ServicePackage) -> list[Service]:
    """Os serviços do pacote, na ordem em que foram guardados."""
    linhas = db.scalars(
        select(PackageItem)
        .where(PackageItem.package_id == package.id)
        .order_by(PackageItem.position, PackageItem.id)
    ).all()
    return [item.service for item in linhas]
