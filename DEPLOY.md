# Deploy

O app roda em dois formatos a partir do **mesmo código**:

| | Serverless (Vercel — em produção hoje) | Sempre ligado (Railway, VPS) |
|---|---|---|
| Entrada | `src/app.ts` (default export) | `src/server.ts` abre a porta |
| Frontend | projeto separado, CDN da Vercel | o próprio Express serve `frontend/dist` |
| Garimpo | a tela chama `POST /api/prospecting/jobs/:id/tick` em fatias | `PROSPECTING_INLINE=true` termina o job sozinho |

## Em produção agora

| | URL |
|---|---|
| **App** | https://crm-web-mocha-omega.vercel.app |
| API (não precisa acessar direto) | https://crm-api-delta-rose.vercel.app |
| Banco | Neon Postgres, `sa-east-1` (São Paulo) |

## Arquitetura: dois projetos, uma origem

São **dois projetos Vercel** a partir do mesmo repositório:

- `crm-api` — raiz em `backend/`, framework `express`
- `crm-web` — raiz em `frontend/`, Vite

O [`frontend/vercel.json`](frontend/vercel.json) faz *rewrite* de `/api/*` para o domínio
da API. Rewrite é proxy do lado do servidor, não redirecionamento: **o navegador só
enxerga o domínio do frontend**. É isso que permite manter os cookies de sessão em
`sameSite: lax` em vez de afrouxar para `none` — verificado, os cookies são emitidos no
domínio de `crm-web`.

### Por que não Vercel Services

A tentativa óbvia — um projeto só com `services` para `frontend/` e `backend/` — não
funciona com o backend num subdiretório. O builder Express achata os arquivos compilados
para a raiz do bundle (`backend/dist/app.js` vira `app.js`) mas **preserva o prefixo do
`node_modules`** (`backend/node_modules/express/...`). Em execução, o `app.js` na raiz
procura `express` em `/var/task/node_modules/` e não encontra:

```
Cannot find module 'express'  Require stack: - /var/task/app.js
```

Dá para confirmar isso sem fazer deploy: `vercel build --prod` e inspecionar
`.vercel/output/services/api/functions/index.func/.vc-config.json`, no campo `filePathMap`.

Com o backend como projeto próprio, a raiz do projeto **é** `backend/`, os dois caem no
mesmo nível e a resolução funciona.

## Configuração

### Banco (Neon)

Duas strings de conexão do mesmo projeto:

- a **pooled** (tem `-pooler` no host) → `DATABASE_URL`
- a **direct** (sem `-pooler`) → `DIRECT_URL`

Cada invocação serverless abre a própria conexão; sem o pooler, um punhado de requisições
simultâneas esgota o limite do Postgres. As migrations precisam da direta, porque pooler
não roda DDL de forma confiável.

### Variáveis no projeto `crm-api`

O frontend é estático e não precisa de nenhuma.

| Variável | Valor |
|---|---|
| `DATABASE_URL` | string **pooled** do Neon |
| `DIRECT_URL` | string **direct** do Neon |
| `JWT_ACCESS_SECRET` | 64 bytes aleatórios |
| `JWT_REFRESH_SECRET` | 64 bytes aleatórios, **diferentes** do de cima |
| `COOKIE_SECURE` | `true` |
| `PROSPECTING_USER_AGENT` | `SeuCRM/1.0 (prospecting; seu-email@dominio.com.br)` |
| `PROSPECTING_SLICE_MS` | `45000` |
| `PROSPECTING_INLINE` | `false` |

Gere segredos com
`node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`.

**Não** ligue `PROSPECTING_INLINE` em serverless: o loop de fundo é congelado assim que a
resposta é enviada, e o garimpo pararia no meio.

### Migrations

Rodam **deliberadamente**, não em todo build:

```bash
cd backend && npx prisma migrate deploy
```

O build do serviço não pode emitir nada: sobrescrever o `buildCommand` faz a Vercel
publicar a saída do `tsc` em vez do bundle rastreado dela.

### Primeiro acesso

Nunca rode o seed em produção — ele cria contas com senhas publicadas no README. Use:

```bash
cd backend && npm run bootstrap -- --org "Empresa" --name "Seu Nome" --email voce@dominio.com
```

Cria organização, admin com senha gerada (impressa uma vez) e o funil padrão.

## Deploy

```bash
cd backend  && vercel --prod    # API
cd frontend && vercel --prod    # App
```

Se a URL da API mudar, atualize o `destination` em [`frontend/vercel.json`](frontend/vercel.json).

## Migrar para Railway depois

O worker retomável já roda nos dois modos, então é configuração:

1. Serviço apontando para `backend`, start `npm start`.
2. `npm run build` na raiz para existir `frontend/dist` — o Express o serve.
3. Mesmas variáveis, mais `PROSPECTING_INLINE=true`.

Com isso o garimpo termina sozinho, sem depender de aba aberta.

## Checklist de segurança

- [x] Segredos JWT novos, únicos por ambiente
- [x] `COOKIE_SECURE=true`, tudo sob HTTPS
- [x] Seed nunca executado em produção
- [x] `PROSPECTING_USER_AGENT` com e-mail real
- [ ] Trocar a senha gerada pelo bootstrap após o primeiro login
- [ ] Rotina para expurgar `RefreshToken` e `AuditLog` antigos
