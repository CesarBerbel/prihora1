from app.services.geo import bounding_box, haversine_km


def test_haversine_conhecida():
    # Av. Paulista (SP) ate o Cristo Redentor (RJ): ~360 km em linha reta.
    distancia = haversine_km(-23.5614, -46.6559, -22.9519, -43.2105)
    assert 350 < distancia < 375


def test_haversine_mesmo_ponto():
    assert haversine_km(-23.5, -46.6, -23.5, -46.6) == 0


def test_haversine_simetrica():
    a = haversine_km(-23.5, -46.6, -22.9, -43.2)
    b = haversine_km(-22.9, -43.2, -23.5, -46.6)
    assert abs(a - b) < 1e-9


def test_bounding_box_contem_o_raio():
    lat, lng, raio = -23.5505, -46.6333, 10.0
    lat_min, lat_max, lon_min, lon_max = bounding_box(lat, lng, raio)

    assert lat_min < lat < lat_max
    assert lon_min < lng < lon_max

    # Um ponto exatamente no raio, ao norte, precisa caber na caixa.
    norte = lat + raio / 111.32
    assert lat_min <= norte <= lat_max


def test_bounding_box_nao_estoura_limites():
    lat_min, lat_max, lon_min, lon_max = bounding_box(89.9, 179.9, 300)
    assert lat_max <= 90.0
    assert lat_min >= -90.0
    assert lon_max <= 180.0
    assert lon_min >= -180.0
