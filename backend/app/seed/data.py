"""Dados iniciais do prihora: categorias, cidades, planos e demonstração."""

# --------------------------------------------------------------- categorias ---
CATEGORIES = [
    ("manicure", "Manicure", "Cuidados e verniz das unhas das mãos.", "hand", 10),
    ("pedicure", "Pedicure", "Cuidados e verniz das unhas dos pés.", "foot", 20),
    ("unhas-em-gel", "Unhas de gel", "Alongamento e fibra de vidro em gel.", "sparkles", 30),
    ("podologia", "Podologia", "Tratamento clínico dos pés: unha encravada, calosidades, micoses.", "stethoscope", 40),
    ("tatuagem", "Tatuagem", "Tatuagens autorais, cobertura e retoque.", "pen", 50),
    ("piercing", "Piercing", "Aplicação e troca de piercings com material esterilizado.", "circle", 60),
    ("sobrancelhas", "Sobrancelhas", "Design, henna, brow lamination e micropigmentação.", "eye", 70),
    ("pestanas", "Pestanas", "Extensão de pestanas, lash lifting e volume russo.", "eye", 80),
    ("depilacao", "Depilação", "Cera, linha e laser.", "wave", 90),
    ("maquilhagem", "Maquilhagem", "Social, noiva e produção para eventos.", "brush", 100),
    ("cabelo", "Cabelo", "Corte, coloração, tratamento e penteado.", "scissors", 110),
    ("barbearia", "Barbearia", "Corte masculino, barba e acabamento.", "razor", 120),
    ("massagem", "Massagem", "Relaxante, modeladora, drenagem e pedras quentes.", "hands", 130),
    ("estetica-facial", "Estética facial", "Limpeza de pele, peeling e skincare.", "face", 140),
    ("estetica-corporal", "Estética corporal", "Drenagem linfática, criolipólise e radiofrequência.", "body", 150),
]

# ----------------------------------------------------------------- planos ---
# (slug, nome, descrição, preço_cêntimos, serviços, fotos, marcações,
#  destaque, agenda, análises, apoio, dias_grátis, ativo, padrão, ordem)
PLANS = [
    (
        "gratuito", "Gratuito",
        "Para começar a receber clientes pelo prihora sem custo.",
        0, 3, 3, 20, False, True, False, False, 0, True, True, 10,
    ),
    (
        "essencial", "Essencial",
        "Perfil completo, agenda online e mais serviços registados.",
        990, 15, 15, 200, False, True, True, False, 14, True, False, 20,
    ),
    (
        "profissional", "Profissional",
        "Destaque nos resultados de pesquisa e relatórios de desempenho.",
        1990, 40, 40, 1000, True, True, True, True, 14, True, False, 30,
    ),
    (
        "estudio", "Estúdio",
        "Para estúdios e equipas: serviços ilimitados e apoio prioritário.",
        3990, 200, 100, 100000, True, True, True, True, 14, True, False, 40,
    ),
]

