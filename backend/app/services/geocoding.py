"""Coordenadas para morada, para o botão "usar a minha localização".

Passa pelo backend e não pelo navegador de propósito: o Nominatim exige um
User-Agent identificável, limita a cadência, e assim conseguimos guardar em
memória o que já perguntámos. Se o serviço externo falhar, ainda devolvemos a
localidade e o distrito conhecidos, calculados a partir das nossas cidades.
"""

import logging
from threading import Lock

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import City
from app.seed.data import DISTRICTS
from app.services.geo import bounding_box, haversine_km

logger = logging.getLogger("prihora.geocoding")

# Duas coordenadas do mesmo sítio não precisam de duas perguntas: arredondar
# para ~11 metros junta os pedidos de quem carrega no botão duas vezes.
PRECISAO = 4
_cache: dict[tuple[float, float], dict] = {}
_cache_lock = Lock()
CACHE_MAX = 500

# Como a resposta do Nominatim nomeia a localidade, do mais preciso ao menos.
CAMPOS_LOCALIDADE = ("city", "town", "village", "municipality", "suburb")
# Em Portugal, o distrito vem em "county".
CAMPOS_DISTRITO = ("county", "state", "region")

DISTRITOS_CONHECIDOS = {d.casefold(): d for d in DISTRICTS}


def _normaliza_distrito(valor: str | None) -> str | None:
    """Só aceitamos um distrito que exista na nossa lista.

    O Nominatim devolve por vezes a área metropolitana em vez do distrito; um
    valor que não reconhecemos não serve para o formulário nem para a pesquisa.
    """
    if not valor:
        return None
    return DISTRITOS_CONHECIDOS.get(valor.strip().casefold())


def cidade_mais_perto(db: Session, lat: float, lng: float) -> City | None:
    """A cidade conhecida mais próxima, num raio razoável.

    Serve de plano B quando o serviço externo não responde, e serve também de
    resposta directa ao campo de localidade da pesquisa, que não precisa da
    morada — só do nome de uma localidade que exista mesmo na tabela.
    """
    lat_min, lat_max, lon_min, lon_max = bounding_box(lat, lng, 60)
    candidatas = db.scalars(
        select(City).where(
            City.latitude.between(lat_min, lat_max),
            City.longitude.between(lon_min, lon_max),
        )
    ).all()
    if not candidatas:
        return None
    return min(candidatas, key=lambda c: haversine_km(lat, lng, c.latitude, c.longitude))


def _consulta_externa(lat: float, lng: float) -> dict | None:
    """Pergunta ao Nominatim. Devolve None se não der — nunca levanta erro."""
    if not settings.GEOCODING_ENABLED:
        return None

    chave = (round(lat, PRECISAO), round(lng, PRECISAO))
    with _cache_lock:
        if chave in _cache:
            return _cache[chave]

    try:
        resposta = httpx.get(
            settings.GEOCODING_URL,
            params={
                "lat": lat,
                "lon": lng,
                "format": "jsonv2",
                "addressdetails": 1,
                "zoom": 18,
                "accept-language": "pt",
            },
            headers={"User-Agent": settings.GEOCODING_USER_AGENT},
            timeout=httpx.Timeout(8.0, connect=4.0),
        )
        resposta.raise_for_status()
        endereco = resposta.json().get("address") or {}
    except (httpx.HTTPError, ValueError) as erro:
        logger.info("Geocodificação indisponível: %s", erro)
        return None

    rua = endereco.get("road") or endereco.get("pedestrian") or ""
    numero = endereco.get("house_number") or ""
    localidade = next((endereco[c] for c in CAMPOS_LOCALIDADE if endereco.get(c)), None)
    distrito = next(
        (
            d
            for d in (_normaliza_distrito(endereco.get(c)) for c in CAMPOS_DISTRITO)
            if d
        ),
        None,
    )

    resultado = {
        "address_line": f"{rua}, {numero}".strip(", ") if rua else None,
        "city": localidade,
        "state": distrito,
        "postal_code": endereco.get("postcode"),
    }

    with _cache_lock:
        # Cache simples: quando enche, esvazia. O uso é pontual e não justifica
        # uma política de expulsão mais fina.
        if len(_cache) >= CACHE_MAX:
            _cache.clear()
        _cache[chave] = resultado

    return resultado


def reverse(db: Session, lat: float, lng: float) -> dict:
    """Morada aproximada destas coordenadas.

    Devolve sempre alguma coisa: se o serviço externo não responder, a
    localidade e o distrito ainda saem da cidade conhecida mais próxima.
    """
    externo = _consulta_externa(lat, lng) or {}
    resultado = {
        "latitude": lat,
        "longitude": lng,
        "address_line": externo.get("address_line"),
        "city": externo.get("city"),
        "state": externo.get("state"),
        "postal_code": externo.get("postal_code"),
        "source": "nominatim" if externo else "cidades",
    }

    # O que faltar tenta-se preencher com a cidade mais próxima.
    if not resultado["city"] or not resultado["state"]:
        perto = cidade_mais_perto(db, lat, lng)
        if perto:
            resultado["city"] = resultado["city"] or perto.name
            resultado["state"] = resultado["state"] or perto.state
            if not externo:
                resultado["source"] = "cidades"

    return resultado
