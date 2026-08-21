"""Utilitarios de geolocalizacao usados na busca por proximidade."""

import math

EARTH_RADIUS_KM = 6371.0088


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Distancia em km entre duas coordenadas."""
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(a))


def bounding_box(lat: float, lon: float, radius_km: float) -> tuple[float, float, float, float]:
    """Caixa lat/lon que contem o circulo de raio informado.

    Serve de pre-filtro barato (usa indice) antes do calculo exato de haversine.
    Retorna (lat_min, lat_max, lon_min, lon_max).
    """
    lat_delta = radius_km / 111.32
    cos_lat = max(math.cos(math.radians(lat)), 0.01)
    lon_delta = radius_km / (111.32 * cos_lat)
    return (
        max(lat - lat_delta, -90.0),
        min(lat + lat_delta, 90.0),
        max(lon - lon_delta, -180.0),
        min(lon + lon_delta, 180.0),
    )