# ---------------------------------------------------------------- cidades ---
# (nome, distrito, latitude, longitude, populacao aproximada)
CITIES = [
    ("Lisboa", "Lisboa", 38.7223, -9.1393, 545796),
    ("Porto", "Porto", 41.1579, -8.6291, 231962),
    ("Vila Nova de Gaia", "Porto", 41.1239, -8.6118, 302295),
    ("Amadora", "Lisboa", 38.7538, -9.2308, 175136),
    ("Braga", "Braga", 41.5454, -8.4265, 193333),
    ("Almada", "Setúbal", 38.6790, -9.1569, 174030),
    ("Matosinhos", "Porto", 41.1844, -8.6939, 175478),
    ("Coimbra", "Coimbra", 40.2033, -8.4103, 143396),
    ("Gondomar", "Porto", 41.1496, -8.5324, 168027),
    ("Funchal", "Madeira", 32.6669, -16.9241, 105795),
    ("Seixal", "Setúbal", 38.6404, -9.1030, 166825),
    ("Guimarães", "Braga", 41.4425, -8.2918, 158124),
    ("Sintra", "Lisboa", 38.8029, -9.3817, 385606),
    ("Cascais", "Lisboa", 38.6979, -9.4215, 214158),
    ("Oeiras", "Lisboa", 38.6979, -9.3018, 172120),
    ("Loures", "Lisboa", 38.8309, -9.1685, 199494),
    ("Odivelas", "Lisboa", 38.7938, -9.1836, 148156),
    ("Setúbal", "Setúbal", 38.5244, -8.8882, 117110),
    ("Barcelos", "Braga", 41.5388, -8.6151, 116625),
    ("Maia", "Porto", 41.2354, -8.6199, 135306),
    ("Vila Franca de Xira", "Lisboa", 38.9553, -8.9903, 136886),
    ("Aveiro", "Aveiro", 40.6405, -8.6538, 78450),
    ("Faro", "Faro", 37.0194, -7.9304, 67650),
    ("Leiria", "Leiria", 39.7443, -8.8070, 128640),
    ("Viseu", "Viseu", 40.6566, -7.9122, 99274),
    ("Ponta Delgada", "Açores", 37.7412, -25.6756, 68809),
    ("Santarém", "Santarém", 39.2362, -8.6859, 61752),
    ("Évora", "Évora", 38.5714, -7.9135, 53591),
    ("Viana do Castelo", "Viana do Castelo", 41.6918, -8.8344, 85813),
    ("Castelo Branco", "Castelo Branco", 39.8222, -7.4931, 55708),
    ("Vila Real", "Vila Real", 41.3006, -7.7441, 51850),
    ("Guarda", "Guarda", 40.5373, -7.2676, 42541),
    ("Bragança", "Bragança", 41.8061, -6.7567, 35341),
    ("Beja", "Beja", 38.0150, -7.8632, 35854),
    ("Portalegre", "Portalegre", 39.2967, -7.4285, 22300),
    ("Póvoa de Varzim", "Porto", 41.3833, -8.7667, 63408),
    ("Santa Maria da Feira", "Aveiro", 40.9271, -8.5487, 139309),
    ("Paredes", "Porto", 41.2059, -8.3327, 86854),
    ("Valongo", "Porto", 41.1896, -8.4986, 93858),
    ("Vila do Conde", "Porto", 41.3517, -8.7419, 79533),
    ("Famalicão", "Braga", 41.4090, -8.5195, 133832),
    ("Penafiel", "Porto", 41.2077, -8.2841, 72265),
    ("Ovar", "Aveiro", 40.8592, -8.6249, 55398),
    ("Torres Vedras", "Lisboa", 39.0918, -9.2588, 79465),
    ("Mafra", "Lisboa", 38.9370, -9.3269, 86515),
    ("Barreiro", "Setúbal", 38.6634, -9.0725, 78764),
    ("Montijo", "Setúbal", 38.7060, -8.9744, 55298),
    ("Palmela", "Setúbal", 38.5686, -8.9017, 66300),
    ("Loulé", "Faro", 37.1372, -8.0217, 70622),
    ("Portimão", "Faro", 37.1365, -8.5379, 59896),
    ("Olhão", "Faro", 37.0286, -7.8412, 45396),
    ("Albufeira", "Faro", 37.0891, -8.2503, 44158),
    ("Caldas da Rainha", "Leiria", 39.4076, -9.1360, 51729),
    ("Marinha Grande", "Leiria", 39.7500, -8.9333, 38681),
    ("Pombal", "Leiria", 39.9167, -8.6333, 55217),
    ("Águeda", "Aveiro", 40.5747, -8.4455, 47729),
    ("Amarante", "Porto", 41.2712, -8.0819, 56264),
    ("Chaves", "Vila Real", 41.7404, -7.4711, 41243),
    ("Covilhã", "Castelo Branco", 40.2807, -7.5041, 51797),
    ("Tomar", "Santarém", 39.6039, -8.4104, 40677),
]

# Distritos de Portugal, mais as regiões autónomas. Usados no formulário
# de perfil e na validação da localidade.
DISTRICTS = [
    "Aveiro", "Beja", "Braga", "Bragança", "Castelo Branco", "Coimbra",
    "Évora", "Faro", "Guarda", "Leiria", "Lisboa", "Portalegre", "Porto",
    "Santarém", "Setúbal", "Viana do Castelo", "Vila Real", "Viseu",
    "Açores", "Madeira",
]

