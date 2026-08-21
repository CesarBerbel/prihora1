# prihora

Marketplace de profissionais liberais da área da estética em **Portugal** —
manicure, pedicure, podologia, tatuagem, sobrancelhas, pestanas, depilação,
maquilhagem, cabelo, barbearia, massagem e estética facial e corporal.

Cliente busca por servico e localidade, ve os profissionais mais proximos, abre o
perfil publico com precos e avaliacoes e reserva um horario direto na agenda —
sem precisar criar conta. Profissional publica servicos e horarios e recebe os
agendamentos. Administracao aprova perfis e gerencia planos.

## Comece aqui

Requisito unico: **Docker** (com Docker Compose). Nada mais precisa estar
instalado — nem Python, nem Node, nem Postgres.

```bash
make dev     # desenvolvimento, com hot reload
make prod    # producao, 100% em containers atras do nginx
```

Cada comando faz tudo sozinho: cria o `.env`, constroi as imagens, sobe os
servicos, espera o banco, aplica o schema e popula os dados iniciais.

Funciona igual no **PowerShell**, no **cmd.exe**, no **Git Bash**, no macOS e no
Linux. O Makefile nao depende de um shell POSIX: no Windows muitos `make` nao
encontram um `sh.exe` e caem no `cmd.exe`, onde `cp` e `test` nao existem — por
isso as receitas usam apenas `docker`, `make` e `echo`.

| | dev | prod |
| --- | --- | --- |
| Site publico | http://localhost:3000 | http://localhost |
| Painel do profissional | /painel | /painel |
| Administrativo | /admin | /admin |
| API (docs) | http://localhost:8000/docs | http://localhost/docs |

### Contas de demonstracao

| Papel | E-mail | Senha |
| --- | --- | --- |
| Administrador | `admin@prihora.pt` | `admin123` |
| Profissional | `ana.sousa@prihora.pt` | `demo123` |
| Cliente | `cliente@prihora.pt` | `demo123` |

Os restantes profissionais de exemplo usam a mesma palavra-passe `demo123`. Um deles fica
com cadastro **pendente**, para voce testar a fila de aprovacao do administrativo.

## Mensageria

Todas as mensagens saem por **WhatsApp**, do número do próprio profissional.
Cada um liga o seu lendo um código QR em `/painel/mensagens`. A ligação corre
num serviço Node à parte (`whatsapp/`), sobre a biblioteca Baileys, com uma
pasta de credenciais por profissional num volume: as contas ficam separadas e a
ligação sobrevive ao reinício. Esse serviço nunca é exposto no host — só o
backend fala com ele, na rede interna e com um segredo partilhado.

**Avisos automáticos.** Sete gatilhos, configuráveis em *Mensagens ›
Automáticas*: pedido de marcação, confirmação, conclusão, não comparecimento,
cancelamento, lembrete antes e seguimento depois.

Cada gatilho tem **dois textos**, porque as duas pontas precisam de coisas
diferentes: o cliente quer saber o que lhe vai acontecer; o profissional quer
saber quem, quando e como contactar. Os dois destinatários ligam-se em separado
e há 13 variáveis do sistema — `{cliente}`, `{telefone_cliente}`, `{servico}`,
`{data}`, `{hora}`, `{preco}`, `{morada}`…

Os lembretes correm num processo à parte (`make logs-worker`), de minuto a
minuto. O mesmo aviso nunca sai duas vezes para a mesma pessoa.

## Regionalização

Tudo assenta em Portugal: português europeu, euro, fuso `Europe/Lisbon`,
distritos em vez de siglas de estado, telefones de 9 dígitos com o indicativo
`351` e uma lista de 60 localidades portuguesas.

Os números são guardados em forma canónica, sem indicativo, para que
`+351 912 345 678`, `912345678` e `912 345 678` sejam reconhecidos como a mesma
pessoa no registo de clientes.

Trocar de país passa por: `CITIES` e `DISTRICTS` em `backend/app/seed/data.py`,
`LOCALE`, `CURRENCY` e `COUNTRY_CODE` em `frontend/src/lib/format.ts`, e
`DEFAULT_TIMEZONE` em `backend/app/core/config.py`.

## O que ja funciona

**Site publico**
- Home com busca por servico + localidade, categorias e vitrine de destaques
- Busca com ranking por proximidade real (haversine), filtros de especialidade,
  distancia, atendimento em domicilio e ordenacao por relevancia, distancia,
  nota, preco ou novidade
