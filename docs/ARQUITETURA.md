# Arquitetura do prihora

## Visao geral

```
                     +---------------------+
   navegador  ---->  |  nginx (so em prod) |
                     +----------+----------+
                                |
                 +--------------+--------------+
                 |                             |
        +--------v---------+         +---------v--------+
        | frontend (Next)  |  SSR ->  |  backend (API)   |
        |  React 19 / TS   | -------> |  FastAPI/Python  |
        +------------------+         +----+--------+----+
                                          |        |
                        +-----------------+   +----v-------------+
                        |                     |   PostgreSQL 16  |
             +----------v-----------+         +------------------+
             |  whatsapp (Node)     |
             |  Baileys, 1 sessao   |
             |  por profissional    |
             +----------------------+
```

Os servicos `whatsapp` e `db` nunca sao expostos no host: vivem so na rede
interna do compose.

Em desenvolvimento nao ha nginx: o navegador fala direto com o Next (3000) e com
a API (8000). Em producao somente o nginx expoe porta no host.

## Decisoes

**Busca por proximidade sem PostGIS.** O ranking usa a formula de haversine em
Python, com um pre-filtro de caixa envolvente em SQL que aproveita o indice
`(latitude, longitude)`. Isso evita depender de uma extensao do Postgres e mantem
a imagem oficial `postgres:16-alpine`. Para volumes muito maiores, migrar para
PostGIS e trocar apenas `app/services/search.py`.

**País e formatos.** A aplicação é de Portugal, não internacionalizada: há um
único idioma e uma única moeda, e isso está assumido no código em vez de
escondido atrás de uma camada de tradução que ninguém usaria. Os pontos de
mudança estão concentrados: `CITIES` e `DISTRICTS` no seed, `LOCALE`,
`CURRENCY` e `COUNTRY_CODE` no `format.ts`, e `DEFAULT_TIMEZONE` na
configuração.

O campo do distrito chama-se `state` na base de dados. É o nome genérico de
subdivisão administrativa que já existia; renomeá-lo obrigaria a mexer em
modelos, schemas, pesquisa e interface sem ganho para quem usa. Na interface
aparece sempre como "Distrito".

Dados de referência — categorias, localidades e planos — são sincronizados pelo
seed a cada arranque, e não apenas inseridos quando faltam. Sem isso, corrigir
um preço ou retirar localidades de outro país nunca chegaria a quem já tinha a
base criada.

**A localidade ordena, não corta.** A pesquisa devolve uma lista só, arrumada
em três camadas: quem atende a localidade pedida, depois os restantes do mais
perto para o mais longe, e por fim os destaques que ficaram de fora — também
por proximidade. Cada resultado traz o seu `group`, e a interface abre uma
secção sempre que a camada muda.

A camada é atribuída ao próprio resultado, e não calculada em consultas
separadas: a paginação atravessa as três de forma natural e ninguém aparece
duas vezes. Um perfil em destaque que já está na região fica na primeira
camada — estar em destaque não pode empurrá-lo para o fim.

Os filtros de serviço (texto, categoria, domicílio, preço) valem em todas as
camadas: o que deixou de excluir foi apenas a geografia. Quando a primeira
camada fica vazia, `expanded` fica a verdadeiro e a interface explica porquê.

Quem não tem coordenadas registadas não entra no cálculo de distância e vai
para o fim, atrás de todos os que têm.

**Agenda calculada, nao armazenada.** Nao existe tabela de "slots". Os horarios
livres sao derivados a cada consulta a partir de tres fontes: a grade semanal
(`availabilities`), os agendamentos que bloqueiam (`bookings` pendentes ou
confirmados) e os bloqueios pontuais (`time_offs`). Assim nao ha estado para
sincronizar e mudar a grade nao exige regerar nada.

**Fuso horario.** Tudo e persistido em UTC (`timestamptz`). A grade semanal e
interpretada no fuso do profissional (`professionals.timezone`) na hora de gerar
os horarios. A conversao vive em `app/services/agenda.py`.

**Revalidacao na reserva.** A agenda publica pode ficar desatualizada entre a
consulta e o clique. Por isso `slot_is_free()` refaz todas as checagens dentro do
POST de agendamento e devolve 409 se o horario tiver sido tomado, com o frontend
recarregando a agenda automaticamente.

**Fotos de perfil.** O recorte quadrado acontece no navegador: o usuario
posiciona e aproxima a imagem, e o canvas exporta exatamente o pedaco visivel.
Isso evita subir arquivos grandes e deixa o resultado previsivel para quem
edita. Nada disso e confiado, porem: o backend reabre o arquivo com o Pillow,
recusa o que nao for JPEG/PNG/WEBP e recodifica tudo em um JPEG 512x512. A
recodificacao tambem descarta EXIF e qualquer payload escondido, e o SVG fica
fora da lista de proposito, por ser XML capaz de carregar script.

A geometria do recorte vive isolada em `frontend/src/lib/crop.ts`, em funcoes
puras, para poder ser testada sem navegador.

