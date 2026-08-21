"""Dependencias compartilhadas: sessao de banco, usuario autenticado e papeis."""

from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.session import get_db
from app.models import Professional, User, UserRole

DbSession = Annotated[Session, Depends(get_db)]


def _extract_token(request: Request) -> str | None:
    header = request.headers.get("Authorization") or ""
    if header.lower().startswith("bearer "):
        return header[7:].strip()
    return None


def get_current_user_optional(request: Request, db: DbSession) -> User | None:
    token = _extract_token(request)
    if not token:
        return None
    payload = decode_access_token(token)
    if not payload:
        return None
    try:
        user_id = int(payload.get("sub", 0))
    except (TypeError, ValueError):
        return None
    user = db.get(User, user_id)
    if not user or not user.is_active:
        return None
    return user


def get_current_user(request: Request, db: DbSession) -> User:
    user = get_current_user_optional(request, db)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sessão não iniciada.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
OptionalUser = Annotated[User | None, Depends(get_current_user_optional)]


def require_admin(user: CurrentUser) -> User:
    if user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso reservado ao sector administrativo.",
        )
    return user


AdminUser = Annotated[User, Depends(require_admin)]


def get_current_professional(user: CurrentUser, db: DbSession) -> Professional:
    """Perfil profissional do usuario logado. Admin nao possui perfil."""
    professional = db.scalar(select(Professional).where(Professional.user_id == user.id))
    if not professional:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Esta conta não tem perfil profissional.",
        )
    return professional


CurrentProfessional = Annotated[Professional, Depends(get_current_professional)]