# ------------------------------------------------------- profissionais demo ---
# Cada entrada: dados do perfil + serviços (nome, duração, preço em cêntimos)
DEMO_PROFESSIONALS = [
    {
        "email": "ana.sousa@prihora.pt",
        "name": "Ana Sousa",
        "display_name": "Ana Sousa Nail Designer",
        "headline": "Nail designer há 8 anos — gel e fibra de vidro",
        "bio": (
            "Trabalho com alongamento em gel, fibra de vidro e blindagem. "
            "Atendimento individual, com hora marcada e material esterilizado. "
            "Estúdio próprio em Campo de Ourique, com opção de deslocação ao domicílio."
        ),
        "categories": ["manicure", "pedicure", "unhas-em-gel"],
        "city": "Lisboa", "state": "Lisboa", "neighborhood": "Campo de Ourique",
        "address_line": "Rua Ferreira Borges, 112",
        "postal_code": "1350-129",
        "lat": 38.7168, "lng": -9.1673,
        "phone": "912 345 678", "instagram": "anasousa.nails",
        "at_home": True, "featured": True, "verified": True,
        "rating": 4.9, "reviews": 127, "plan": "profissional",
        "services": [
            ("Alongamento em gel", 120, 4500),
            ("Manutenção de gel", 90, 3000),
            ("Manicure simples", 45, 1400),
            ("Pedicure completa", 60, 1800),
            ("Spa de pés", 75, 2500),
        ],
    },
    {
        "email": "carla.mendes@prihora.pt",
        "name": "Carla Mendes",
        "display_name": "Carla Mendes Podologia",
        "headline": "Podologista — unha encravada, calosidades e micoses",
        "bio": (
            "Podologista com cédula profissional e 12 anos de clínica. "
            "Trato unha encravada, calosidades, micoses e pé diabético. "
            "Gabinete com autoclave e protocolo de biossegurança."
        ),
        "categories": ["podologia", "pedicure"],
        "city": "Lisboa", "state": "Lisboa", "neighborhood": "Alvalade",
        "address_line": "Avenida da Igreja, 45",
        "postal_code": "1700-235",
        "lat": 38.7527, "lng": -9.1440,
        "phone": "913 776 220", "instagram": "carlamendes.podo",
        "at_home": True, "featured": True, "verified": True,
        "rating": 5.0, "reviews": 89, "plan": "profissional",
        "services": [
            ("Consulta de podologia completa", 60, 3500),
            ("Tratamento de unha encravada", 45, 3000),
            ("Remoção de calosidades", 40, 2500),
            ("Podologia para diabéticos", 60, 4000),
        ],
    },
    {
        "email": "rafael.tattoo@prihora.pt",
        "name": "Rafael Lima",
        "display_name": "Rafael Lima Tattoo",
        "headline": "Blackwork e fineline — orçamento sem compromisso",
        "bio": (
            "Tatuador há 10 anos, especializado em blackwork, fineline e cobertura. "
            "Estúdio privativo no Bairro Alto, material descartável e tinta importada. "
            "Orçamento por WhatsApp com foto da referência."
        ),
        "categories": ["tatuagem", "piercing"],
        "city": "Lisboa", "state": "Lisboa", "neighborhood": "Bairro Alto",
        "address_line": "Rua da Rosa, 208",
        "postal_code": "1200-387",
        "lat": 38.7139, "lng": -9.1459,
        "phone": "916 655 303", "instagram": "rafaellima.ink",
        "at_home": False, "featured": True, "verified": True,
        "rating": 4.8, "reviews": 204, "plan": "estudio",
        "services": [
            ("Sessão de tatuagem (1h)", 60, 8000),
            ("Sessão de tatuagem (3h)", 180, 21000),
            ("Fineline pequena", 45, 6000),
            ("Aplicação de piercing", 30, 3000),
            ("Retoque", 45, 0),
        ],
    },
]