- A localidade ordena o resultado em vez de o cortar: primeiro quem atende a
  região, depois as outras localidades por proximidade, e por fim os destaques
- Limpar a pesquisa num clique, ou apenas os filtros mantendo o que procurou
- Autocomplete de cidades e botao "usar minha localizacao"
- Perfil publico por profissional: bio, servicos com preco e duracao, grade
  semanal, endereco, avaliacoes e contato por WhatsApp
- Agenda publica com horarios livres calculados em tempo real
- Agendamento em tres passos, com ou sem conta, e codigo de acompanhamento
- Consulta de agendamento pelo codigo, sem login

**Painel do profissional**
- Login cai direto na visao geral do papel: painel, administrativo ou minha conta
- Registo pede só o essencial; o perfil monta-se no guia de arranque
- Guia de arranque em cinco passos, com formularios ali mesmo: apresentacao,
  localidade (com coordenadas manuais), servicos, horarios e publicacao.
  Desaparece do painel quando ja nao ha nada por fazer
- Servicos de exemplo por especialidade, prontos a acrescentar com um toque,
  a par da adicao manual
- Visao geral com proximos atendimentos, faturamento de 30 dias e checklist
- Edicao do perfil publico, especialidades, localizacao e coordenadas
- Foto de perfil com upload e recorte quadrado no proprio navegador
- Servicos (criar, editar, ativar/desativar, remover) respeitando o limite do plano
- Grade semanal de horarios e bloqueios pontuais para folgas e ferias
- Agendamentos: confirmar, concluir, cancelar ou marcar falta
- Lancar agendamento pelo painel, inclusive fora do expediente e por cima de
  bloqueios; a unica trava e nao ter outro atendimento no mesmo horario
- Cadastro de clientes proprio, com telefone, aniversario, anotacoes e
  historico. Quem agenda pelo site entra na lista sozinho, sem digitacao
- Centro de mensagens por WhatsApp próprio (liga-se lendo um QR), com histórico
  do que saiu e do que falhou
- Sete avisos automáticos: pedido, confirmação, conclusão, falta, cancelamento
  e dois lembretes com hora configurável. Cada um com **dois textos** — um para
  o cliente, outro para o profissional — ligáveis de forma independente
- Ao mudar o estado de uma marcação, o painel mostra o texto e pergunta antes
  de enviar — e nessas alturas o aviso vai só para o cliente
- Troca de plano

**Administrativo**
- Metricas: contas, profissionais por situacao, agendamentos por status, MRR
- Fila de aprovacao, verificacao, destaque e suspensao de perfis (com motivo)
- Contas: busca, filtro por papel, bloqueio e reativacao
- Planos: CRUD completo com limites e beneficios
- Todos os agendamentos da plataforma
- Trilha de auditoria das acoes administrativas

## Stack

| Camada | Escolha |
| --- | --- |
| Banco | PostgreSQL 16 |
| API | FastAPI (Python 3.12), SQLAlchemy 2.0, Pydantic v2, JWT |
| Web | Next.js 15 (App Router), React 19, TypeScript, Tailwind |
| Producao | nginx como reverse proxy, imagens multi-stage, usuario sem privilegios |

Detalhes de arquitetura e das decisoes tecnicas em [docs/ARQUITETURA.md](docs/ARQUITETURA.md).

## Comandos

```
make dev          Sobe tudo em desenvolvimento (hot reload)
make prod         Sobe tudo em producao (atras do nginx)
make dev-logs     Acompanha os logs
make dev-down     Para os servicos
make reset        Apaga o banco e recomeca do zero
make seed         Repopula os dados de demonstracao
make migrate      Aplica as migrations pendentes
make migration    Cria uma migration: make migration m="o que mudou"
make test         Roda a suite de testes do backend
make psql         Abre o psql no banco
make shell-api    Shell no container da API
make clean        Remove containers, volumes e imagens do projeto
make help         Lista todos os alvos
```

## Banco de dados e migrations

O schema e versionado com Alembic, em `backend/alembic/versions`. O `make dev` e
o `make prod` aplicam as migrations pendentes sozinhos, entao atualizar o
projeto nao pede nenhum passo manual e nao apaga dados.

Instalacoes anteriores a adocao do Alembic sao adotadas automaticamente: quando
encontramos um banco com tabelas e sem historico de versao, a revisao inicial e
marcada como aplicada e as seguintes rodam a partir dali.

