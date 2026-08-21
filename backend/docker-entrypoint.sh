#!/bin/sh
# Entrypoint de producao.
#
# O diretorio de midia e um volume Docker. O Docker so copia dono e permissoes
# da imagem quando cria um volume nomeado VAZIO: se o volume ja existir - por
# exemplo, criado antes por um container de desenvolvimento rodando como root -
# ele chega aqui pertencendo ao root e a aplicacao nao consegue gravar.
#
# Por isso o container comeca como root apenas para acertar a posse e, em
# seguida, larga o privilegio antes de executar a aplicacao.
set -e

MEDIA_DIR="${MEDIA_ROOT:-/app/media}"
APP_UID=10001
APP_GID=10001

mkdir -p "$MEDIA_DIR/avatars"

# O chown recursivo so roda quando realmente precisa: em volumes grandes ele
# custa caro e, no caso comum, o dono ja esta correto.
if [ "$(stat -c %u "$MEDIA_DIR")" != "$APP_UID" ]; then
    echo "entrypoint: ajustando o dono de $MEDIA_DIR para $APP_UID:$APP_GID"
    chown -R "$APP_UID:$APP_GID" "$MEDIA_DIR"
fi

exec setpriv --reuid="$APP_UID" --regid="$APP_GID" --init-groups "$@"
