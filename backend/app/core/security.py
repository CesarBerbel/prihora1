from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from app.core.config import settings

# bcrypt trunca em 72 bytes; normalizamos antes de gerar/validar o hash.
_BCRYPT_MAX_BYTES = 72


def _encode(password: str) -> bytes:
    return password.encode("utf-8")[:_BCRYPT_MAX_BYTES]


def hash_password(password: str) -> str:
    return bcrypt.hashpw(_encode(password), bcrypt.gensalt(rounds=12)).decode()


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(_encode(password), hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def create_access_token(subject: str, role: str, expires_minutes: int | None = None) -> str:
    minutes = expires_minutes or settings.ACCESS_TOKEN_EXPIRE_MINUTES
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(subject),
        "role": role,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=minutes)).timestamp()),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except jwt.PyJWTError:
        return None


# --- pre-visualizacao de perfis por aprovar ----------------------------------

PREVIEW_TYPE = "preview"
PREVIEW_MINUTES = 30


def create_preview_token(professional_id: int) -> str:
    """Autorizacao curta para ver um perfil que ainda nao esta publico.

    A administracao precisa de ver o perfil como ele vai ficar antes de o
    aprovar, e a pagina do perfil e desenhada no servidor — nao tem o token de
    quem esta a pedir. Este vai no proprio endereco, dura meia hora e serve um
    perfil so, para um engano ao partilhar a ligacao nao abrir a porta a todos.
    """
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(professional_id),
        "typ": PREVIEW_TYPE,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=PREVIEW_MINUTES)).timestamp()),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def preview_allows(token: str | None, professional_id: int) -> bool:
    """O token autoriza ver *este* perfil?"""
    if not token:
        return False
    payload = decode_access_token(token)
    if not payload or payload.get("typ") != PREVIEW_TYPE:
        return False
    return payload.get("sub") == str(professional_id)
