from pydantic import BaseModel, Field

from app.models.enums import NotificationTrigger
from app.schemas.common import ORMModel


class RuleOut(ORMModel):
    id: int
    trigger: NotificationTrigger
    label: str = ""
    # Cada destinatário tem o seu interruptor e o seu texto.
    to_client: bool
    client_body: str
    to_professional: bool
    professional_body: str
    offset_minutes: int
    # Só os lembretes usam o desvio de tempo.
    uses_offset: bool = False


class RuleUpdate(BaseModel):
    to_client: bool = True
    client_body: str = Field(default="", max_length=4000)
    to_professional: bool = False
    professional_body: str = Field(default="", max_length=4000)
    offset_minutes: int = Field(default=120, ge=0, le=20160)


class VariableOut(BaseModel):
    name: str
    description: str


class RulesResponse(BaseModel):
    rules: list[RuleOut]
    variables: list[VariableOut]


class RulePreview(BaseModel):
    """Como os dois textos ficam, lado a lado."""

    client_body: str
    professional_body: str