Os arquivos ficam no volume `media_data`, servidos pela API em `/media`. Em
producao o nginx passa esse caminho adiante em vez de servir do disco, para o
comportamento ser identico ao de desenvolvimento; como o nome de cada arquivo
carrega um sufixo aleatorio, o cache pode ser longo sem risco de foto velha.

Em producao o container comeca como root apenas para acertar a posse do volume
e entao larga o privilegio com `setpriv` (ver `backend/docker-entrypoint.sh`).
Sem isso, um volume criado antes por um container de desenvolvimento - que roda
como root - deixaria a aplicacao sem permissao de escrita.

**Um canal só: o WhatsApp do próprio profissional.** O e-mail existiu e foi
retirado — mantinha um servidor SMTP e uma caixa de correio de desenvolvimento
para um canal que ninguém usava, quando a conversa nesta área acontece toda no
WhatsApp. O valor `email` continua no enum das mensagens, para as do histórico
permanecerem legíveis, mas nada novo o produz.

O Baileys é uma biblioteca de Node, por isso o WhatsApp vive num serviço à
parte, em `whatsapp/`. Cada profissional tem a sua pasta de credenciais dentro
de um volume — é o que mantém as contas separadas e faz a ligação sobreviver ao
reinício do container. O identificador da sessão vem sempre do token de quem
está autenticado, nunca do pedido: não há forma de pedir o código de outra
pessoa. O serviço só aceita chamadas com o segredo partilhado e falha fechado
se ele não estiver configurado.

A mensagem é guardada **antes** de se tentar enviar. Se o canal falhar, fica
registada como falhada com o motivo, em vez de desaparecer: o histórico
responde a "o que é que eu mandei a esta pessoa?" mesmo quando correu mal. E
guardamos o texto tal como saiu, não o modelo que lhe deu origem, porque o
modelo muda e o histórico tem de continuar a dizer o que a pessoa recebeu.

**Avisos automáticos.** Sete gatilhos, um por momento da marcação. A regra de
cada um — destinatários, textos e, nos lembretes, o desvio de tempo — vive na
base e não no código, porque cada profissional escreve à sua maneira;
os valores por omissão são semeados na primeira visita e voltam a ser criados
se um gatilho novo aparecer, sem migração de dados.

**Dois textos por gatilho, um por destinatário.** Não é a mesma frase enviada
duas vezes: ao cliente diz-se "a sua marcação está confirmada"; ao profissional
diz-se "nova marcação de X, telefone Y, às Z". São mensagens com fins
diferentes — uma informa, a outra serve para agir — e forçá-las a partilhar um
texto obrigaria a escrever um que não serve bem a nenhum dos dois. Por isso a
variável `{telefone_cliente}` existe: sem ela, o aviso ao profissional
obrigava-o a ir ao painel para saber a quem ligar.

Cada destinatário tem o seu interruptor, o que também substituiu a antiga
configuração de canais: "não enviar" passou a ser simplesmente não ter nenhum
destinatário ligado.

Três decisões que moldam o resto:

*O texto é guardado tal como saiu.* O modelo muda com o tempo; o histórico tem
de continuar a dizer o que a pessoa recebeu.

*A mensagem regista-se antes de se tentar enviar,* e a mensagem guarda o
gatilho que lhe deu origem. É isso que impede o mesmo aviso de sair duas vezes
para a mesma pessoa — o lembrete não se repete a cada passagem do trabalhador,
nem um estado é avisado duas vezes por engano.

*Uma mudança de estado feita à mão avisa só o cliente,* mesmo quando a regra
inclui o profissional: foi ele quem carregou no botão e não faz sentido receber
notícia do que acabou de fazer. O painel mostra o texto exato antes de aplicar,
em vez de um sim/não às cegas.

Os lembretes são os únicos avisos que não nascem de uma ação, por isso correm
num processo à parte que procura de minuto a minuto. Uma trava de sessão do
Postgres garante que, com vários processos, só um trabalha de cada vez.

**Guia de arranque.** Quem se regista como profissional cai num painel que
ainda não tem nada para mostrar. O guia em `/painel/comecar` resolve isso com
cinco passos — apresentação, localidade, serviços, horários e publicação — e os
formulários vivem no próprio guia, sem atirar a pessoa para cinco páginas
diferentes. Cada passo grava pelos mesmos endpoints do painel: não há API
paralela para manter.

O registo pede apenas nome, e-mail e palavra-passe. Perguntar nome público,
especialidades e localidade logo à entrada alongava o formulário no momento em
que a pessoa ainda não sabe se vai ficar; esses campos passaram para o guia,
onde há espaço para explicar cada um.

Os serviços de exemplo vivem em `backend/app/services/suggestions.py`, por
especialidade. O que já está registado desaparece da lista — sugerir de novo o
que se acabou de acrescentar só criaria dúvida sobre se ficou ou não.

