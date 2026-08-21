#!/bin/sh
# Entrypoint de producao do servico de WhatsApp.
#
# As credenciais das sessoes vivem num volume Docker. O Docker so copia dono e
# permissoes da imagem quando cria um volume nomeado VAZIO: um volume que ja
# exista - por exemplo, criado antes pelo container de desenvolvimento, que
# corre como root - chega aqui a pertencer ao root, e a aplicacao nao consegue
# gravar o creds.json. Foi exatamente assim que este servico entrou em ciclo de
# reinicio na primeira subida em producao.
#
# Por isso o container comeca como root so para acertar a posse, e larga o
# privilegio antes de executar a aplicacao.
set -e

DIR="${SESSIONS_DIR:-/data/sessions}"
APP_UID=10001
APP_GID=10001

mkdir -p "$DIR"

# O chown recursivo so corre quando e mesmo preciso.
if [ "$(stat -c %u "$DIR")" != "$APP_UID" ]; then
    echo "entrypoint: a ajustar o dono de $DIR para $APP_UID:$APP_GID"
    chown -R "$APP_UID:$APP_GID" "$(dirname "$DIR")"
fi

exec su-exec "$APP_UID:$APP_GID" "$@"