DEMO_PROFESSIONALS += [
    {
        "email": "juliana.brows@prihora.pt",
        "name": "Juliana Ferreira",
        "display_name": "Juliana Ferreira Brow Studio",
        "headline": "Design de sobrancelhas, henna e brow lamination",
        "bio": (
            "Especialista em visagismo de sobrancelhas. Design personalizado com "
            "mapeamento facial, henna, brow lamination e micropigmentação fio a fio."
        ),
        "categories": ["sobrancelhas", "pestanas", "depilacao"],
        "city": "Porto", "state": "Porto", "neighborhood": "Cedofeita",
        "address_line": "Rua de Cedofeita, 340",
        "postal_code": "4050-176",
        "lat": 41.1520, "lng": -8.6156,
        "phone": "915 544 404", "instagram": "ju.browstudio",
        "at_home": False, "featured": False, "verified": True,
        "rating": 4.7, "reviews": 63, "plan": "essencial",
        "services": [
            ("Design com henna", 50, 2200),
            ("Design simples", 30, 1200),
            ("Brow lamination", 70, 4500),
            ("Extensão de pestanas volume russo", 120, 5500),
            ("Lash lifting", 60, 3500),
        ],
    },
    {
        "email": "patricia.estetica@prihora.pt",
        "name": "Patrícia Rocha",
        "display_name": "Patrícia Rocha Estética",
        "headline": "Limpeza de pele profunda e protocolos de skincare",
        "bio": (
            "Esteticista com 15 anos de experiência em estética facial e corporal. "
            "Protocolos personalizados de limpeza de pele, peeling químico e "
            "drenagem linfática."
        ),
        "categories": ["estetica-facial", "estetica-corporal", "massagem"],
        "city": "Braga", "state": "Braga", "neighborhood": "São Vítor",
        "address_line": "Rua dos Chãos, 78",
        "postal_code": "4700-207",
        "lat": 41.5503, "lng": -8.4201,
        "phone": "914 433 505", "instagram": "patriciarocha.estetica",
        "at_home": True, "featured": False, "verified": True,
        "rating": 4.9, "reviews": 41, "plan": "essencial",
        "services": [
            ("Limpeza de pele profunda", 90, 4500),
            ("Peeling químico", 60, 5500),
            ("Drenagem linfática corporal", 60, 4000),
            ("Massagem relaxante", 60, 3500),
            ("Massagem modeladora", 60, 4200),
        ],
    },
    {
        "email": "bruno.barber@prihora.pt",
        "name": "Bruno Alves",
        "display_name": "Bruno Alves Barbearia",
        "headline": "Corte masculino, barba e acabamento à navalha",
        "bio": (
            "Barbeiro com 7 anos de ofício. Corte à tesoura, degradê, barba com "
            "toalha quente e acabamento à navalha. Atendimento com hora marcada, sem fila."
        ),
        "categories": ["barbearia", "cabelo"],
        "city": "Porto", "state": "Porto", "neighborhood": "Bonfim",
        "address_line": "Rua do Bonfim, 512",
        "postal_code": "4300-069",
        "lat": 41.1487, "lng": -8.5934,
        "phone": "933 322 606", "instagram": "brunoalves.barber",
        "at_home": False, "featured": True, "verified": True,
        "rating": 4.8, "reviews": 156, "plan": "profissional",
        "services": [
            ("Corte masculino", 45, 1500),
            ("Corte e barba", 75, 2400),
            ("Barba completa", 40, 1200),
            ("Descoloração platinada", 180, 6500),
        ],
    },
    {
        "email": "leticia.makeup@prihora.pt",
        "name": "Letícia Barros",
        "display_name": "Letícia Barros Makeup",
        "headline": "Maquilhagem para noivas, madrinhas e eventos",
        "bio": (
            "Maquilhadora profissional especializada em noivas. Deslocação ao "
            "domicílio, com prova de maquilhagem incluída e produtos à prova de "
            "água de longa duração."
        ),
        "categories": ["maquilhagem", "cabelo"],
        "city": "Coimbra", "state": "Coimbra", "neighborhood": "Baixa",
        "address_line": "Rua da Sofia, 130",
        "postal_code": "3000-389",
        "lat": 40.2110, "lng": -8.4293,
        "phone": "932 211 707", "instagram": "leticiabarros.makeup",
        "at_home": True, "featured": False, "verified": False,
        "rating": 4.6, "reviews": 28, "plan": "essencial",
        "services": [
            ("Maquilhagem social", 60, 4000),
            ("Maquilhagem de noiva com prova", 180, 18000),
            ("Maquilhagem e penteado", 150, 10000),
            ("Maquilhagem para eventos", 90, 6000),
        ],
    },
]

