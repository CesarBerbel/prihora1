# ==============================================================================
# prihora - marketplace de profissionais de estetica
#
#   make dev    -> sobe TUDO em desenvolvimento (hot reload)
#   make prod   -> sobe TUDO em producao (containers otimizados + nginx)
#
# Requisito unico: Docker + Docker Compose.
#
# ------------------------------------------------------------------------------
# PORTABILIDADE
# Este Makefile roda igual no PowerShell/cmd.exe e em shells POSIX. Nem todo
# make no Windows encontra um sh.exe: quando nao encontra, ele usa o cmd.exe,
# onde `cp`, `test` e `printf` nao existem. Por isso as receitas aqui usam
# apenas `docker`, `make` e `echo`, e o resto vem das funcoes internas do make.
#
# Ao editar, mantenha as regras:
#   - nada de cp / test / printf / touch / rm / redirecionamento;
#   - `echo` sem aspas e sem os metacaracteres do cmd.exe:  < > | & ^ ( )
#   - nada de `echo.` para linha em branco: e sintaxe de cmd e quebra no sh;
#   - um unico espaco entre palavras no echo, porque o sh colapsa espacos
#     repetidos e o cmd nao; alinhe com pontos, nunca com espacos;
#   - para ignorar a falha de um comando, use o prefixo `-` do make.
# ==============================================================================

.DEFAULT_GOAL := help

COMPOSE_DEV  := docker compose -f docker-compose.yml -f docker-compose.dev.yml
COMPOSE_PROD := docker compose -f docker-compose.yml -f docker-compose.prod.yml

# ------------------------------------------------------------------ help ----
.PHONY: help
help:
	@echo ==========================================================
	@echo prihora - marketplace de profissionais de estetica
	@echo ==========================================================
	@echo Uso: make [alvo]
	@echo ---------------------------- principais ------------------
	@echo dev ........... sobe TUDO em desenvolvimento com hot reload
	@echo prod .......... sobe TUDO em producao atras do nginx
	@echo ---------------------------- desenvolvimento -------------
	@echo dev-logs ...... acompanha os logs
	@echo dev-down ...... para os servicos
	@echo dev-restart ... reinicia os servicos
	@echo reset ......... apaga o banco e sobe tudo do zero
	@echo seed .......... repopula os dados de demonstracao
	@echo migrate ....... aplica as migrations pendentes
	@echo migration ..... cria uma migration: make migration m="o que mudou"
	@echo test .......... roda a suite de testes do backend
	@echo test-web ...... roda a suite de testes do frontend
	@echo test-whatsapp . roda a suite do servico de WhatsApp
	@echo mail .......... mostra o endereco da caixa de correio de dev
	@echo logs-worker ... acompanha o trabalhador dos lembretes
	@echo ---------------------------- producao --------------------
	@echo prod-logs ..... acompanha os logs
	@echo prod-down ..... para os servicos
	@echo ---------------------------- utilidades ------------------
	@echo ps ............ lista os containers do projeto
	@echo psql .......... abre o psql no banco
	@echo shell-api ..... shell no container do backend
	@echo shell-web ..... shell no container do frontend
	@echo setup ......... cria o .env a partir do .env.example
	@echo clean ......... remove containers, volumes e imagens
	@echo ==========================================================

# ----------------------------------------------------------------- setup ----
# O .env e criado pelas funcoes internas do make, sem depender de cp/copy.
# Como prerequisito "order-only" (depois do |), so roda quando o arquivo falta:
# editar o .env.example depois nao sobrescreve o .env do usuario.
.env:
	$(file > $@,$(file < .env.example))
	@echo :: .env criado a partir de .env.example

.PHONY: setup
setup: | .env
	@echo :: Ambiente pronto. Ajuste o .env se precisar.

.PHONY: check
check:
	@echo :: Conferindo o Docker. Se falhar aqui, abra o Docker Desktop e rode de novo.
	@docker version --format "   Docker Engine {{.Server.Version}} respondendo."

# ------------------------------------------------------------------- dev ----
.PHONY: dev
dev: check | .env
	@echo :: Construindo as imagens de desenvolvimento...
	@$(COMPOSE_DEV) build
	@echo :: Subindo os servicos...
	@$(COMPOSE_DEV) up -d
	@echo :: Aplicando schema e dados iniciais...
	@$(COMPOSE_DEV) exec -T backend python -m app.cli init
	@$(MAKE) --no-print-directory banner-dev

