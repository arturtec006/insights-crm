# Insights Analytics — CRM com captação automática de leads

Aplicação full-stack multi-tenant (multi-empresa) com duas metades que se alimentam:

- **CRM** — leads, funil kanban de negócios e histórico de contatos.
- **Garimpo** — um worker que encontra negócios reais por nicho e cidade, visita o site
  de cada um para achar contato, remove duplicados, pontua contra o seu ICP e joga tudo
  direto no CRM.

Mais os dashboards de **Vendas**, **Clientes** e **Financeiro**, com autenticação real,
controle de acesso por papel (RBAC) e isolamento de dados entre empresas.

## Stack

- **Backend:** Node.js, Express, TypeScript, Prisma ORM, PostgreSQL
- **Frontend:** React, TypeScript, Vite, Tailwind CSS v4, Recharts, React Query, Zustand, React Router
- **Deploy:** Vercel (serverless) ou qualquer host sempre ligado — veja [DEPLOY.md](DEPLOY.md)

## Como rodar

Você precisa de um Postgres. O tier gratuito do [Neon](https://neon.tech) serve tanto
para desenvolvimento quanto para produção (use branches diferentes do mesmo projeto).

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env      # preencha DATABASE_URL, DIRECT_URL e os segredos JWT
npx prisma migrate deploy # cria as tabelas
npm run prisma:seed       # dados de demonstração (nunca rode em produção)
npm run dev               # http://localhost:4000
```

Gere segredos JWT reais com
`node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`.
**Nunca reutilize os mesmos segredos entre ambientes.**

### 2. Frontend

```bash
cd frontend
npm install
npm run dev   # http://localhost:5173
```

O Vite faz proxy de `/api/*` para `http://localhost:4000`, então frontend e backend
funcionam como uma única origem em desenvolvimento (sem problemas de CORS/cookies).

### Contas de demonstração

Duas empresas (tenants) são criadas pelo seed, cada uma com 3 usuários (um por papel):

| Empresa | E-mail | Senha | Papel |
|---|---|---|---|
| Aurora Tecnologia | admin@aurora.com | Admin123!Secure | Administrador |
| Aurora Tecnologia | manager@aurora.com | Manager123!Secure | Gerente |
| Aurora Tecnologia | analyst@aurora.com | Analyst123!Secure | Analista |
| Nimbus Varejo | admin@nimbus.com | Admin123!Secure | Administrador |

Entre com contas de empresas diferentes para confirmar que os dados nunca se misturam.

## Garimpo de leads — como funciona

Menu **Garimpo** → escolha nicho + cidade → *Iniciar garimpo*. A tela mostra o progresso
ao vivo.

O worker é **retomável**: todo o estado da busca (resultados da fonte, cursor, contadores)
vive no banco, nunca na memória do processo. Isso tem duas consequências práticas:

- O mesmo código roda em **serverless** — a tela pede uma fatia por vez via
  `POST /api/prospecting/jobs/:id/tick`, cada uma cabendo no limite de tempo do host — e
  em **host sempre ligado**, onde `PROSPECTING_INLINE=true` termina o job sozinho.
- Uma busca interrompida (aba fechada, deploy no meio, servidor reiniciado) **retoma do
  ponto onde parou**, mantendo tudo que já capturou. Ela não é perdida nem reimportada.

Ticks simultâneos são seguros: o job carrega um lock, então uma segunda aba recebe o
estado atual em vez de importar os mesmos negócios de novo.

### O pipeline, em ordem

1. **Geocoding** — a cidade vira coordenadas via Nominatim.
2. **Busca** — o nicho digitado é traduzido para tags reais do OpenStreetMap
   (`src/prospecting/niches.ts`, 30 nichos mapeados) e consultado no Overpass.
3. **Normalização** — telefone vira E.164, site vira domínio puro, Instagram vira handle.
   É isso que faz `(11) 98765-4321` e `+55 11 98765 4321` colapsarem no mesmo lead.
4. **Supressão (LGPD)** — quem está na lista de não-contactar é pulado, mesmo reaparecendo
   na fonte.
5. **Deduplicação** — impressão digital `telefone > domínio > nome+cidade`, com índice
   único `(organizationId, dedupeKey)` no banco. Rodar a mesma busca duas vezes não duplica.
6. **Enriquecimento** — visita o site do negócio (respeitando `robots.txt`, uma requisição
   por host, no máximo 3 páginas) e extrai e-mail, Instagram e WhatsApp.
7. **Scoring** — 0-100 por um perfil escolhido, guardando *cada sinal* que gerou a nota,
   para o lead poder explicar seu próprio score na tela.

### Perfis de pontuação

| Perfil | Para quem | Prioriza |
|---|---|---|
| Contactabilidade | Quem quer falar com o máximo de gente hoje | Telefone, e-mail, site e redes preenchidos |
| Precisa de presença digital | Quem vende site, tráfego ou marketing | Tem telefone e **não** tem site |

### Fontes de dados

| Fonte | Custo | Cobertura |
|---|---|---|
| **OpenStreetMap** (padrão) | Gratuito, sem chave, licença ODbL | Nome e endereço em quase todos; **telefone em ~40%**, site em ~25% |
| **Google Places** | Pago, exige `GOOGLE_PLACES_API_KEY` | Bem melhor, mas os termos do Google restringem o armazenamento dos campos |

Os números de cobertura acima são medidos, não estimados: uma busca real por clínicas
odontológicas em Campinas devolveu 21 negócios, 9 com telefone e 5 com site.

**Não raspamos HTML do Google Maps** — viola os termos de uso e quebra sem aviso. Trocar
de fonte é uma linha, porque ambas implementam a mesma interface `SourceProvider`.

### Limites deliberados

- **Uma busca por vez por empresa.** As fontes públicas são compartilhadas e limitadas.
- **Intervalo mínimo entre requisições por host**, com `User-Agent` identificável — exigência
  explícita da política de uso do Nominatim e do Overpass.
- **Retry com backoff + mirror**: o Overpass público responde 429 quando não tem slot livre,
  o que é rotina e não erro. O worker espera e tenta de novo antes de desistir.
- **Só MANAGER/ADMIN inicia uma busca**, porque cada execução gasta cota externa (e dinheiro,
  com o Google Places configurado).
- **Nichos sem cobertura não são oferecidos.** O OSM mapeia bem negócio local com endereço
  físico; agências e consultorias praticamente não existem lá. Oferecer esses nichos
  devolveria zero resultados sem explicar por quê.

## LGPD

Dado de pessoa jurídica está fora do escopo da lei, mas MEI e autônomo têm telefone pessoal —
que é dado pessoal. O que o sistema faz a respeito:

- **Origem registrada.** Todo lead guarda `source`, `sourceRef` e o payload cru da fonte,
  além de um evento no histórico dizendo de qual busca ele veio.
- **Lista de não-contactar.** O botão *Não contatar* na tela do lead grava telefone, domínio
  e e-mail na tabela `SuppressionEntry`. O worker consulta essa lista antes de criar
  qualquer lead — um negócio que pediu para sair **não volta**, mesmo que a fonte o
  redescubra e mesmo que o lead tenha sido apagado.
- **Auditoria.** Supressão, conversão, exclusão de lead e início de busca vão para o `AuditLog`.

## Segurança — o que foi implementado e por quê

| Camada | Medida | Motivo |
|---|---|---|
| Senhas | `bcrypt` (12 rounds), nunca armazenadas em texto puro | Vazamento do banco não expõe credenciais |
| Sessão | JWT de acesso (15 min) em cookie **httpOnly** + refresh token opaco (7 dias), também httpOnly | Token de acesso nunca é acessível via JavaScript/XSS; vida curta reduz janela de risco |
| Rotação de refresh token | Cada uso gera um novo par e revoga o anterior; reuso de um token já revogado revoga **toda** a família de tokens do usuário | Detecta e neutraliza roubo de refresh token (replay attack) |
| Autorização | RBAC (`ADMIN` / `MANAGER` / `ANALYST`) reforçado no backend em toda rota sensível; o frontend só usa o papel para ocultar UI, nunca como controle real | Verificação client-side é cosmética; a de servidor é a que importa |
| Multi-tenant | Toda consulta ao banco é filtrada por `organizationId` extraído do token assinado pelo servidor — nunca aceito do cliente | Uma empresa jamais acessa dados de outra, mesmo manipulando a requisição |
| Força bruta | Rate limiting nas rotas de login (20 tentativas/15 min) e bloqueio de conta após 5 falhas consecutivas (15 min) | Mitiga ataques de dicionário/credential stuffing |
| Mensagens de erro | Login sempre retorna erro genérico ("e-mail ou senha inválidos") | Evita enumeração de e-mails cadastrados |
| Cabeçalhos HTTP | `helmet` (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, etc.) | Mitiga XSS, clickjacking, MIME sniffing |
| CORS | Origem única e explícita + `credentials: true` | Impede que sites de terceiros façam requisições autenticadas em nome do usuário |
| Validação de entrada | `zod` em todo payload recebido | Impede payloads malformados/maliciosos de chegar ao banco |
| Auditoria | Tabela `AuditLog` registra login/falha/bloqueio, criação/alteração de usuário, com IP e user-agent | Rastreabilidade para investigação de incidentes |
| Exclusão de usuário | Soft-delete (`isActive: false`) em vez de exclusão física | Preserva histórico/integridade referencial e auditoria |
| Segredos | `.env` fora do controle de versão; segredos gerados aleatoriamente (64 bytes) | Reduz risco de vazamento e credenciais fracas |

### Checklist para produção

- Apontar `DATABASE_URL` (pooled) e `DIRECT_URL` (direta) para o Postgres gerenciado
  — veja [DEPLOY.md](DEPLOY.md) para o passo a passo.
- Definir `COOKIE_SECURE=true` e servir tudo via HTTPS.
- Gerar novos segredos JWT (`JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`) únicos por ambiente.
- Colocar a API atrás de um proxy/load balancer que preserve o cabeçalho `X-Forwarded-For`.
- Considerar 2FA (TOTP) para contas `ADMIN`.
- Rotina periódica para expurgar `RefreshToken` e `AuditLog` expirados/antigos.

## Design

- Sistema de cores validado para acessibilidade (contraste e distinção para daltonismo),
  com tema claro/escuro completo controlado por `data-theme` + `prefers-color-scheme`.
- Paleta categórica de gráficos com ordem fixa (nunca atribuída por índice dinâmico), tooltips
  interativos, legendas sempre visíveis a partir de 2 séries, e rótulos diretos em listas de barras.
- Layout responsivo: sidebar colapsável em mobile, grids que se reorganizam por breakpoint,
  tabelas com scroll horizontal em telas estreitas.

## Estrutura

```
backend/
  prisma/schema.prisma   # modelo de dados (multi-tenant)
  prisma/seed.ts          # dados de demonstração determinísticos
  src/
    config/               # env, prisma client
    middleware/            # auth, RBAC, rate limit, error handler
    prospecting/            # o motor de garimpo
      niches.ts               # nicho em português -> tags do OpenStreetMap
      normalize.ts             # telefone/domínio/e-mail/Instagram + dedupeKey
      score.ts                  # rubricas de pontuação de ICP
      enrich.ts                  # visita o site do lead (robots.txt, anti-SSRF)
      httpClient.ts               # throttle por host + User-Agent identificável
      runner.ts                    # fila de jobs, recuperação após restart
      providers/                    # overpass.ts, googlePlaces.ts
    routes/                 # auth, users, analytics, leads, pipelines, deals,
                            # activities, prospecting, suppressions
    services/                # emissão/rotação de tokens
    utils/                    # senha, tokens, cookies, auditoria
frontend/
  src/
    components/             # layout, ui (Card, Badge, KpiCard...), charts, crm/
    pages/                    # Visão geral, Leads, Funil, Garimpo, Vendas,
                              # Clientes, Financeiro, Usuários
    store/                     # auth (Zustand), tema
    routes/                     # ProtectedRoute (RBAC no client)
```

## Testes

```bash
cd backend && npm test
```

Cobrem normalização e scoring — as duas funções onde um bug é silencioso e contamina
o banco permanentemente (um telefone mal normalizado quebra o dedupe para sempre).
