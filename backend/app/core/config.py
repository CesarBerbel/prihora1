from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuracao da aplicacao, lida do ambiente."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    PROJECT_NAME: str = "prihora"
    API_V1_PREFIX: str = "/api/v1"
    ENV: str = "development"

    # Banco
    POSTGRES_USER: str = "prihora"
    POSTGRES_PASSWORD: str = "prihora_dev_password"
    POSTGRES_DB: str = "prihora"
    POSTGRES_HOST: str = "db"
    POSTGRES_PORT: int = 5432

    # Seguranca
    SECRET_KEY: str = "dev-secret-change-me"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7

    BACKEND_CORS_ORIGINS: str = "http://localhost:3000"

    # Endereço público do site, usado nas ligações que saem em mensagens.
    # Em produção passa a ser o domínio real; aqui serve o de desenvolvimento.
    SITE_URL: str = "http://localhost:3000"

    # Bootstrap do admin
    ADMIN_EMAIL: str = "admin@prihora.pt"
    ADMIN_PASSWORD: str = "admin123"
    ADMIN_NAME: str = "Administrador"

    SEED_DEMO_DATA: bool = True

    DEFAULT_TIMEZONE: str = "Europe/Lisbon"

    # --- Mensageria ---
    # Serviço de WhatsApp (Baileys). Só acessível pela rede interna.
    WHATSAPP_URL: str = "http://whatsapp:4000"
    WHATSAPP_TOKEN: str = ""
    WHATSAPP_ENABLED: bool = True

    # --- Geocodificação inversa ---
    # Usada pelo botão "usar a minha localização". O Nominatim é gratuito mas
    # pede um User-Agent identificável e cadência baixa; o nosso uso é pontual.
    GEOCODING_ENABLED: bool = True
    GEOCODING_URL: str = "https://nominatim.openstreetmap.org/reverse"
    GEOCODING_USER_AGENT: str = "prihora/1.0 (marketplace de estetica)"

    # --- Uploads ---
    # Diretorio montado como volume; sobrevive a recriacao do container.
    MEDIA_ROOT: str = "/app/media"
    MEDIA_URL: str = "/media"
    # Teto do arquivo recebido. O recorte no navegador ja entrega algo bem menor.
    MAX_UPLOAD_BYTES: int = 8 * 1024 * 1024
    # Lado do quadrado final, em pixels. Cobre telas retina com folga.
    AVATAR_SIZE: int = 512

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+psycopg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    @property
    def cors_origins(self) -> list[str]:
        raw = (self.BACKEND_CORS_ORIGINS or "").strip()
        if raw in ("", "*"):
            return ["*"]
        return [o.strip() for o in raw.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.ENV.lower() in ("production", "prod")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