DEMO_PROFESSIONALS += [
    {
        "email": "marcia.depil@prihora.pt",
        "name": "Márcia Nunes",
        "display_name": "Márcia Nunes Depilação",
        "headline": "Depilação com cera quente e linha egípcia",
        "bio": (
            "Depilação com cera quente hipoalergénica e técnica egípcia com linha. "
            "Gabinete reservado, higienizado e atendimento acolhedor."
        ),
        "categories": ["depilacao", "sobrancelhas"],
        "city": "Vila Nova de Gaia", "state": "Porto", "neighborhood": "Mafamude",
        "address_line": "Rua Conselheiro Veloso da Cruz, 210",
        "postal_code": "4400-092",
        "lat": 41.1265, "lng": -8.6042,
        "phone": "911 100 808", "instagram": "marcianunes.depil",
        "at_home": False, "featured": False, "verified": True,
        "rating": 4.5, "reviews": 34, "plan": "gratuito",
        "services": [
            ("Depilação perna inteira", 45, 2200),
            ("Depilação axilas", 20, 900),
            ("Depilação virilha completa", 40, 2500),
        ],
    },
    {
        "email": "fernanda.hair@prihora.pt",
        "name": "Fernanda Dias",
        "display_name": "Fernanda Dias Cabeleireira",
        "headline": "Coloração, madeixas e tratamento capilar",
        "bio": (
            "Cabeleireira especializada em coloração e loiros. Trabalho com madeixas, "
            "morena iluminada e reconstrução capilar. Faço diagnóstico antes de "
            "qualquer química."
        ),
        "categories": ["cabelo"],
        "city": "Cascais", "state": "Lisboa", "neighborhood": "Estoril",
        "address_line": "Avenida de Sabóia, 88",
        "postal_code": "2765-278",
        "lat": 38.7057, "lng": -9.3961,
        "phone": "910 099 909", "instagram": "fernandadias.hair",
        "at_home": False, "featured": False, "verified": True,
        "rating": 4.7, "reviews": 72, "plan": "essencial",
        "services": [
            ("Corte feminino", 60, 2500),
            ("Coloração completa", 150, 7000),
            ("Madeixas", 240, 11000),
            ("Reconstrução capilar", 90, 4500),
            ("Brushing", 45, 1800),
        ],
    },
    {
        "email": "sandra.nails@prihora.pt",
        "name": "Sandra Oliveira",
        "display_name": "Sandra Oliveira Unhas",
        "headline": "Manicure e pedicure ao domicílio na margem sul",
        "bio": (
            "Atendo apenas ao domicílio em Almada e no Seixal. "
            "Levo todo o material esterilizado e alicates individuais."
        ),
        "categories": ["manicure", "pedicure"],
        "city": "Almada", "state": "Setúbal", "neighborhood": "Pragal",
        "address_line": "Rua Bernardo Francisco da Costa, 34",
        "postal_code": "2800-029",
        "lat": 38.6712, "lng": -9.1610,
        "phone": "918 811 112", "instagram": "sandraoliveira.unhas",
        "at_home": True, "featured": False, "verified": False,
        "rating": 4.4, "reviews": 19, "plan": "gratuito",
        "services": [
            ("Manicure ao domicílio", 50, 1600),
            ("Pedicure ao domicílio", 60, 1900),
            ("Conjunto mãos e pés", 100, 3000),
        ],
    },
    {
        "email": "novo.profissional@prihora.pt",
        "name": "Taís Moreira",
        "display_name": "Taís Moreira Studio",
        "headline": "Registo recém-enviado, a aguardar aprovação",
        "bio": (
            "Perfil de exemplo com registo pendente, para testar a fila do "
            "sector administrativo."
        ),
        "categories": ["pestanas", "sobrancelhas"],
        "city": "Faro", "state": "Faro", "neighborhood": "Baixa",
        "address_line": "Rua de Santo António, 61",
        "postal_code": "8000-283",
        "lat": 37.0161, "lng": -7.9350,
        "phone": "930 011 223", "instagram": "taismoreira.studio",
        "at_home": False, "featured": False, "verified": False,
        "rating": 0.0, "reviews": 0, "plan": "gratuito",
        "pending": True,
        "services": [
            ("Extensão de pestanas fio a fio", 120, 4000),
            ("Design de sobrancelhas", 30, 1200),
        ],
    },
]
