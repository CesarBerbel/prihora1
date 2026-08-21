# Deploy — prihora1 (stack Docker de produção)

## O comando

Copie e cole inteiro. Pode correr as vezes que quiser: **não apaga a base de dados.**

```bash
cd /opt/prihora1/prihora1 \
  && git pull --ff-only origin main \
  && make prod \
  && docker exec prihora-proxy nginx -s reload
```

Tem de correr como **root**.

Os passos estão ligados por `&&`: se um falhar, os seguintes não correm.

## O que cada passo faz

| Passo | Porquê |
|---|---|
| `cd /opt/prihora1/prihora1` | Onde o repositório vive nesta VPS. |
| `git pull --ff-only origin main` | Traz o código novo. O `--ff-only` recusa-se a criar merge commits: se o local tiver divergido, pára em vez de inventar uma junção. |
| `make prod` | Constrói as imagens de produção, sobe a stack e aplica as migrações. Ver detalhe abaixo. |
| `docker exec prihora-proxy nginx -s reload` | **Não pode saltar este passo.** Ver a secção do nginx. |

### O que o `make prod` faz por dentro

```
docker compose -f docker-compose.yml -f docker-compose.prod.yml build
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T backend python -m app.cli init
```

O `app.cli init` espera a base aceitar ligações, aplica as migrações do Alembic e
corre o seed.

### Porque é preciso recarregar o nginx à mão

O `nginx.conf` entra no container por *bind mount* (`./infra/nginx/nginx.conf`).
Como o ficheiro não faz parte da imagem, alterá-lo **não muda nada na definição do
serviço** — e o `docker compose up -d` só recria containers cuja definição mudou.
Resultado: o ficheiro novo aparece dentro do container, mas o processo nginx
continua a correr com a configuração que leu no arranque.

O `nginx -s reload` é um *graceful reload*: arranca processos novos com a config
nova e deixa os antigos terminarem os pedidos em curso. Não há corte de serviço.

Para confirmar que a config que está em disco é válida **antes** de recarregar:

```bash
docker exec prihora-proxy nginx -t
```

## Porque é seguro repetir

- **O seed é idempotente** — está escrito para isso, e em produção o `.env` tem
  `SEED_DEMO_DATA=false`, portanto os dados de demonstração nem sequer são gerados.
  O que corre é apenas a sincronização de categorias, localidades, planos e do
  utilizador administrador.
- **As migrações do Alembic** só aplicam o que ainda não correu.
- **Os volumes sobrevivem.** O `up -d` pode recriar containers, mas `db_data`
  (base de dados), `media_data` (fotos de perfil) e `whatsapp_data` (sessões de
  WhatsApp) ficam intactos.
- **O `.env` não é tocado.** Não está sob controlo de versões.

### Uma ressalva sobre o seed

`seed_cities` reconcilia a tabela de localidades com a lista fixa no código
(`backend/app/seed/data.py`): localidades em base que **não** estejam nessa lista
são apagadas. Isto é uma sincronização deliberada, não um acidente — mas significa
que uma localidade criada à mão na base desaparece no próximo deploy. Se precisar
de uma localidade nova, acrescente-a ao código.

## Nunca correr em produção

| Comando | O que faz |
|---|---|
| `make reset` | `down -v` — **apaga todos os volumes**, incluindo a base de dados. |
| `make clean` | `down -v --rmi local` nas duas stacks — apaga volumes e imagens. |
| `python -m app.cli reset` | Faz `DROP` de todas as tabelas. |
| `docker compose down -v` | O `-v` remove os volumes. |

`make prod-down` é seguro (pára os containers, mantém os volumes), mas não é
preciso no deploy — o `up -d` trata da substituição sozinho.

## Verificar que correu bem

```bash
make ps
curl -s -o /dev/null -w '%{http_code}\n' https://<o-seu-dominio>/
```

Todos os containers devem aparecer `Up`, os que têm healthcheck como `(healthy)`.
O `prihora-worker` aparece sem estado de saúde, e é esperado: não serve HTTP, por
isso o healthcheck está desactivado nele.

Registos, se algo falhar:

```bash
make prod-logs
```
