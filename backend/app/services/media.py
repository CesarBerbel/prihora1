"""Recebimento e normalizacao de imagens enviadas pelos profissionais.

O recorte quadrado acontece no navegador, mas nada do que chega aqui e
confiavel: o arquivo e sempre reaberto, validado e recodificado pelo Pillow.
Isso descarta EXIF, payloads escondidos e formatos fora da lista permitida,
e garante que o que servimos de volta e sempre um JPEG de verdade.
"""

import secrets
from pathlib import Path

from PIL import Image, ImageOps, UnidentifiedImageError

from app.core.config import settings

# Aceitamos apenas formatos raster comuns. SVG fica de fora de proposito:
# e XML, pode carregar script e viraria XSS armazenado ao ser servido.
ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}

AVATAR_DIR = "avatars"


class UploadError(Exception):
    """Erro de validacao com mensagem pronta para o usuario final."""


def _media_path(*parts: str) -> Path:
    return Path(settings.MEDIA_ROOT).joinpath(*parts)


def _open_image(raw: bytes) -> Image.Image:
    if not raw:
        raise UploadError("Ficheiro vazio.")
    if len(raw) > settings.MAX_UPLOAD_BYTES:
        limit_mb = settings.MAX_UPLOAD_BYTES // (1024 * 1024)
        raise UploadError(f"Imagem demasiado grande. O limite é {limit_mb} MB.")

    from io import BytesIO

    try:
        image = Image.open(BytesIO(raw))
        image.load()
    except (UnidentifiedImageError, OSError, ValueError):
        raise UploadError("Não conseguimos ler esta imagem. Envie um JPG, PNG ou WEBP.")

    if image.format not in ALLOWED_FORMATS:
        raise UploadError("Formato não suportado. Envie um JPG, PNG ou WEBP.")

    # Fotos de celular costumam vir com a orientacao so no EXIF.
    return ImageOps.exif_transpose(image)


def _to_square(image: Image.Image, size: int) -> Image.Image:
    """Garante um quadrado exato, mesmo se o cliente mandar outra proporcao."""
    # Fundo branco resolve PNG/WEBP com transparencia virando JPEG.
    if image.mode in ("RGBA", "LA", "P"):
        image = image.convert("RGBA")
        flat = Image.new("RGB", image.size, (255, 255, 255))
        flat.paste(image, mask=image.split()[-1])
        image = flat
    elif image.mode != "RGB":
        image = image.convert("RGB")

    # Recorte central: so age se o cliente nao tiver mandado quadrado.
    if image.width != image.height:
        edge = min(image.width, image.height)
        left = (image.width - edge) // 2
        top = (image.height - edge) // 2
        image = image.crop((left, top, left + edge, top + edge))

    return image.resize((size, size), Image.LANCZOS)


def save_avatar(raw: bytes, professional_id: int) -> str:
    """Grava o avatar e devolve a URL publica."""
    image = _to_square(_open_image(raw), settings.AVATAR_SIZE)

    directory = _media_path(AVATAR_DIR)
    directory.mkdir(parents=True, exist_ok=True)

    # Sufixo aleatorio: evita cache velho do navegador e nomes adivinhaveis.
    filename = f"{professional_id}-{secrets.token_hex(8)}.jpg"
    image.save(directory / filename, format="JPEG", quality=88, optimize=True, progressive=True)

    return f"{settings.MEDIA_URL}/{AVATAR_DIR}/{filename}"


def delete_avatar(url: str | None) -> None:
    """Remove um avatar antigo. Ignora URLs externas e caminhos suspeitos."""
    if not url or not url.startswith(f"{settings.MEDIA_URL}/{AVATAR_DIR}/"):
        return

    name = url.rsplit("/", 1)[-1]
    # Trava contra travessia de diretorio, mesmo o nome vindo do proprio banco.
    if not name or "/" in name or "\\" in name or ".." in name:
        return

    target = _media_path(AVATAR_DIR, name)
    try:
        target.unlink(missing_ok=True)
    except OSError:
        pass
