"""Pacotes de serviços e o saldo de quem os comprou.

Há dois feitios de pacote, e a diferença entre eles não é de tamanho — é de
como se consomem:

  * **Sessões** (`sessions`): o mesmo serviço, várias vezes. Compra-se dez
    manicures e vai-se marcando ao longo dos meses. O que fica em aberto é um
    saldo: dez créditos que se gastam um a um, com marcação ou sem ela.
  * **Combinado** (`combo`): serviços diferentes na mesma sessão. Manicure e
    pedicure de seguida, num único horário. Aqui não há saldo nenhum — há um
    atendimento só, mais longo, que vale o preço do conjunto.

Foi por isso que ficaram no mesmo modelo com um `kind` a separá-los: o que
muda é a maneira de os consumir, não a de os vender. Tratá-los como duas
tabelas obrigaria a duplicar preço, validade, ativo/inativo e o resto.
"""

from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.enums import PackageKind, PackageSaleStatus
from app.models.user import utcnow


class ServicePackage(Base):
    __tablename__ = "service_packages"

    id: Mapped[int] = mapped_column(primary_key=True)
    professional_id: Mapped[int] = mapped_column(
        ForeignKey("professionals.id", ondelete="CASCADE"), nullable=False, index=True
    )

    name: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    kind: Mapped[PackageKind] = mapped_column(
        SAEnum(PackageKind, name="package_kind"), default=PackageKind.SESSIONS, nullable=False
    )

    price_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    # Só faz sentido em `sessions`: quantas vezes o serviço se repete.
    sessions: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    # Quantos dias o saldo dura depois de vendido. Zero é sem prazo.
    validity_days: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    professional: Mapped["Professional"] = relationship(back_populates="packages")  # noqa: F821
    items: Mapped[list["PackageItem"]] = relationship(
        back_populates="package", cascade="all, delete-orphan", lazy="selectin"
    )
    sales: Mapped[list["PackageSale"]] = relationship(
        back_populates="package", cascade="all, delete-orphan"
    )


class PackageItem(Base):
    """Um serviço dentro do pacote.

    Nos pacotes de sessões há um item só. Nos combinados há vários, e a ordem
    importa: é por ela que a sessão se organiza no dia.
    """

    __tablename__ = "package_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    package_id: Mapped[int] = mapped_column(
        ForeignKey("service_packages.id", ondelete="CASCADE"), nullable=False, index=True
    )
    service_id: Mapped[int] = mapped_column(
        ForeignKey("services.id", ondelete="CASCADE"), nullable=False
    )
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    package: Mapped["ServicePackage"] = relationship(back_populates="items")
    service: Mapped["Service"] = relationship(lazy="selectin")  # noqa: F821


class PackageSale(Base):
    """Um pacote nas mãos de um cliente, com o que ainda lhe resta.

    Guarda o nome e o preço do pacote como estavam no dia da venda. Se o
    profissional mudar o preço ou o nome depois, quem já comprou não vê o
    passado mudar debaixo dos pés.
    """

    __tablename__ = "package_sales"
    __table_args__ = (Index("ix_sale_pro_cliente", "professional_id", "client_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    professional_id: Mapped[int] = mapped_column(
        ForeignKey("professionals.id", ondelete="CASCADE"), nullable=False, index=True
    )
    package_id: Mapped[int | None] = mapped_column(
        ForeignKey("service_packages.id", ondelete="SET NULL")
    )
    client_id: Mapped[int] = mapped_column(
        ForeignKey("professional_clients.id", ondelete="CASCADE"), nullable=False
    )

    package_name: Mapped[str] = mapped_column(String(160), nullable=False)
    kind: Mapped[PackageKind] = mapped_column(
        SAEnum(PackageKind, name="package_kind"), nullable=False
    )
    price_cents: Mapped[int] = mapped_column(Integer, nullable=False)

    sessions_total: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    sessions_used: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    expires_on: Mapped[date | None] = mapped_column(Date)

    status: Mapped[PackageSaleStatus] = mapped_column(
        SAEnum(PackageSaleStatus, name="package_sale_status"),
        default=PackageSaleStatus.ACTIVE,
        nullable=False,
    )
    notes: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    professional: Mapped["Professional"] = relationship()  # noqa: F821
    package: Mapped["ServicePackage | None"] = relationship(back_populates="sales")
    client: Mapped["ProfessionalClient"] = relationship(lazy="selectin")  # noqa: F821

    @property
    def sessions_left(self) -> int:
        return max(0, self.sessions_total - self.sessions_used)