Ao mexer nos modelos:

```bash
make migration m="descreva a mudanca"   # gera o arquivo
# revise o arquivo gerado, depois:
make migrate
```

Uma armadilha que vale lembrar: coluna `NOT NULL` adicionada a uma tabela que ja
tem linhas precisa de `server_default`, senao a migration falha no banco de
producao e passa despercebida em um banco vazio.

## Estrutura

```
prihora/
├── Makefile                  # a porta de entrada do projeto
├── docker-compose.yml        # base compartilhada
├── docker-compose.dev.yml    # bind mounts + hot reload
├── docker-compose.prod.yml   # imagens otimizadas + nginx
├── backend/
│   ├── app/
│   │   ├── api/v1/           # public, auth, professional, admin
│   │   ├── models/           # 13 tabelas
│   │   ├── schemas/          # contratos de entrada e saida
│   │   ├── services/         # agenda, busca, geo
│   │   ├── seed/             # categorias, cidades, planos, demo
│   │   └── cli.py            # python -m app.cli init | seed | reset
│   └── tests/
├── frontend/src/
│   ├── app/                  # rotas do App Router
│   ├── components/           # UI compartilhada
│   └── lib/                  # cliente HTTP, sessao, formatacao
├── infra/nginx/
└── docs/
```

## Antes de colocar no ar

O `make prod` sobe um ambiente de producao funcional, mas alguns pontos
dependem de decisao sua. Edite o `.env` e ajuste:

1. **`SECRET_KEY`** — gere uma chave propria: `openssl rand -hex 32`.
   O valor padrao e publico e invalida a seguranca dos tokens.
2. **`POSTGRES_PASSWORD`** e **`ADMIN_PASSWORD`** — troque ambos.
3. **`WHATSAPP_TOKEN`** — segredo entre o backend e o serviço de WhatsApp:
   `openssl rand -hex 24`.
4. **`SEED_DEMO_DATA=false`** — evita criar os 11 profissionais de exemplo.
5. **HTTPS** — o nginx entregue aqui escuta apenas em HTTP na porta 80. Coloque
   um terminador TLS na frente (Caddy, Traefik, ALB) ou adicione um bloco 443
   com certificado em `infra/nginx/nginx.conf`.
6. **Backup dos volumes `db_data`, `media_data` e `whatsapp_data`** — sao o banco e as fotos
   de perfil enviadas pelos profissionais.

## Limites conhecidos

Pontos deliberadamente deixados para uma proxima etapa, para nao entregar
complexidade sem uso:

- **Pagamento de assinatura** nao esta integrado. A troca de plano aplica os
  limites na hora, mas nao cobra: falta plugar um gateway em
  `POST /api/v1/me/subscription`.
- **Portfolio de fotos** ainda nao existe: hoje o upload cobre so a foto de
  perfil. O campo `max_photos` dos planos ja esta modelado para isso.
- **Armazenamento local**: as fotos vao para um volume Docker (`media_data`),
  servido pela propria API. Funciona bem em um servidor unico; para varias
  instancias, troque `app/services/media.py` por S3 ou similar.
- **Envio automático** de mensagens ainda não existe: o centro de mensagens é
  manual. A confirmação de marcação seria o primeiro gatilho a ligar, na
  criação e na mudança de estado da marcação.
- **Geocodificacao automatica** de endereco nao existe. O profissional informa a
  cidade e, opcionalmente, captura as coordenadas pelo navegador; sem
  coordenadas ele so aparece nas buscas por nome de cidade.

## Testes

```bash
make test          # backend  (74 testes)
make test-web      # frontend (22 testes)
make test-whatsapp # servico WhatsApp (4 testes)
```

No backend, o calculo de distancia, o motor de agenda (geracao de horarios,
dias fechados, colisao com agendamentos, bloqueios, antecedencia minima,
horizonte maximo e a revalidacao no momento da reserva), a busca com ampliacao
automatica, as regras do agendamento interno e a deduplicacao do cadastro de
clientes.

No frontend, a geometria do recorte da foto (`src/lib/crop.ts`), o progresso do
guia de arranque (`src/lib/onboarding.ts`) e a validação das rotas: um teste percorre a árvore de páginas e confirma que todas as
ligações do código apontam para páginas que existem. O TypeScript não verifica
rotas — são apenas texto — e foi assim que uma reescrita automática partiu a
pesquisa sem que nada falhasse na compilação.
