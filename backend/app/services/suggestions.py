"""Serviços de exemplo por especialidade.

Servem de ponto de partida no arranque: em vez de encarar um formulário vazio,
o profissional escolhe o que já faz e ajusta o preço. Os valores são apenas
sugestões de mercado em Portugal — cada um define os seus.
"""

from app.models import Category, Professional, Service
from sqlalchemy import select
from sqlalchemy.orm import Session

# slug da categoria -> (nome, duração em minutos, preço sugerido em cêntimos)
CATALOGO: dict[str, list[tuple[str, int, int]]] = {
    "manicure": [
        ("Manicure simples", 45, 1400),
        ("Manicure com verniz gel", 60, 2200),
        ("Remoção de gel", 30, 1000),
        ("Reparação de unha", 20, 500),
    ],
    "pedicure": [
        ("Pedicure simples", 60, 1800),
        ("Pedicure com verniz gel", 75, 2600),
        ("Spa de pés", 75, 2500),
    ],
    "unhas-em-gel": [
        ("Alongamento em gel", 120, 4500),
        ("Manutenção de gel", 90, 3000),
        ("Fibra de vidro", 120, 4800),
        ("Nail art (por unha)", 15, 300),
    ],
    "podologia": [
        ("Consulta de podologia", 60, 3500),
        ("Tratamento de unha encravada", 45, 3000),
        ("Remoção de calosidades", 40, 2500),
        ("Podologia para diabéticos", 60, 4000),
    ],
    "tatuagem": [
        ("Sessão de tatuagem (1h)", 60, 8000),
        ("Sessão de tatuagem (3h)", 180, 21000),
        ("Fineline pequena", 45, 6000),
        ("Retoque", 45, 0),
    ],
    "piercing": [
        ("Aplicação de piercing", 30, 3000),
        ("Troca de joia", 20, 1500),
    ],
    "sobrancelhas": [
        ("Design de sobrancelhas", 30, 1200),
        ("Design com henna", 50, 2200),
        ("Brow lamination", 70, 4500),
        ("Micropigmentação fio a fio", 150, 18000),
    ],
    "pestanas": [
        ("Extensão fio a fio", 120, 4000),
        ("Volume russo", 120, 5500),
        ("Lash lifting", 60, 3500),
        ("Manutenção de pestanas", 75, 2800),
    ],
    "depilacao": [
        ("Perna inteira", 45, 2200),
        ("Meia perna", 30, 1400),
        ("Axilas", 20, 900),
        ("Virilha completa", 40, 2500),
        ("Buço", 15, 600),
    ],
    "maquilhagem": [
        ("Maquilhagem social", 60, 4000),
        ("Maquilhagem de noiva com prova", 180, 18000),
        ("Maquilhagem e penteado", 150, 10000),
    ],
    "cabelo": [
        ("Corte feminino", 60, 2500),
        ("Corte masculino", 45, 1500),
        ("Coloração completa", 150, 7000),
        ("Madeixas", 240, 11000),
        ("Brushing", 45, 1800),
        ("Tratamento capilar", 90, 4500),
    ],
    "barbearia": [
        ("Corte masculino", 45, 1500),
        ("Corte e barba", 75, 2400),
        ("Barba completa", 40, 1200),
        ("Acabamento à navalha", 30, 1000),
    ],
    "massagem": [
        ("Massagem relaxante", 60, 3500),
        ("Massagem modeladora", 60, 4200),
        ("Drenagem linfática", 60, 4000),
        ("Pedras quentes", 75, 4500),
    ],
    "estetica-facial": [
        ("Limpeza de pele profunda", 90, 4500),
        ("Peeling químico", 60, 5500),
        ("Hidratação facial", 60, 3500),
    ],
    "estetica-corporal": [
        ("Drenagem linfática corporal", 60, 4000),
        ("Radiofrequência", 60, 5000),
        ("Massagem redutora", 60, 4200),
    ],
}


def suggestions_for(db: Session, professional: Professional) -> list[dict]:
    """Sugestões para as especialidades deste profissional.

    O que já está registado desaparece da lista: sugerir de novo o que a pessoa
    acabou de acrescentar só criaria dúvida sobre se ficou ou não.
    """
    slugs = [c.slug for c in professional.categories]
    if not slugs:
        return []

    ja_tem = {
        (nome or "").strip().casefold()
        for nome in db.scalars(
            select(Service.name).where(Service.professional_id == professional.id)
        ).all()
    }

    categorias = {
        c.slug: c
        for c in db.scalars(select(Category).where(Category.slug.in_(slugs))).all()
    }

    saida: list[dict] = []
    vistos: set[str] = set()

    for slug in slugs:
        categoria = categorias.get(slug)
        for nome, duracao, preco in CATALOGO.get(slug, []):
            chave = nome.strip().casefold()
            # A mesma sugestão pode aparecer em duas categorias (corte masculino
            # está em cabelo e em barbearia): mostra-se uma vez só.
            if chave in ja_tem or chave in vistos:
                continue
            vistos.add(chave)
            saida.append(
                {
                    "name": nome,
                    "duration_min": duracao,
                    "price_cents": preco,
                    "category_id": categoria.id if categoria else None,
                    "category_name": categoria.name if categoria else None,
                }
            )

    return saida