O botão "usar a minha localização" preenche morada, localidade, distrito e
código postal de uma vez. A tradução de coordenadas em morada passa pelo
backend (`app/services/geocoding.py`) e não pelo navegador: o Nominatim exige
um User-Agent identificável e limita a cadência, e assim podemos guardar em
memória o que já perguntámos. Em Portugal o distrito vem no campo `county`, e
só o aceitamos se existir na nossa lista — o serviço devolve por vezes a área
metropolitana, que não serviria nem o formulário nem a pesquisa. Se o serviço
externo falhar, a localidade e o distrito ainda saem da cidade conhecida mais
próxima, e as coordenadas ficam sempre guardadas: são elas que fazem o perfil
aparecer nas pesquisas por proximidade.

O cálculo do progresso está isolado em `frontend/src/lib/onboarding.ts`, em
funções puras, porque duas coisas dependem dele: o guia e o cartão da visão
geral. Esse cartão desaparece assim que os cinco passos estão feitos — um
cartão que só diz "está tudo certo" é ruído no painel de todos os dias. Só
entram passos mesmo necessários para receber marcações; a foto de perfil é
sugerida dentro do primeiro passo, mas não trava a conclusão.

**Agendamento interno.** O profissional pode lancar atendimentos pelo painel, e
ali as regras sao outras: nao valem a grade de horarios, os bloqueios nem a
antecedencia minima, porque quem lanca e o dono da agenda e pode estar
registrando um encaixe, um horario extra ou um atendimento que ja aconteceu. A
unica trava e nao ocupar o mesmo horario duas vezes, isolada em
`has_booking_conflict()`, que tambem e usada pela agenda publica como uma de
suas varias checagens.

**Cadastro de clientes.** Cada profissional tem a sua propria lista: a mesma
pessoa pode existir para dois profissionais, com anotacoes diferentes, e nao se
confunde com a conta de usuario do prihora, que e opcional. A ficha e criada
sozinha a cada agendamento, publico ou interno, e a deduplicacao usa o telefone
so com digitos, para casar "(11) 98888-7777" com "11988887777". Nao ha
unicidade no banco de proposito: mae e filha podem dividir o mesmo numero.

**Autenticacao.** JWT assinado com HS256, guardado no `localStorage` e enviado no
header `Authorization`. As paginas publicas sao renderizadas no servidor sem
autenticacao; as areas logadas sao componentes de cliente protegidos por
`DashboardShell`, com a autorizacao real aplicada no backend.

**Schema.** Versionado com Alembic. `python -m app.cli init` aplica as
migrations pendentes e depois roda o seed, que e idempotente: rodar de novo nao
duplica dados. `create_all()` foi abandonado porque cria tabelas novas mas nunca
altera as existentes, o que silenciosamente deixava colunas novas de fora.

Bancos criados antes do Alembic sao adotados sem intervencao: ao encontrar um
banco com tabelas e sem `alembic_version`, marcamos a revisao inicial como
aplicada e seguimos das seguintes.

## Mapa do codigo

| Caminho | Papel |
| --- | --- |
| `backend/app/models/` | Tabelas e relacionamentos (SQLAlchemy 2.0) |
| `backend/app/schemas/` | Contratos de entrada e saida (Pydantic v2) |
| `backend/app/api/v1/` | Rotas: `public`, `auth`, `professional`, `admin` |
| `backend/app/services/agenda.py` | Motor de horarios livres |
| `backend/app/services/search.py` | Busca, filtros e ranking |
| `backend/app/services/geo.py` | Haversine e caixa envolvente |
| `backend/app/services/media.py` | Validacao e normalizacao das fotos |
| `backend/app/services/clients.py` | Ficha do cliente e deduplicacao |
| `backend/app/services/suggestions.py` | Servicos de exemplo por especialidade |
| `backend/app/services/geocoding.py` | Coordenadas para morada, com plano B |
| `backend/app/services/messaging.py` | Envio pelos dois canais e registo |
| `backend/app/services/notifications.py` | Gatilhos e despacho dos avisos |
| `backend/app/services/templates.py` | Modelos de texto e variaveis |
| `backend/app/services/reminders.py` | Lembretes, com trava entre processos |
| `backend/app/services/whatsapp.py` | Ponte para o servico de WhatsApp |
| `whatsapp/src/sessions.js` | Sessoes Baileys, uma por profissional |
| `backend/alembic/versions/` | Migrations do schema |
| `backend/app/seed/` | Categorias, cidades, planos e demonstracao |
| `frontend/src/app/` | Rotas do App Router |
| `frontend/src/components/` | UI compartilhada |
| `frontend/src/lib/api.ts` | Cliente HTTP (browser e SSR) |
| `frontend/src/lib/crop.ts` | Geometria do recorte, com testes |
| `frontend/src/lib/onboarding.ts` | Passos e progresso do arranque |

## Papeis

- **client** — busca, agenda e avalia. Agendar tambem funciona sem conta.
- **professional** — perfil publico, servicos, agenda, agendamentos e plano.
- **admin** — aprova e suspende perfis, gerencia contas e planos, ve metricas.

O cadastro publico nunca cria administradores: `POST /auth/register` rebaixa
qualquer tentativa de `role=admin` para `client`.
