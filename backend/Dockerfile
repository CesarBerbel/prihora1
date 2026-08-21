# syntax=docker/dockerfile:1
# ------------------------------------------------------------------ base ----
FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

RUN apt-get update \
 && apt-get install -y --no-install-recommends curl \
 && rm -rf /var/lib/apt/lists/*

COPY requirements.txt requirements-dev.txt ./

# ------------------------------------------------------------------- dev ----
FROM base AS dev
RUN pip install -r requirements-dev.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

# ------------------------------------------------------------------ prod ----
FROM base AS prod
RUN pip install -r requirements.txt
COPY . .

# Usuario sem privilegios da aplicacao. Nao usamos USER aqui: o entrypoint
# comeca como root so para acertar a posse do volume de midia e entao larga o
# privilegio com setpriv. Ver docker-entrypoint.sh.
RUN useradd --create-home --uid 10001 prihora \
 && mkdir -p /app/media/avatars \
 && chown -R prihora:prihora /app \
 && chmod +x /app/docker-entrypoint.sh

ENTRYPOINT ["/app/docker-entrypoint.sh"]

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://localhost:8000/health || exit 1

CMD ["gunicorn", "app.main:app", "--worker-class", "uvicorn.workers.UvicornWorker", \
     "--workers", "3", "--bind", "0.0.0.0:8000", "--timeout", "60", "--access-logfile", "-"]
