# Deploy

O app roda em dois formatos a partir do **mesmo código**:

| | Serverless (Vercel) | Sempre ligado (Railway, VPS) |
|---|---|---|
| Entrada | [`api/index.ts`](api/index.ts) importa o app Express | [`backend/src/server.ts`](backend/src/server.ts) abre a porta |
| Frontend | CDN da Vercel serve `frontend/dist` | o próprio Express serve `frontend/dist` |
| Garimpo | a tela chama `POST /api/prospecting/jobs/:id/tick` em fatias | `PROSPECTING_INLINE=true` termina o job sozinho |

Em ambos os casos front e API ficam na **mesma origem** — é isso que permite manter
os cookies de sessão em `sameSite: lax` em vez de afrouxar para `none`.

---

## Vercel + Neon (o caminho escolhido)

### 1. Banco no Neon

Crie um projeto em [neon.tech](https://neon.tech) (tier gratuito) e copie **as duas** strings:

- a **pooled** (tem `-pooler` no host) → vai para `DATABASE_URL`
- a **direct** (sem `-pooler`) → vai para `DIRECT_URL`

Cada invocação serverless abre a própria conexão. Sem o pooler, um punhado de
requisições simultâneas esgota o limite de conexões do Postgres. As migrations,
por outro lado, precisam da conexão direta — pooler não executa DDL de forma
confiável.

### 2. Trocar SQLite por Postgres

Em `backend/prisma/schema.prisma`:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

As migrations existentes foram geradas para SQLite e **não** se aplicam ao
Postgres. Gere uma inicial limpa (não há dados de produção a preservar):

```bash
rm -rf backend/prisma/migrations
npx prisma migrate dev --name init --schema backend/prisma/schema.prisma
```

### 3. Variáveis de ambiente na Vercel

Gere segredos novos — **nunca** reaproveite os de desenvolvimento:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

| Variável | Valor |
|---|---|
| `DATABASE_URL` | string **pooled** do Neon |
| `DIRECT_URL` | string **direct** do Neon |
| `JWT_ACCESS_SECRET` | 64 bytes aleatórios, novos |
| `JWT_REFRESH_SECRET` | 64 bytes aleatórios, novos e **diferentes** do de cima |
| `NODE_ENV` | `production` |
| `COOKIE_SECURE` | `true` |
| `PROSPECTING_USER_AGENT` | `SeuCRM/1.0 (prospecting; seu-email@dominio.com.br)` |
| `PROSPECTING_SLICE_MS` | `45000` |

Não defina `PROSPECTING_INLINE` aqui: em serverless o loop de fundo é congelado
assim que a resposta é enviada, e o worker seria interrompido no meio.

### 4. Deploy

```bash
npm i -g vercel
vercel login
vercel link
vercel --prod
```

O `vercel-build` (em [`package.json`](package.json)) roda `prisma generate`,
aplica as migrations e compila o frontend.

### 5. Primeiro acesso

O seed cria dados de demonstração e **senhas públicas conhecidas** — não rode em
produção. Crie a primeira organização e o primeiro admin direto no banco, ou rode
o seed uma vez e troque as senhas imediatamente.

---

## Migrar depois para Railway

O worker retomável já funciona nos dois modos, então a mudança é de configuração:

1. Aponte o serviço para `backend`, com start `npm start`.
2. Rode `npm run build` na raiz para que `frontend/dist` exista — o Express o serve.
3. Defina as mesmas variáveis, mais `PROSPECTING_INLINE=true`.

Com `PROSPECTING_INLINE` ligado o garimpo termina sozinho, sem depender de aba aberta.

---

## Checklist de segurança antes de abrir para outras pessoas

- [ ] Segredos JWT novos, únicos por ambiente
- [ ] `COOKIE_SECURE=true` e tudo sob HTTPS
- [ ] Senhas do seed trocadas (ou seed nunca executado em produção)
- [ ] `PROSPECTING_USER_AGENT` com um e-mail real — exigência do Nominatim/Overpass
- [ ] Rotina para expurgar `RefreshToken` e `AuditLog` antigos