.PHONY: dev-logs
dev-logs:
	@$(COMPOSE_DEV) logs -f

.PHONY: dev-down
dev-down:
	@$(COMPOSE_DEV) down

.PHONY: dev-restart
dev-restart:
	@$(COMPOSE_DEV) restart

# ------------------------------------------------------------------ prod ----
.PHONY: prod
prod: check | .env
	@echo :: Construindo as imagens de producao...
	@$(COMPOSE_PROD) build
	@echo :: Subindo a stack de producao...
	@$(COMPOSE_PROD) up -d
	@echo :: Aplicando schema e dados iniciais...
	@$(COMPOSE_PROD) exec -T backend python -m app.cli init
	@$(MAKE) --no-print-directory banner-prod

.PHONY: prod-logs
prod-logs:
	@$(COMPOSE_PROD) logs -f

.PHONY: prod-down
prod-down:
	@$(COMPOSE_PROD) down

# ------------------------------------------------------------- utilidades ----
.PHONY: ps
ps:
	@docker ps --filter "name=prihora" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

.PHONY: migrate
migrate:
	@$(COMPOSE_DEV) exec -T backend python -m app.cli migrate

.PHONY: migration
migration:
	@$(COMPOSE_DEV) exec -T backend alembic revision --autogenerate -m "$(m)"
	@echo :: Revise o arquivo gerado em backend/alembic/versions antes de versionar.

.PHONY: db-revision
db-revision:
	@$(COMPOSE_DEV) exec -T backend alembic current

.PHONY: seed
seed:
	@$(COMPOSE_DEV) exec -T backend python -m app.cli seed

.PHONY: reset
reset:
	@echo :: Isso apaga todos os dados locais.
	@$(COMPOSE_DEV) down -v
	@$(MAKE) --no-print-directory dev

.PHONY: shell-api
shell-api:
	@$(COMPOSE_DEV) exec backend sh

.PHONY: shell-web
shell-web:
	@$(COMPOSE_DEV) exec frontend sh

.PHONY: psql
psql:
	@$(COMPOSE_DEV) exec db psql -U prihora -d prihora

.PHONY: test
test:
	@$(COMPOSE_DEV) exec -T backend python -m pytest -q

.PHONY: test-web
test-web:
	@$(COMPOSE_DEV) exec -T frontend npm test

.PHONY: test-whatsapp
test-whatsapp:
	@$(COMPOSE_DEV) exec -T whatsapp npm test

.PHONY: logs-worker
logs-worker:
	@$(COMPOSE_DEV) logs -f worker

.PHONY: mail
mail:
	@echo :: Caixa de correio de desenvolvimento: http://localhost:8025

.PHONY: lint
lint:
	@$(COMPOSE_DEV) exec -T backend python -m compileall -q app

# O prefixo - deixa o make seguir em frente quando nao ha nada para remover.
.PHONY: clean
clean:
	-@$(COMPOSE_DEV) down -v --rmi local --remove-orphans
	-@$(COMPOSE_PROD) down -v --rmi local --remove-orphans

# --------------------------------------------------------------- banners ----
.PHONY: banner-dev
banner-dev:
	@echo ==========================================================
	@echo prihora no ar - DESENVOLVIMENTO
	@echo ==========================================================
	@echo Site publico ..... http://localhost:3000
	@echo Painel do pro .... http://localhost:3000/painel
	@echo Administrativo ... http://localhost:3000/admin
	@echo API e docs ....... http://localhost:8000/docs
	@echo Caixa de correio . http://localhost:8025
	@echo ---------------------------- contas de demonstracao ------
	@echo Admin .......... admin@prihora.pt / admin123
	@echo Profissional ... ana.sousa@prihora.pt / demo123
	@echo Cliente ........ cliente@prihora.pt / demo123
	@echo ----------------------------------------------------------
	@echo Logs: make dev-logs . Parar: make dev-down
	@echo ==========================================================

.PHONY: banner-prod
banner-prod:
	@echo ==========================================================
	@echo prihora no ar - PRODUCAO
	@echo ==========================================================
	@echo Aplicacao ... http://localhost
	@echo API ......... http://localhost/api/v1
	@echo ----------------------------------------------------------
	@echo Antes de expor na internet, troque no .env:
	@echo SECRET_KEY, ADMIN_PASSWORD e POSTGRES_PASSWORD.
	@echo ==========================================================
