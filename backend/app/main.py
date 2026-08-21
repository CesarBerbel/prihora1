"""Ponto de entrada da API do prihora."""

import logging
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from app.api.v1.router import api_router
from app.core.config import settings
from app.db.session import engine

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("prihora")

app = FastAPI(
    title="prihora API",
    description=(
        "Marketplace de profissionais liberais da area de estetica. "
        "Busca por proximidade, perfis publicos, agenda online e gestao de planos."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Erro nao tratado em %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "Erro interno. Tente novamente dentro de instantes."},
    )


@app.get("/health", tags=["infra"])
def health() -> dict:
    """Usado pelo healthcheck do container e pelo nginx."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        database = "up"
    except Exception:
        database = "down"
    return {"status": "ok" if database == "up" else "degraded", "database": database}


@app.get("/", tags=["infra"])
def root() -> dict:
    return {
        "name": settings.PROJECT_NAME,
        "version": app.version,
        "docs": "/docs",
        "api": settings.API_V1_PREFIX,
    }


# Arquivos enviados pelos profissionais (fotos de perfil).
# O diretorio e um volume: precisa existir antes do mount, inclusive no
# primeiro boot de uma instalacao limpa.
Path(settings.MEDIA_ROOT).mkdir(parents=True, exist_ok=True)
app.mount(settings.MEDIA_URL, StaticFiles(directory=settings.MEDIA_ROOT), name="media")

app.include_router(api_router, prefix=settings.API_V1_PREFIX)
