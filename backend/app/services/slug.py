"""Geracao de slugs unicos para perfis publicos."""

from slugify import slugify
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Professional


def unique_professional_slug(db: Session, name: str, exclude_id: int | None = None) -> str:
    base = slugify(name)[:120] or "profissional"
    candidate = base
    suffix = 2
    while True:
        query = select(Professional.id).where(Professional.slug == candidate)
        if exclude_id:
            query = query.where(Professional.id != exclude_id)
        if db.scalar(query) is None:
            return candidate
        candidate = f"{base}-{suffix}"[:150]
        suffix += 1
