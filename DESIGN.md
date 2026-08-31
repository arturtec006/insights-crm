# Redesign visual — Insights CRM

> Documento de recomendação. **Nenhum arquivo de código foi alterado.**
> Tudo aqui é para revisar antes de aplicar.
>
> Escopo: `frontend/src/index.css`, `pages/LeadsPage.tsx`, `pages/LeadDetailPage.tsx`,
> `pages/PipelinePage.tsx`, `pages/ProspectingPage.tsx`, `components/ui/*`, `components/layout/*`.
> Backend, `lib/api.ts` e lógica de dados: intocados.

---

## Sumário executivo

O app **não está feio** — ele está *neutro*. Isso é diferente e é importante para o
diagnóstico. As decisões que já existem (tokens semânticos, tema claro/escuro, `tabular-nums`,
badges por tom, comentários explicando o *porquê* de cada escolha) são decisões de alguém que
sabe o que está fazendo. O problema é que o app **para na camada de "funciona"** e nunca entra
na camada de "foi desenhado".

Existem 3 causas raiz, em ordem de impacto:

1. **Não existe hierarquia visual.** Tudo é um card de mesmo peso, tudo é `text-sm`, tudo é
   cinza `--text-secondary`. O olho não sabe onde pousar. A tela de leads tem 3 blocos
   idênticos empilhados e a informação mais valiosa do produto (o score do Garimpo) é o
   elemento *mais apagado* da tabela.
2. **A escada de superfícies está invertida no tema claro.** Elementos internos
   (`--surface-2` = `#ffffff`) são mais claros que o card que os contém (`--surface-1` =
   `#fcfcfb`). Trilho da barra de score, botão secundário, chips e cards de negócio: todos
   "flutuam para fora" em vez de recuar. Isso é o que faz a tela parecer lavada.
3. **Zero microinterações.** A tabela de leads não tem hover. Nenhum. Linhas que são links,
   sem nenhuma afordância. Uma tabela sem hover parece uma captura de tela, não um app.

E há um bug de produto que reforça a sensação de inacabado: **na tela de leads o topbar
escreve "Dashboard"**, porque `AppLayout.tsx` não tem `/leads`, `/funil` nem `/garimpo` no mapa
`titles`. São 4 linhas de correção com efeito psicológico enorme.

Encontrei também **3 falhas reais de contraste WCAG AA** na paleta atual (detalhadas na §1.9),
sendo uma delas grave: o badge "Qualificado" tem texto em ~1.8:1. Está no relatório porque a
restrição diz "mantenha o contraste acessível" — e hoje três combinações não estão.

---

# 1. Diagnóstico

## 1.1 O fold da tela de Leads está sendo desperdiçado

Contagem vertical em uma tela 1920×1080 (viewport útil ≈ 950px):

| Bloco | Altura | O que entrega |
| --- | --- | --- |
| Topbar | ~57px | título errado ("Dashboard") |
| `main` padding-top (`p-6`) | 24px | — |
| Grid de 4 KpiCards (`p-5`) | ~118px | 4 números estáticos |
| `space-y-6` | 24px | — |
| Card de filtros (`p-4`, `flex-wrap`) | 90–160px | 6 controles em 1–2 linhas irregulares |
| `space-y-6` | 24px | — |
| Header do card da tabela | ~52px | contagem + botão |
| `<thead>` | ~26px | — |
| **Total antes da 1ª linha de dado** | **~395px** | |

**41% da dobra é cromo.** Sobram ~7 linhas de lead visíveis. Attio, Linear e Folk mostram
15–20. Esse é o item de maior impacto único do documento: não é "adicionar bonito", é
**devolver ~200px** convertendo KPIs estáticos em filtro e o formulário de filtros em toolbar.

Agravante: os 4 KpiCards (`Novos / Qualificados / Convertidos / Descartados`) **duplicam
exatamente** o `<select>` de Status logo abaixo — mas não são clicáveis. O usuário lê o número
"38 novos", quer ver esses 38, e tem que ir no select. Isso é um bug de fluxo disfarçado de
decisão de layout.

## 1.2 A tabela está crua — item por item

`LeadsPage.tsx` linhas 246–320:

| Problema | Onde | Por que dói |
| --- | --- | --- |
| **Sem hover na linha** | `<tr className="border-t">` (l.263) | Linha inteira é destino de navegação e não tem nenhuma afordância. É a causa nº1 de "parece estático". |
| **Sem largura de coluna** | não há `<colgroup>` | O `table-layout: auto` recalcula colunas a cada página. As colunas *pulam* ao paginar. Nada mata mais a percepção de acabamento. |
| **Altura de linha irregular** | `py-3` + célula opcional de 2 linhas (l.272–276) | Linhas com `contactName` são ~18px mais altas. A tabela fica com ritmo serrilhado. |
| **Altura ~44px** | `py-3` em `text-sm` | Nem denso (Linear: 36px) nem confortável (56px). O intervalo do "default". |
| **Header sem tracking** | `text-xs uppercase` (l.249) | Caixa alta sem `letter-spacing` positivo é a marca registrada de UI amadora. |
| **Header sem separação** | `pb-2`, sem `pt`, sem fundo | O `<thead>` flutua colado no card. Não lê como cabeçalho. |
| **Divisor de peso máximo em toda linha** | `borderColor: --border-strong` (l.263) | `#e1e0d9` em todas as linhas: o olho lê uma escada, não registros. Divisor interno deve ser mais fraco que a borda externa do card. |
| **Alvo de clique de 200px** | só `companyName` é `<a>` (l.265) | O usuário clica na linha e nada acontece. |
| **Números não alinhados à direita** | `Score`, telefone | Dígitos comparáveis precisam de eixo comum. `tabular-nums` já está lá; falta o `text-right`. |
| **Acento invertido** | "WhatsApp" em `--accent` (l.290) | O único azul da linha está na ação *secundária*. A ação primária (abrir o lead) é preta. Hierarquia trocada. |
| **Status a 1200px do nome** | `text-right` na última coluna (l.312) | Em 1080p+, o badge que qualifica a empresa está do outro lado da tela dela. |
| **Sem seleção, sem ações de linha, sem teclado** | — | Um CRM de prospecção é uma ferramenta de *lote*: qualificar 10, descartar 5. Hoje é 1 clique → 1 página → voltar. |

## 1.3 A barra de score está desperdiçando o diferencial do produto

`LeadBadges.tsx` l.17–34. O Garimpo pontua de 0 a 100 — é **o** diferencial. Renderização atual:
trilho de 48×6px + número de 12px em `--text-secondary` (cinza secundário, o mesmo peso de
"Cidade").

Quatro problemas:

1. **A faixa <40 usa `--baseline` (cinza).** "Lead fraco" fica visualmente igual a "sem dado".
   Cinza deve ser reservado para `null`.
2. **Os limiares são invisíveis.** O código sabe que 40 e 70 são as fronteiras
   (`score >= 70 ? good : score >= 40 ? warning : baseline`), mas o usuário não vê nada disso.
   A barra vira decoração: sem referência, 48px de preenchimento parcial não comunica nada.
3. **A faixa é carregada só por cor.** Verde `#0ca30c` vs. amarelo `#fab219` é exatamente o par
   confundido em deuteranopia/protanopia, e a barra tem 6px de altura — não há pista de forma
   nenhuma. O número ao lado salva o WCAG 1.4.1 tecnicamente, mas a *leitura rápida por faixa*
   (que é o uso real) é 100% cor.
4. **O trilho é mais claro que o card** (`--surface-2` = `#ffffff` sobre `--surface-1` =
   `#fcfcfb`). A parte *vazia* da barra brilha mais que o fundo. Inversão de profundidade.

## 1.4 A escada de superfícies está invertida no tema claro

```
--surface-0: #f9f9f7   página
--surface-1: #fcfcfb   card      (+1% de luminância sobre a página)
--surface-2: #ffffff   "interno" (+ mais claro ainda)
```

Duas consequências:

- **Cards não existem como plano.** 1% de diferença de luminância entre página e card, com
  `shadow-sm` do Tailwind (que é `0 1px 2px rgba(0,0,0,.05)` — invisível sobre esse fundo).
  Só a borda define o card. Ou seja: a UI é plana, mas *não de propósito*. Linear é plana de
  propósito e executa isso com rigor (zero sombra, 3 níveis de borda, 4 níveis de superfície).
  Aqui é meia sombra + meia borda, e nenhuma das duas faz o trabalho.
- **Elementos recuados ficam salientes.** No tema claro, recuar = escurecer. `--surface-2` é o
  mais claro possível. Todo uso de `--surface-2` (trilho do score, `Button variant="secondary"`,
  `Badge tone="neutral"`, `DealCard`, chips de tipo de atividade em `LeadDetailPage` l.188) tem
  o efeito oposto ao pretendido.
- **Bônus:** os inputs de filtro usam `background: var(--surface-1)` (l.16) — **o mesmo fundo do
  Card que os contém**. Os campos são invisíveis exceto pela borda.

No tema escuro a escada está correta (`#0d0d0d → #1a1a19 → #221f1c`, recuar = escurecer,
elevar = clarear). É só o tema claro que está quebrado.

## 1.5 Tipografia: `system-ui` + escala usada de forma inconsistente

`index.css` l.118: `font-family: system-ui, -apple-system, "Segoe UI", sans-serif`.

O usuário está no Windows 11 → **Segoe UI Variable**. Não é uma fonte ruim, mas é *a fonte do
sistema operacional*, e é isso que o cérebro registra: "isto é uma janela do Windows, não um
produto". Além disso, no Segoe os algarismos em 12px têm menos diferenciação que Inter, e o
app é 60% número.

Problemas de escala, independentes da fonte:

- **Dois títulos de página competindo.** `Topbar` renderiza `<h1 className="text-lg">` (l.32) e
  `ProspectingPage` renderiza outro `<h1 className="text-xl">` (l.145). São dois H1 na mesma
  tela, em tamanhos diferentes.
- **Nenhum ajuste de `letter-spacing` em lugar nenhum.** Nem negativo em títulos, nem positivo
  em caixa alta. Micro-labels em `uppercase` sem tracking (`KpiCard` l.16,
  `LeadsPage` l.249, `LeadDetailPage` l.26) é o detalhe que mais denuncia falta de mão de designer.
- **Peso único.** Tudo é 400/500/600. Sem variação de peso não há hierarquia sem depender de
  cor — e é exatamente por isso que a tela virou um mar de cinza.
- **`text-xs` (12px) faz trabalho demais.** Labels de filtro, hint de KPI, header de tabela,
  segunda linha da célula, paginação, e-mail do lead, timestamps. Tudo no mesmo 12px cinza.

## 1.6 Emoji como sistema de ícones

`Sidebar.tsx` l.6–13 (`📊🎯📋⛏️💰👥🏦⚙️`), `leadDisplay.ts` l.41–49 (`📝📞💬✉️🤝✅⚙️`),
`Topbar.tsx` l.31/45 (`☰☀️🌙`).

Este é provavelmente **o maior gerador isolado de "parece simples"**. Motivos objetivos, não
estéticos:

- Emoji renderiza como arte colorida da plataforma (Segoe UI Emoji no Windows, Apple Color Emoji
  no Mac). O app tem *duas* linguagens visuais brigando: seus tokens sóbrios e um conjunto de
  desenhos coloridos que você não controla.
- Emoji **não herda `currentColor`**. O item ativo da sidebar muda o texto para `--accent` e o
  ícone continua colorido. No tema escuro, os ícones não escurecem — brilham.
- Tamanho óptico inconsistente: `⛏️` e `💰` têm massas visuais muito diferentes de `📋`.
- Renderiza diferente no Mac do seu cliente e no seu Windows.

## 1.7 O acento está simultaneamente subusado e superusado

`--accent` aparece em: pill ativo da sidebar, avatar, botão primário, todo link, link do
WhatsApp, link do Instagram, link de e-mail, slider de score, chips de atividade. Nove usos.

Linear usa o lavanda em **quatro** contextos e só: marca, CTA primário, anel de foco, ênfase de
link. Attio usa o teal com a mesma disciplina.

Efeito prático na tabela de leads: o acento marca a ação *secundária* (WhatsApp) e não marca a
ação primária (abrir o lead). O olho é puxado para a coisa errada.

## 1.8 Estados vazios, de carregamento e de erro estão sub-desenhados

- **Vazio** (`LeadsPage` l.236–244): dois parágrafos centralizados, sem ícone, sem botão. E —
  mais importante — **não distingue os dois casos**: "você não tem lead nenhum ainda" (precisa
  de CTA para o Garimpo) e "seu filtro não retornou nada" (precisa de "Limpar filtros"). São
  problemas diferentes com soluções diferentes e a mesma tela.
- **Carregando** (`PageState kind="loading"`): sempre 4 retângulos em grid de KPI. Na
  `LeadsPage` o layout real é KPI + filtros + tabela; na `LeadDetailPage` é um cabeçalho + grid
  2/1; na `ProspectingPage` é um formulário. O esqueleto **não tem a forma do que substitui**,
  então toda página dá um salto de layout ao carregar. Skeleton que não casa com o layout é pior
  que spinner.
- **Erro**: cópia genérica, sem botão "Tentar de novo".
- **`isFetching`** vira o texto "· atualizando…" (l.229). Correto em intenção, invisível na
  prática.

## 1.9 Contraste: 3 falhas reais de WCAG AA

Calculei os pares em uso. **O núcleo da paleta está sólido** — `--text-primary` e
`--text-secondary` sobre as superfícies passam com folga (7.6:1 no secundário). Mas três
combinações não passam:

| Par | Onde | Ratio | AA (4.5:1) |
| --- | --- | --- | --- |
| `--status-warning` `#fab219` como **texto** sobre tint 20% | `Badge tone="warning"` → **badge "Qualificado"**, badge "Rodando" do Garimpo | **~1.8:1** | ❌ grave |
| `--status-serious` `#ec835a` como **texto** | `Badge tone="serious"` | **~2.6:1** | ❌ |
| `--text-muted` `#898781` sobre `--surface-1` (tema claro) | headers de tabela, todos os labels, hints, timestamps, 2ª linha das células | **3.54:1** | ❌ em 11–14px |
| `--accent` `#2a78d6` como **texto** de link | links WhatsApp/e-mail/site | **4.36:1** | ⚠️ marginal |

O padrão da falha é claro e tem conserto direto: **existe `--status-good-text` (`#006300`) como
par escuro do `--status-good`, mas não existe o equivalente para warning, serious, critical nem
para o accent.** Alguém acertou o padrão uma vez e não replicou. A correção é adicionar os
tokens `-text` que faltam, sem tocar nas cores de *preenchimento* (que continuam válidas para
barras, gráficos e fundos).

O `--text-muted` no tema **escuro** passa (4.82:1). É especificamente o tema claro.

## 1.10 Layout geral

- **Sidebar mais clara que o conteúdo.** `--surface-1` (`#fcfcfb`) contra a página
  `--surface-0` (`#f9f9f7`). O cromo de navegação está *acima* do conteúdo na hierarquia de
  luminância. Attio faz o contrário: navegação recuada, área de trabalho em destaque.
- **Marca inconsistente.** `index.html` diz "Insights CRM"; a `Sidebar` diz "Insights
  Analytics"; o logotipo é "IA" (que em pt-BR lê como "Inteligência Artificial" — pode ser feliz
  ou acidental, mas é ambíguo).
- **Sem separadores/grupos na navegação.** 7 itens de nível único; "Garimpo" (o diferencial do
  produto) tem o mesmo peso de "Financeiro".
- **`backdrop-blur` desperdiçado** no Topbar: fundo a 88% de opacidade não deixa o blur aparecer.
- **`* { border-color: var(--border) }`** e depois *todo* componente sobrescreve para
  `--border-strong`. Existem 2 tokens de borda e só 1 é usado. Zero hierarquia de borda.
- **`focus-visible:outline outline-2` sem `outline-color`** no `Button` → anel padrão do
  navegador (preto/branco), que não combina com nada. Nenhum outro elemento tem estilo de foco.
- **Nenhum estado `:active`** em lugar nenhum. Botões não afundam.

---

# 2. Referências de mercado — o que copiar, especificamente

## Attio — a referência mais direta (é um CRM)

**Tokens reais:** Inter; corpo 14px/1.5; títulos peso 600 com `-0.01em`; raio padrão 6px
(8px médio, 12px grande); teal `#3abdaf` idêntico nos dois temas; fundo claro `#ffffff`,
escuro `#0d0e10`; borda clara `#ebecf0`, escura `#1c2536`.

**O que fazem que esta tela não faz:**

1. **"1px inner borders" — a borda faz o trabalho, não a sombra.** Cards e inputs têm borda
   interna de 1px que dá a sensação de "entalhado". Aqui você tem `shadow-sm` invisível *e*
   borda, e as duas se anulam. → **Copiar:** matar `shadow-sm`, assumir a borda como
   estrutura, e criar 3 níveis de borda em vez de 1.
2. **Pills de status = fundo pastel + texto em peso bold + fg escuro.** É exatamente assim que
   eles resolvem o problema de contraste do §1.9. Seu `Badge` tem o fundo pastel certo, mas o
   `fg` é a cor saturada em vez de uma versão escura, e o peso é `medium` em vez de `semibold`.
   → **Copiar:** tokens `-text` escuros + `font-semibold` no Badge.
3. **Contraste forte entre navegação e área de trabalho.** A sidebar é um plano distinto e
   recuado. → **Copiar:** inverter a escada da sidebar (§1.10).
4. **Tabela de alta densidade com edição inline e ações reveladas no hover.** → **Copiar:** o
   hover que revela ações no fim da linha (resolve o problema do link WhatsApp permanente).
5. **Raio 6px como padrão.** Você usa `rounded-xl` (12px) em tudo. 12px em card é ok; 12px em
   controle pequeno lê "consumer/soft", não "ferramenta de dados".

## Linear — a referência de densidade e de profundidade sem sombra

**Tokens reais:** ~36px de altura de linha; escada de 4 superfícies
(`#010102 → #0f1011 → #141516 → #18191a → #191a1b`); **3 níveis de borda**
(`#23252a` hairline / `#34343a` strong / `#3e3e44` tertiary); Inter Variable com o peso
assinatura **510**; espaçamento base 4px (4/8/12/16/24/32/48); raios 4/6/8/12/16;
acento `#5e6ad2`.

**O que fazem que esta tela não faz:**

1. **Zero `box-shadow` no app inteiro.** Profundidade 100% por escada de superfície + hairline
   + realce branco sutil no topo dos painéis. Isso é a diferença entre "plano de propósito" e
   "plano por acidente". → **Copiar:** a escada de 4 níveis e o `inset 0 1px 0 rgba(255,255,255,.04)`
   no tema escuro (é esse detalhe que faz dark mode parecer caro).
2. **Três níveis de borda.** Borda externa do card ≠ divisor interno de linha ≠ divisor de
   seção. → **Copiar:** adicionar `--border-subtle` e `--border-heavy`.
3. **Peso 510.** Entre `medium` e `semibold`. É por isso que os labels do Linear parecem "certos"
   — 500 é fraco demais e 600 é pesado demais para 13px. Inter Variable dá acesso a isso.
   → **Copiar:** `font-variation-settings: "wght" 510` na classe de label.
4. **Tracking positivo em micro-labels:** eyebrow de 13px/peso 500 com **+0.4px**. Seus headers
   de tabela em `uppercase` têm 0. → **Copiar:** `letter-spacing: 0.06em` em caixa alta ≤12px.
5. **Anel de foco de 2px do acento a 50% de opacidade.** Um único padrão de foco no app inteiro.
   → **Copiar:** token `--ring-focus`.
6. **Acento restrito a 4 usos.** → **Copiar:** tirar o acento do WhatsApp/Instagram/e-mail e
   colocar no nome da empresa (a ação primária).

## Vercel / Geist — a referência de "borda + sombra" bem calibrada

**Padrão técnico distintivo:** `box-shadow: 0 0 0 1px` **no lugar de `border`**. Hairline
visualmente idêntico, **mas fora do box model**. Duas vantagens diretas aqui:

- Você pode intensificar a borda no `:hover` **sem deslocar o layout em 1px**. Na sua tabela,
  onde cada `<tr>` tem `border-t`, qualquer mudança de borda no hover empurraria as linhas.
- Empilha com sombra real: `rgba(0,0,0,.08) 0 0 0 1px, rgba(0,0,0,.04) 0 2px 2px`. É a receita
  de "hairline + sussurro de sombra" que dá profundidade sem parecer Bootstrap 2013.

Raios: 6px padrão / 12px cards / 9999 pills. Base de espaçamento 4px.
→ **Copiar:** a receita de sombra como token `--shadow-card`, e o truque do `ring` para hover.

## Stripe Dashboard — a referência de disciplina de métrica

1. **Exatamente 4 KPIs acima da dobra e nada mais competindo.** Você tem 4 — mas eles são
   estáticos e duplicam um filtro. Stripe usa KPI como *entrada* para navegação.
2. **Hierarquia por tipografia e espaço em branco, não por cor.** Esta é a frase mais importante
   do documento para o seu caso. Você está tentando criar hierarquia com 3 níveis de cinza
   (`primary/secondary/muted`), e cinza não cria hierarquia — cria uniformidade. Hierarquia vem
   de **tamanho + peso + espaço**.
3. **Controle de densidade:** mostram o que é necessário para *agir*, não tudo que têm.
   → Na sua tabela: "Origem" e "Responsável" são colunas que quase nunca mudam a decisão do
   fundador solo. Candidatas a sair do padrão (ou ir para um seletor de colunas).

## Folk / Clay — as referências de linha de contato e de coluna enriquecida

- **Folk:** linhas de contato com avatar + nome, e afordâncias de contato (ligar / e-mail /
  WhatsApp) que **aparecem no hover** no fim da linha, como botões-ícone. → É a solução exata
  para o seu link "WhatsApp" em azul permanente no meio da célula de telefone.
- **Clay:** colunas de enriquecimento renderizadas como chips compactos com *procedência* — ao
  passar o mouse, você vê de onde o dado veio e por quê. → É exatamente o que falta no seu
  score: o `LeadDetailPage` já tem `lead.signals` com os pontos por sinal. Na lista, no mínimo
  um `title`/tooltip explicando a faixa e o limiar.

## Height — a referência de ações em lote

Seleção por checkbox com barra de ação flutuante que sobe do rodapé. Um CRM de prospecção é
uma ferramenta de lote (qualificar 10, descartar 5). Hoje seu fluxo é 1 clique → 1 página →
voltar, 25 vezes. → **Copiar:** checkbox na 1ª coluna + barra de ação em lote (P2, mas é o que
transforma a tela de "lista" em "ferramenta").

---

# 3. Recomendações priorizadas

Ordenadas por **impacto ÷ esforço**. P0 é uma tarde de trabalho e resolve ~70% da percepção.

| # | Ação | Impacto | Esforço |
| --- | --- | --- | --- |
| **P0** | | | |
| 1 | Corrigir títulos de página (`AppLayout`) | Alto | 5 min |
| 2 | Trocar emoji por SVG inline | **Muito alto** | 1h |
| 3 | Inter via Google Fonts + escala tipográfica com tracking | **Muito alto** | 30 min |
| 4 | Corrigir os 3 contrastes (tokens `-text`) | Alto (a11y) | 20 min |
| 5 | Corrigir a escada de superfícies do tema claro | **Muito alto** | 20 min |
| 6 | Tabela: hover, `colgroup`, altura fixa, header com fundo e tracking, linha clicável | **Muito alto** | 1h |
| 7 | Anel de foco único + estados `:active` | Médio (a11y) | 20 min |
| **P1** | | | |
| 8 | Sombras/bordas em 3 níveis + realce no topo (dark) | Alto | 30 min |
| 9 | KPIs → filtro segmentado clicável | **Muito alto** | 1h |
| 10 | Filtros → toolbar de 1 linha + chips de filtro ativo | Alto | 2h |
| 11 | Redesenho da coluna de Score com marcas de limiar | Alto | 45 min |
| 12 | Estados vazios diferenciados com ícone + ação | Médio | 45 min |
| 13 | Skeletons com a forma real de cada página | Médio | 1h |
| 14 | Ações reveladas no hover da linha (WhatsApp, qualificar) | Alto | 1h |
| **P2** | | | |
| 15 | Motion: entrada de linhas, pulso do job ao vivo, `prefers-reduced-motion` | Médio | 1h |
| 16 | Toggle de densidade (compacto/confortável) | Médio | 1h |
| 17 | Seleção em lote + barra de ação | Alto | 3h |
| 18 | Command palette (⌘K) | Médio | 4h |

---

# 4. Código para aplicar

## 4.1 `index.html` — carregar Inter

Preferir `<link>` com `preconnect` a `@import` no CSS (o `@import` cria uma cadeia de requests
que atrasa o primeiro paint).

```html
<!-- dentro de <head>, antes do <title> -->
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  rel="stylesheet"
  href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400..700&display=swap"
/>
```

> Se um dia quiser tirar a dependência do Google (LGPD/latência BR), self-host o
> `InterVariable.woff2` em `public/fonts/` e troque por um `@font-face` com
> `font-display: swap`. Uma linha de CSS, sem mudar mais nada.

## 4.2 `index.css` — arquivo completo proposto

Substitui o arquivo inteiro. Mantém **todos** os nomes de token existentes (nada quebra) e
adiciona os que faltavam.

```css
@import "tailwindcss";

/* =========================================================================
   TOKENS — TEMA CLARO
   ========================================================================= */
:root {
  color-scheme: light;

  /* --- Escada de superfícies -------------------------------------------
     Regra: surface-0 é a página. surface-1 é o card (o plano mais claro no
     tema claro). surface-2 e 3 RECUAM (escurecem) — trilhos, inputs, headers
     de tabela, botão secundário. No tema escuro a escada inverte de direção,
     mas a semântica é a mesma: "afastar-se do card na direção do contraste".
     ------------------------------------------------------------------- */
  --surface-0: #f5f5f2; /* página */
  --surface-1: #ffffff; /* card / chart */
  --surface-2: #f7f7f4; /* recuado: input, trilho, thead, botão 2º */
  --surface-3: #eeeeea; /* hover / pressionado */

  --text-primary: #0b0b0b;
  --text-secondary: #52514e;
  --text-muted: #716f69; /* era #898781 — 3.54:1 falhava AA; agora 4.9:1 */

  /* --- Bordas em 3 níveis (Linear) ------------------------------------- */
  --border-subtle: rgba(11, 11, 11, 0.06); /* divisor interno de linha */
  --border: rgba(11, 11, 11, 0.1); /* padrão */
  --border-strong: #e6e5df; /* borda externa de card */
  --border-heavy: #d3d2c9; /* hover de card, drop zone ativa */

  --baseline: #c3c2b7;

  /* --- Acento ---------------------------------------------------------- */
  --accent: #2a78d6; /* preenchimento: botão, barra, gráfico */
  --accent-hover: #2168bd;
  --accent-ink: #ffffff;
  --accent-soft: #eaf2fc;
  --accent-text: #1d63bd; /* NOVO — acento como TEXTO. 5.76:1 */
  --accent-ring: rgba(42, 120, 214, 0.4);

  /* --- Status: par preenchimento + texto -------------------------------
     Todo status ganha um "-text" escuro, como --status-good-text já fazia.
     Preenchimento = barras/fundos/gráficos. Texto = badge, label, valor.
     ------------------------------------------------------------------- */
  --status-good: #0ca30c;
  --status-good-text: #006300; /* 7.4:1 */
  --status-warning: #fab219;
  --status-warning-text: #8a5a00; /* NOVO — era 1.8:1, agora 5.8:1 */
  --status-serious: #ec835a;
  --status-serious-text: #a53f18; /* NOVO — era 2.6:1, agora 5.2:1 */
  --status-critical: #d03b3b;
  --status-critical-text: #b62c2c; /* NOVO — 6.1:1 */

  --series-1: #2a78d6;
  --series-2: #eb6834;
  --series-3: #1baf7a;
  --series-4: #eda100;
  --series-5: #e87ba4;
  --series-6: #008300;
  --series-7: #4a3aa7;
  --series-8: #e34948;

  /* --- Profundidade (receita Vercel: hairline + sussurro) --------------- */
  --shadow-card: 0 1px 2px rgba(11, 11, 11, 0.04), 0 1px 1px rgba(11, 11, 11, 0.03);
  --shadow-raised: 0 2px 4px rgba(11, 11, 11, 0.05), 0 6px 16px rgba(11, 11, 11, 0.06);
  --shadow-overlay: 0 8px 28px rgba(11, 11, 11, 0.12), 0 2px 6px rgba(11, 11, 11, 0.06);
  --edge-highlight: none; /* só existe no dark */

  /* --- Raio ------------------------------------------------------------- */
  --radius-xs: 4px;
  --radius-sm: 6px;
  --radius-md: 8px; /* controles */
  --radius-lg: 10px; /* cards */
  --radius-xl: 14px;

  /* --- Motion ----------------------------------------------------------- */
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --dur-fast: 120ms;
  --dur-base: 180ms;
  --dur-slow: 280ms;
}

/* =========================================================================
   TOKENS — TEMA ESCURO
   Mantida a estrutura original do arquivo: um bloco dentro de
   prefers-color-scheme (quando não há data-theme explícito) e um bloco para
   data-theme="dark". O corpo dos dois é IDÊNTICO — está logo abaixo, como
   "BLOCO CANÔNICO", para não duplicar 45 linhas neste documento.
   ========================================================================= */
:root[data-theme="dark"],
:root:not([data-theme="light"]) {
  @media (prefers-color-scheme: dark) {
    /* ↓ colar aqui o BLOCO CANÔNICO ↓ */
  }
}

:root[data-theme="dark"] {
  /* ↓ colar aqui o BLOCO CANÔNICO (o mesmo, sem alterar nada) ↓ */
}
```

```css
/* ===== BLOCO CANÔNICO DO TEMA ESCURO — colar nos DOIS seletores ===== */
color-scheme: dark;

--surface-0: #0d0d0d;
--surface-1: #171716; /* card: um degrau acima da página */
--surface-2: #201f1d; /* elevado: input, trilho, thead */
--surface-3: #2a2825; /* hover */

--text-primary: #ffffff;
--text-secondary: #c3c2b7;
--text-muted: #969389; /* 5.3:1 sobre surface-1 */

--border-subtle: rgba(255, 255, 255, 0.06);
--border: rgba(255, 255, 255, 0.1);
--border-strong: #2c2c2a;
--border-heavy: #3d3c39;

--baseline: #383835;

--accent: #3987e5;
--accent-hover: #4d95ea;
--accent-ink: #ffffff;
--accent-soft: #16283f;
--accent-text: #5a9df0; /* 6.2:1 sobre surface-1 */
--accent-ring: rgba(57, 135, 229, 0.45);

--status-good: #0ca30c;
--status-good-text: #4ec94e;
--status-warning: #fab219;
--status-warning-text: #fab219; /* 9.5:1 no escuro — clara já é o par certo */
--status-serious: #ec835a;
--status-serious-text: #ec835a; /* 6.6:1 */
--status-critical: #e66767;
--status-critical-text: #e66767; /* 6.4:1 */

--series-1: #3987e5;
--series-2: #d95926;
--series-3: #199e70;
--series-4: #c98500;
--series-5: #d55181;
--series-6: #008300;
--series-7: #9085e9;
--series-8: #e66767;

/* No escuro, sombra quase não existe. A profundidade vem da escada de
   superfícies + de um realce branco de 1px no topo do painel — é esse
   detalhe (Linear) que faz dark mode parecer caro em vez de "fundo preto". */
--shadow-card: 0 1px 2px rgba(0, 0, 0, 0.3);
--shadow-raised: 0 2px 6px rgba(0, 0, 0, 0.4), 0 8px 24px rgba(0, 0, 0, 0.3);
--shadow-overlay: 0 12px 32px rgba(0, 0, 0, 0.55);
--edge-highlight: inset 0 1px 0 rgba(255, 255, 255, 0.045);
```

E a segunda metade do arquivo (base + utilitários):

```css
/* =========================================================================
   PONTE PARA O TAILWIND v4
   `@theme inline` faz o Tailwind emitir `var(--surface-1)` em vez de copiar o
   valor, então trocar de tema em runtime continua funcionando — e isso
   elimina a maior parte dos `style={{ color: "var(--token)" }}` do JSX.
   Passa a existir: bg-surface-1, text-ink-2, border-line-2, rounded-card...
   ========================================================================= */
@theme inline {
  --color-surface-0: var(--surface-0);
  --color-surface-1: var(--surface-1);
  --color-surface-2: var(--surface-2);
  --color-surface-3: var(--surface-3);

  --color-ink: var(--text-primary);
  --color-ink-2: var(--text-secondary);
  --color-ink-3: var(--text-muted);

  --color-line: var(--border-subtle);
  --color-line-2: var(--border-strong);
  --color-line-3: var(--border-heavy);

  --color-accent: var(--accent);
  --color-accent-soft: var(--accent-soft);
  --color-accent-text: var(--accent-text);
  --color-accent-ink: var(--accent-ink);

  --color-good: var(--status-good-text);
  --color-warning: var(--status-warning-text);
  --color-serious: var(--status-serious-text);
  --color-critical: var(--status-critical-text);

  --radius-ctl: var(--radius-md);
  --radius-card: var(--radius-lg);

  --font-sans: "Inter", system-ui, -apple-system, "Segoe UI", sans-serif;
}

/* =========================================================================
   BASE
   ========================================================================= */
html,
body,
#root {
  height: 100%;
}

body {
  background: var(--surface-0);
  color: var(--text-primary);
  font-family: "Inter", system-ui, -apple-system, "Segoe UI", sans-serif;
  font-size: 14px;
  line-height: 1.5;
  letter-spacing: -0.005em;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  /* cv05: "l" com cauda (não confunde com I/1) — importante em telefone e URL.
     ss03: aspas e vírgulas curvas. Ambos são de Inter v4; confira no browser
     e remova se não gostar do resultado. */
  font-feature-settings: "cv05" 1, "ss03" 1;
}

::selection {
  background: var(--accent-soft);
}

/* =========================================================================
   ESCALA TIPOGRÁFICA — 6 degraus, e só
   Regra: tracking NEGATIVO cresce com o tamanho; tracking POSITIVO em caixa
   alta pequena. É a diferença entre "usei a fonte" e "ajustei a fonte".
   ========================================================================= */
.t-display {
  font-size: 26px;
  line-height: 1.2;
  font-weight: 600;
  letter-spacing: -0.022em;
}
.t-title {
  font-size: 19px;
  line-height: 1.3;
  font-weight: 600;
  letter-spacing: -0.016em;
}
.t-heading {
  font-size: 15px;
  line-height: 1.4;
  font-weight: 600;
  letter-spacing: -0.011em;
}
.t-body {
  font-size: 14px;
  line-height: 1.5;
  font-weight: 400;
  letter-spacing: -0.005em;
}
.t-small {
  font-size: 13px;
  line-height: 1.45;
  font-weight: 400;
  letter-spacing: 0;
}
/* O peso 510 do Linear: entre medium e semibold. 500 é fraco e 600 é pesado
   demais em 11px. Requer Inter variável (é o que o link do Google entrega). */
.t-micro {
  font-size: 11px;
  line-height: 1.3;
  font-weight: 500;
  font-variation-settings: "wght" 560;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.tabular-nums {
  font-variant-numeric: tabular-nums;
}
/* Zero cortado só onde há confusão real com "O" (ID, domínio, telefone). */
.numeric {
  font-variant-numeric: tabular-nums slashed-zero;
  letter-spacing: -0.01em;
}

/* =========================================================================
   FOCO — um padrão único no app inteiro (Linear: anel de 2px do acento)
   ========================================================================= */
:where(a, button, input, select, textarea, [tabindex]):focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}

/* =========================================================================
   TABELA DE DADOS — classe única, reaproveitada em Leads e Garimpo
   ========================================================================= */
.data-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  table-layout: fixed; /* larguras vêm do <colgroup>: colunas param de pular */
}

.data-table thead th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--surface-2);
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 500;
  font-variation-settings: "wght" 560;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  text-align: left;
  height: 34px;
  padding: 0 12px;
  border-bottom: 1px solid var(--border-strong);
  white-space: nowrap;
  user-select: none;
}
.data-table thead th:first-child {
  padding-left: 20px;
}
.data-table thead th:last-child {
  padding-right: 20px;
}
.data-table th[data-align="right"],
.data-table td[data-align="right"] {
  text-align: right;
}

.data-table tbody tr {
  height: 52px; /* altura IDÊNTICA com ou sem 2ª linha na célula */
  transition: background-color var(--dur-fast) var(--ease-out);
}
.data-table tbody td {
  padding: 0 12px;
  vertical-align: middle;
  border-bottom: 1px solid var(--border-subtle); /* fraco: registros, não escada */
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.data-table tbody td:first-child {
  padding-left: 20px;
}
.data-table tbody td:last-child {
  padding-right: 20px;
}
.data-table tbody tr:last-child td {
  border-bottom: 0;
}

/* Hover: sem zebra. Zebra em tabela larga cria faixas horizontais que
   competem com o dado; hover resolve o "onde estou" sem custo permanente.
   Barra de 2px na esquerda = marcador de linha ativa (padrão Linear). */
.data-table tbody tr[data-clickable] {
  cursor: pointer;
}
.data-table tbody tr[data-clickable]:hover {
  background: var(--surface-2);
}
.data-table tbody tr[data-clickable]:hover td:first-child {
  box-shadow: inset 2px 0 0 var(--accent);
}
.data-table tbody tr[data-clickable]:active {
  background: var(--surface-3);
}

/* Ações que só aparecem no hover (padrão Folk/Attio). Ficam sempre no DOM
   e sempre focáveis pelo teclado — opacidade, não display. */
.row-actions {
  opacity: 0;
  transform: translateX(2px);
  transition: opacity var(--dur-fast) var(--ease-out),
    transform var(--dur-fast) var(--ease-out);
}
tr:hover .row-actions,
tr:focus-within .row-actions {
  opacity: 1;
  transform: none;
}

/* =========================================================================
   MOTION
   ========================================================================= */
@keyframes row-in {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
/* Stagger via --i, sem lib. Com key={lead.id} no React, só linhas realmente
   novas montam de novo — refetch não re-anima a lista inteira. */
.row-in {
  animation: row-in var(--dur-base) var(--ease-out) both;
  animation-delay: calc(min(var(--i, 0), 14) * 14ms);
}

@keyframes pulse-dot {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.45;
    transform: scale(0.8);
  }
}
.pulse-dot {
  animation: pulse-dot 1.6s var(--ease-in-out) infinite;
}

@keyframes shimmer {
  100% {
    transform: translateX(100%);
  }
}
.skeleton {
  position: relative;
  overflow: hidden;
  background: var(--surface-2);
  border-radius: var(--radius-sm);
}
.skeleton::after {
  content: "";
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(
    90deg,
    transparent,
    color-mix(in oklab, var(--text-primary) 5%, transparent),
    transparent
  );
  animation: shimmer 1.4s var(--ease-in-out) infinite;
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

> **Nota sobre `* { border-color: var(--border) }`:** removi essa regra. Ela força uma
> especificidade universal que todo componente precisava sobrescrever. Com `@theme inline`
> você usa `border-line` / `border-line-2` / `border-line-3` explicitamente, e a hierarquia
> de borda passa a ser uma decisão visível no JSX.

## 4.3 `components/ui/Icon.tsx` — matar os emoji (P0 nº2)

Ícones de traço, 1.5px, `currentColor`, `size` em múltiplo de 4. Os paths abaixo seguem a
geometria do Lucide (licença ISC — pode inlinar). Copie os que faltarem de lucide.dev.

```tsx
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 16, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const Icon = {
  Overview: (p: IconProps) => (
    <Svg {...p}>
      <path d="M3 3v18h18M7 15l4-4 3 3 5-6" />
    </Svg>
  ),
  Leads: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
    </Svg>
  ),
  Pipeline: (p: IconProps) => (
    <Svg {...p}>
      <rect x="3" y="4" width="5" height="16" rx="1.5" />
      <rect x="10" y="4" width="5" height="10" rx="1.5" />
      <rect x="17" y="4" width="4" height="6" rx="1.5" />
    </Svg>
  ),
  Prospect: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.5 15.5 21 21" />
      <path d="M10.5 7.5v6M7.5 10.5h6" />
    </Svg>
  ),
  Sales: (p: IconProps) => (
    <Svg {...p}>
      <path d="M12 3v18" />
      <path d="M16.5 7.5c0-1.7-2-2.5-4.5-2.5S7.5 5.9 7.5 7.8s2 2.4 4.5 3 4.5 1.2 4.5 3.2-2 2.9-4.5 2.9-4.5-.9-4.5-2.6" />
    </Svg>
  ),
  Customers: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <path d="M16 5.5a3 3 0 0 1 0 5.4M17.5 19a5.5 5.5 0 0 0-2.2-4.4" />
    </Svg>
  ),
  Finance: (p: IconProps) => (
    <Svg {...p}>
      <path d="M3 9.5 12 4l9 5.5" />
      <path d="M5 10v8M10 10v8M14 10v8M19 10v8M3 21h18" />
    </Svg>
  ),
  Settings: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" />
    </Svg>
  ),

  /* atividades */
  Note: (p: IconProps) => (
    <Svg {...p}>
      <path d="M5 3.5h9L19 8v12.5H5z" />
      <path d="M14 3.5V8h5M8.5 12.5h7M8.5 16h4.5" />
    </Svg>
  ),
  Call: (p: IconProps) => (
    <Svg {...p}>
      <path d="M6.5 3.5h3l1.5 4-2 1.5a11 11 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2.2 2A17 17 0 0 1 4.5 5.7a2 2 0 0 1 2-2.2Z" />
    </Svg>
  ),
  Whatsapp: (p: IconProps) => (
    <Svg {...p}>
      <path d="M20.5 11.7a8.4 8.4 0 0 1-12.4 7.4L3.5 20.5l1.4-4.5A8.5 8.5 0 1 1 20.5 11.7Z" />
      <path d="M9 9.2c0 3 2.4 5.4 5.3 5.4l.9-1.4-2-1-.8.8a5.6 5.6 0 0 1-1.9-1.9l.8-.8-1-2z" />
    </Svg>
  ),
  Mail: (p: IconProps) => (
    <Svg {...p}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3.5 7 8.5 6 8.5-6" />
    </Svg>
  ),
  Meeting: (p: IconProps) => (
    <Svg {...p}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </Svg>
  ),
  Task: (p: IconProps) => (
    <Svg {...p}>
      <path d="m4.5 12.5 4.5 4.5 10-11" />
    </Svg>
  ),
  System: (p: IconProps) => (
    <Svg {...p}>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M9 9h6v6H9z" />
    </Svg>
  ),

  /* utilitários */
  Search: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </Svg>
  ),
  Filter: (p: IconProps) => (
    <Svg {...p}>
      <path d="M4 5.5h16l-6.2 7.3V19l-3.6-2v-4.2z" />
    </Svg>
  ),
  Sun: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
    </Svg>
  ),
  Moon: (p: IconProps) => (
    <Svg {...p}>
      <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
    </Svg>
  ),
  Menu: (p: IconProps) => (
    <Svg {...p}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Svg>
  ),
  ChevronRight: (p: IconProps) => (
    <Svg {...p}>
      <path d="m9.5 5.5 6.5 6.5-6.5 6.5" />
    </Svg>
  ),
  Inbox: (p: IconProps) => (
    <Svg {...p}>
      <path d="M3 13.5 5.5 5h13L21 13.5V19a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 19z" />
      <path d="M3 13.5h5l1 2.5h6l1-2.5h5" />
    </Svg>
  ),
};
```

Uso na `Sidebar` (substitui `icon: "📊"` por componentes):

```tsx
const navGroups = [
  {
    label: null,
    items: [
      { to: "/", label: "Visão geral", Icon: Icon.Overview, end: true },
      { to: "/leads", label: "Leads", Icon: Icon.Leads },
      { to: "/funil", label: "Funil", Icon: Icon.Pipeline },
      { to: "/garimpo", label: "Garimpo", Icon: Icon.Prospect },
    ],
  },
  {
    label: "Pós-venda",
    items: [
      { to: "/vendas", label: "Vendas", Icon: Icon.Sales },
      { to: "/clientes", label: "Clientes", Icon: Icon.Customers },
      { to: "/financeiro", label: "Financeiro", Icon: Icon.Finance },
    ],
  },
];
```

E, no `leadDisplay.ts`, trocar `activityIcon` de string para componente (o arquivo já é
separado dos componentes por causa do Fast Refresh — mover o mapa para `LeadBadges.tsx` ou
criar `activityIcons.tsx`).

## 4.4 `components/ui/Card.tsx` — profundidade real

```tsx
export function Card({ children, className, ...rest }: CardProps) {
  return (
    <div
      className={clsx("rounded-card border border-line-2 bg-surface-1", className)}
      style={{ boxShadow: "var(--shadow-card), var(--edge-highlight)" }}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action }: CardHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
      <div className="min-w-0">
        <h3 className="t-heading text-ink">{title}</h3>
        {subtitle && <p className="mt-0.5 t-small text-ink-3">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
```

Duas mudanças com efeito desproporcional: (a) `--edge-highlight` dá o realce branco de 1px no
topo do card **só no tema escuro**; (b) o `CardHeader` ganha `border-b` — hoje o cabeçalho
flutua sem separação do corpo.

## 4.5 `components/ui/Button.tsx` — estados completos

```tsx
export function Button({ variant = "primary", size = "md", className, ...rest }: ButtonProps) {
  const base =
    "inline-flex select-none items-center justify-center gap-1.5 rounded-ctl font-medium " +
    "transition-[background-color,box-shadow,transform] duration-[120ms] ease-out " +
    "active:translate-y-px disabled:pointer-events-none disabled:opacity-45";

  const sizes = {
    sm: "h-8 px-3 text-[13px]",
    md: "h-9 px-3.5 text-[13px]",
    lg: "h-10 px-4 text-sm",
  }[size];

  const variants = {
    primary:
      "bg-[var(--accent)] text-[var(--accent-ink)] shadow-[0_1px_2px_rgba(11,11,11,.12)] " +
      "hover:bg-[var(--accent-hover)]",
    secondary:
      "bg-surface-1 text-ink border border-line-2 hover:bg-surface-2 hover:border-line-3",
    ghost: "bg-transparent text-ink-2 hover:bg-surface-2 hover:text-ink",
    danger:
      "bg-[var(--status-critical)] text-white hover:brightness-95",
  }[variant];

  return <button className={clsx(base, sizes, variants, className)} {...rest} />;
}
```

Detalhes que importam: altura fixa (`h-9`) para os controles alinharem na toolbar;
`active:translate-y-px` (o botão afunda — é 1px e muda tudo na percepção de tatilidade);
`hover` real em todas as variantes; `disabled:opacity-45` em vez de 50 (mais claramente
desabilitado).

## 4.6 `components/ui/Badge.tsx` — contraste + peso (padrão Attio)

```tsx
type Tone = "good" | "warning" | "serious" | "critical" | "neutral" | "accent";

const toneStyles: Record<Tone, { bg: string; fg: string; bd: string }> = {
  good: {
    bg: "color-mix(in oklab, var(--status-good) 14%, transparent)",
    fg: "var(--status-good-text)",
    bd: "color-mix(in oklab, var(--status-good) 28%, transparent)",
  },
  warning: {
    bg: "color-mix(in oklab, var(--status-warning) 18%, transparent)",
    fg: "var(--status-warning-text)",
    bd: "color-mix(in oklab, var(--status-warning) 34%, transparent)",
  },
  serious: {
    bg: "color-mix(in oklab, var(--status-serious) 16%, transparent)",
    fg: "var(--status-serious-text)",
    bd: "color-mix(in oklab, var(--status-serious) 32%, transparent)",
  },
  critical: {
    bg: "color-mix(in oklab, var(--status-critical) 14%, transparent)",
    fg: "var(--status-critical-text)",
    bd: "color-mix(in oklab, var(--status-critical) 30%, transparent)",
  },
  neutral: { bg: "var(--surface-2)", fg: "var(--text-secondary)", bd: "var(--border-strong)" },
  accent: { bg: "var(--accent-soft)", fg: "var(--accent-text)", bd: "transparent" },
};

export function Badge({ tone = "neutral", dot = false, children }: BadgeProps) {
  const s = toneStyles[tone];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2 py-[3px]
                 text-[11px] font-semibold whitespace-nowrap"
      style={{ background: s.bg, color: s.fg, borderColor: s.bd }}
    >
      {/* O ponto é forma, não cor: mantém a distinção legível em daltonismo
          quando dois badges vizinhos têm luminância parecida. */}
      {dot && (
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ background: "currentColor" }}
          aria-hidden
        />
      )}
      {children}
    </span>
  );
}
```

Três mudanças: **fg agora usa o token `-text`** (resolve o badge "Qualificado" ilegível),
`font-semibold` (padrão Attio: peso compensa o tamanho pequeno), e uma borda de 1px na cor do
tom — é o que separa o badge do fundo quando ele cai sobre `--surface-2` num hover de linha.

## 4.7 `ScoreBar` — a mudança mais importante do produto

O problema conceitual: hoje a barra não tem **referência**. 62% de preenchimento não significa
nada se o usuário não sabe onde está a linha de corte. A solução é desenhar os limiares
(40 e 70) como marcas no trilho. Isso transforma a barra de decorativa em informativa **e**
resolve o problema de daltonismo — a leitura "passou do corte" vira posicional (forma), não
cromática.

```tsx
const BANDS = { high: 70, mid: 40 } as const;

function scoreBand(score: number) {
  if (score >= BANDS.high) return { key: "alta", label: "Alta", fill: "var(--status-good)" };
  if (score >= BANDS.mid) return { key: "media", label: "Média", fill: "var(--status-warning)" };
  return { key: "baixa", label: "Baixa", fill: "var(--status-serious)" };
}

/**
 * Score do Garimpo. Três portadores independentes de informação:
 *  1. o número (texto)
 *  2. a posição do preenchimento em relação às marcas de 40 e 70 (forma)
 *  3. a cor da faixa (cor)
 * Qualquer um sozinho responde "vale a pena ligar hoje?" — nenhum é obrigatório.
 */
export function ScoreBar({ score, size = "sm" }: { score: number | null; size?: "sm" | "lg" }) {
  if (score == null) {
    return <span className="t-small text-ink-3">—</span>;
  }

  const band = scoreBand(score);
  const w = size === "lg" ? 96 : 56;

  return (
    <div
      className="inline-flex items-center gap-2"
      title={`Score ${score}/100 · prioridade ${band.label.toLowerCase()} (corte em 40 e 70)`}
    >
      <span
        className={clsx(
          "numeric tabular-nums text-right text-ink",
          size === "lg" ? "w-9 text-[17px] font-semibold" : "w-6 text-[13px] font-semibold"
        )}
      >
        {score}
      </span>

      <div
        className="relative shrink-0 overflow-hidden rounded-full"
        style={{ width: w, height: size === "lg" ? 6 : 5, background: "var(--surface-2)" }}
        role="img"
        aria-label={`Score ${score} de 100, prioridade ${band.label.toLowerCase()}`}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${score}%`,
            background: band.fill,
            transition: "width var(--dur-slow) var(--ease-out)",
          }}
        />
        {/* Marcas de limiar: é isto que dá SIGNIFICADO ao preenchimento.
            Ficam acima do fill, com mix-blend para aparecer nos dois lados. */}
        {[BANDS.mid, BANDS.high].map((t) => (
          <span
            key={t}
            aria-hidden
            className="absolute top-0 h-full w-px"
            style={{ left: `${t}%`, background: "var(--surface-1)", opacity: 0.9 }}
          />
        ))}
      </div>

      {size === "lg" && (
        <span className="t-micro" style={{ color: band.fill }}>
          {band.label}
        </span>
      )}
    </div>
  );
}
```

Mudanças, e o porquê de cada uma:

| Antes | Depois | Motivo |
| --- | --- | --- |
| número depois da barra, `--text-secondary`, 12px | número **antes**, `--text-primary`, 13px semibold, largura fixa | O número é a informação; a barra é o contexto. Largura fixa alinha os dígitos em coluna ao ordenar por score. |
| faixa <40 em cinza `--baseline` | `--status-serious` (laranja) | Cinza = "sem dado". Laranja = "fraco". `null` agora renderiza "—". |
| trilho `--surface-2` (branco, mais claro que o card) | `--surface-2` corrigido para ser mais escuro no tema claro | Corrige a inversão de profundidade (§1.4). |
| sem referência | marcas em 40 e 70 | Transforma a barra em medida. Também é o portador não-cromático da faixa. |
| sem explicação | `title` + `aria-label` com a faixa | Responde "por que esse lead está no topo?" sem sair da lista. |
| sem transição | `width` com `--dur-slow` | Ver o §5 (nota sobre `width`). |

Na `LeadDetailPage`, use `size="lg"` no cabeçalho — lá o score é o assunto, não uma coluna.

## 4.8 `LeadsPage` — o bloco de tabela reescrito

Trecho do `<table>` (l.246–320) reescrito. Requer `useNavigate`.

```tsx
<div className="max-h-[calc(100vh-320px)] overflow-auto">
  <table className="data-table">
    {/* colgroup = colunas param de pular ao paginar */}
    <colgroup>
      <col style={{ width: "28%" }} />
      <col style={{ width: 128 }} />
      <col style={{ width: "22%" }} />
      <col style={{ width: 132 }} />
      <col style={{ width: 116 }} />
      <col style={{ width: 128 }} />
      <col style={{ width: 132 }} />
    </colgroup>

    <thead>
      <tr>
        <th scope="col">Empresa</th>
        <th scope="col">Score</th>
        <th scope="col">Contato</th>
        <th scope="col">Cidade</th>
        <th scope="col">Origem</th>
        <th scope="col">Responsável</th>
        <th scope="col" data-align="right">Status</th>
      </tr>
    </thead>

    <tbody>
      {data.leads.map((lead, i) => {
        const wa = whatsappLink(lead.phone);
        return (
          <tr
            key={lead.id}
            data-clickable
            className="row-in"
            style={{ "--i": i } as React.CSSProperties}
            onClick={() => navigate(`/leads/${lead.id}`)}
          >
            <td>
              {/* o <a> continua existindo: leitor de tela, ctrl+clique,
                  clique do meio e navegação por teclado seguem funcionando */}
              <Link
                to={`/leads/${lead.id}`}
                onClick={(e) => e.stopPropagation()}
                className="block truncate text-[14px] font-medium text-ink hover:text-accent-text"
              >
                {lead.companyName}
              </Link>
              <div className="truncate text-[12px] leading-tight text-ink-3">
                {lead.contactName ?? lead.category ?? " "}
              </div>
            </td>

            <td><ScoreBar score={lead.score} /></td>

            <td>
              <div className="numeric truncate text-[13px] text-ink-2">
                {formatPhone(lead.phone)}
              </div>
              <div className="truncate text-[12px] leading-tight text-ink-3">
                {lead.email ?? " "}
              </div>
            </td>

            <td className="truncate text-[13px] text-ink-2">{lead.city ?? "—"}</td>
            <td className="truncate text-[13px] text-ink-3">
              {sourceLabel[lead.source] ?? lead.source}
            </td>
            <td className="truncate text-[13px] text-ink-2">{lead.owner?.name ?? "—"}</td>

            <td data-align="right">
              <div className="flex items-center justify-end gap-1.5">
                {/* Ação revelada no hover (Folk/Attio): tira o link azul
                    permanente do meio da linha e devolve o acento para a
                    ação primária (o nome da empresa). */}
                {wa && (
                  <a
                    href={wa}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    title="Abrir conversa no WhatsApp"
                    aria-label={`WhatsApp de ${lead.companyName}`}
                    className="row-actions grid h-7 w-7 place-items-center rounded-ctl
                               border border-line-2 bg-surface-1 text-ink-2
                               hover:bg-surface-3 hover:text-ink"
                  >
                    <Icon.Whatsapp size={14} />
                  </a>
                )}
                <LeadStatusBadge status={lead.status} />
              </div>
            </td>
          </tr>
        );
      })}
    </tbody>
  </table>
</div>
```

Notas de implementação:

- `{" "}` como fallback da segunda linha: mantém as duas linhas ocupando o mesmo espaço
  **sempre**, então todas as linhas têm exatamente 52px, com ou sem `contactName`. É o truque
  que faz a tabela parecer construída em vez de renderizada.
- `max-h + overflow-auto` no wrapper cria o contexto de rolagem que o `thead` sticky precisa.
  O `overflow-x-auto` atual quebra o sticky contra o scroller externo. Ajuste o `320px` para o
  cromo real acima da tabela depois da P1 nº9/10.
- Se preferir não usar `onClick` no `<tr>`: alternativa CSS pura é `<td:first-child>` com
  `position: relative` e o `<a>` com `::after { position:absolute; inset:0 }` — mas isso só
  cobre a primeira célula de forma confiável entre browsers. O `onClick` + `<a>` preservado é
  o padrão que Attio e Linear usam de fato.

## 4.9 KPIs → filtro segmentado (P1 nº9)

Substitui o grid de 4 `KpiCard` (l.89–94) **e** o `<select>` de Status. Recupera ~110px de
dobra e conserta o fluxo "vejo 38 novos → quero ver os 38".

```tsx
const STATUS_TABS = [
  { key: "" as const, label: "Todos", count: data.total },
  { key: "new" as const, label: "Novos", count: counts.new ?? 0 },
  { key: "qualified" as const, label: "Qualificados", count: counts.qualified ?? 0 },
  { key: "converted" as const, label: "Convertidos", count: counts.converted ?? 0 },
  { key: "disqualified" as const, label: "Descartados", count: counts.disqualified ?? 0 },
];

<div
  role="tablist"
  aria-label="Filtrar por status"
  className="flex items-center gap-1 overflow-x-auto rounded-card border border-line-2
             bg-surface-1 p-1"
  style={{ boxShadow: "var(--shadow-card), var(--edge-highlight)" }}
>
  {STATUS_TABS.map((t) => {
    const active = filters.status === t.key;
    return (
      <button
        key={t.key || "all"}
        role="tab"
        aria-selected={active}
        onClick={() => update({ status: t.key })}
        className={clsx(
          "group flex h-9 shrink-0 items-center gap-2 rounded-ctl px-3 text-[13px]",
          "transition-colors duration-[120ms] ease-out",
          active
            ? "bg-surface-3 font-semibold text-ink"
            : "font-medium text-ink-2 hover:bg-surface-2 hover:text-ink"
        )}
      >
        {t.label}
        <span
          className={clsx(
            "numeric rounded-full px-1.5 py-px text-[11px] font-semibold tabular-nums",
            active ? "bg-[var(--accent)] text-[var(--accent-ink)]" : "bg-surface-2 text-ink-3"
          )}
        >
          {formatNumber(t.count)}
        </span>
      </button>
    );
  })}
</div>
```

## 4.10 Filtros → toolbar de uma linha (P1 nº10)

Regra: **campo de busca sempre visível, o resto atrás de um botão "Filtros", filtros ativos
viram chips removíveis.** Isso é o padrão Attio/Linear e é o que tira a sensação de
"formulário no topo da tela".

```tsx
<div className="flex flex-wrap items-center gap-2">
  {/* busca com ícone à esquerda e atalho à direita */}
  <div className="relative min-w-[240px] flex-1">
    <Icon.Search
      size={15}
      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3"
    />
    <input
      id="lead-search"
      aria-label="Buscar leads"
      className="h-9 w-full rounded-ctl border border-line-2 bg-surface-2 pl-9 pr-16
                 text-[13px] text-ink placeholder:text-ink-3
                 transition-[background-color,border-color] duration-[120ms]
                 hover:border-line-3 focus:bg-surface-1 focus:border-[var(--accent)]"
      placeholder="Empresa, telefone, e-mail ou site"
      value={searchDraft}
      onChange={(e) => setSearchDraft(e.target.value)}
      onKeyDown={(e) => e.key === "Enter" && update({ q: searchDraft })}
    />
    <kbd
      className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded
                 border border-line-2 px-1.5 py-0.5 text-[10px] font-medium text-ink-3"
    >
      Enter
    </kbd>
  </div>

  <Button variant="secondary" onClick={() => setFiltersOpen((v) => !v)}>
    <Icon.Filter size={14} />
    Filtros
    {activeFilterCount > 0 && (
      <span className="numeric ml-0.5 rounded-full bg-[var(--accent)] px-1.5
                       text-[10px] font-semibold text-[var(--accent-ink)]">
        {activeFilterCount}
      </span>
    )}
  </Button>

  {/* Ordenação fica sempre visível: é o controle mais usado numa lista
      pontuada, esconder atrás de popover custaria mais do que economiza. */}
  <select
    aria-label="Ordenar"
    className="h-9 rounded-ctl border border-line-2 bg-surface-2 px-2.5 text-[13px] text-ink"
    value={filters.sort}
    onChange={(e) => update({ sort: e.target.value as Filters["sort"] })}
  >
    <option value="score">Melhor score</option>
    <option value="recent">Mais recentes</option>
    <option value="name">Nome (A-Z)</option>
  </select>

  <div className="ml-auto">
    <Link to="/garimpo">
      <Button>
        <Icon.Prospect size={14} />
        Garimpar leads
      </Button>
    </Link>
  </div>
</div>

{/* chips de filtro ativo — o usuário sempre sabe POR QUE a lista está curta */}
{activeChips.length > 0 && (
  <div className="flex flex-wrap items-center gap-1.5">
    {activeChips.map((c) => (
      <button
        key={c.key}
        onClick={c.clear}
        className="group inline-flex items-center gap-1.5 rounded-full border border-line-2
                   bg-surface-2 py-1 pl-2.5 pr-1.5 text-[12px] text-ink-2
                   transition-colors hover:border-line-3 hover:text-ink"
      >
        <span className="text-ink-3">{c.label}:</span>
        <span className="font-medium">{c.value}</span>
        <span className="grid h-4 w-4 place-items-center rounded-full text-ink-3
                         group-hover:bg-surface-3 group-hover:text-ink">×</span>
      </button>
    ))}
    <button onClick={clearAll} className="px-2 text-[12px] text-ink-3 hover:text-ink underline-offset-2 hover:underline">
      Limpar tudo
    </button>
  </div>
)}
```

## 4.11 Estados vazios diferenciados (P1 nº12)

```tsx
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div
        className="mb-4 grid h-11 w-11 place-items-center rounded-xl border border-line-2
                   bg-surface-2 text-ink-3"
        aria-hidden
      >
        {icon}
      </div>
      <p className="t-heading text-ink">{title}</p>
      <p className="mt-1 max-w-[38ch] t-small text-ink-3">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
```

Uso na `LeadsPage` — **dois casos, duas telas**:

```tsx
{data.leads.length === 0 &&
  (hasActiveFilters ? (
    <EmptyState
      icon={<Icon.Filter size={20} />}
      title="Nenhum lead com esses filtros"
      description="Nenhum dos seus leads bate com a combinação atual. Tente afrouxar o score mínimo ou trocar a cidade."
      action={<Button variant="secondary" onClick={clearAll}>Limpar filtros</Button>}
    />
  ) : (
    <EmptyState
      icon={<Icon.Inbox size={20} />}
      title="Sua base ainda está vazia"
      description="O Garimpo encontra negócios reais no OpenStreetMap, visita o site de cada um atrás de telefone, e-mail e Instagram, e entrega tudo pontuado aqui."
      action={
        <Link to="/garimpo">
          <Button><Icon.Prospect size={14} />Rodar o primeiro garimpo</Button>
        </Link>
      }
    />
  ))}
```

## 4.12 Skeleton com a forma real (P1 nº13)

```tsx
type Shape = "table" | "detail" | "form" | "board";

export function PageState({
  kind,
  shape = "table",
  message,
  onRetry,
}: {
  kind: "loading" | "error";
  shape?: Shape;
  message?: string;
  onRetry?: () => void;
}) {
  if (kind === "loading") {
    if (shape === "table") {
      return (
        <div className="space-y-4">
          <div className="skeleton h-11 rounded-card" />
          <div className="skeleton h-9 w-2/3 rounded-ctl" />
          <div className="overflow-hidden rounded-card border border-line-2 bg-surface-1">
            <div className="skeleton h-[34px] rounded-none" />
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex h-[52px] items-center gap-4 border-b border-line px-5">
                <div className="skeleton h-3.5 flex-1" style={{ maxWidth: 220 }} />
                <div className="skeleton h-3.5 w-24" />
                <div className="skeleton h-3.5 w-40" />
                <div className="skeleton ml-auto h-5 w-20 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      );
    }
    /* ...demais shapes... */
  }

  return (
    <Card className="flex flex-col items-center px-6 py-14 text-center">
      <p className="t-heading" style={{ color: "var(--status-critical-text)" }}>
        Não foi possível carregar os dados
      </p>
      <p className="mt-1 t-small text-ink-3">{message ?? "Pode ser a conexão. Tente de novo."}</p>
      {onRetry && (
        <Button variant="secondary" className="mt-5" onClick={onRetry}>
          Tentar de novo
        </Button>
      )}
    </Card>
  );
}
```

## 4.13 Layout: sidebar recuada, topbar com subtítulo, títulos corretos

```tsx
// AppLayout.tsx — CORREÇÃO DO BUG: a tela de leads mostrava "Dashboard"
const pages: Record<string, { title: string; subtitle?: string }> = {
  "/": { title: "Visão geral" },
  "/leads": { title: "Leads", subtitle: "Tudo que o Garimpo trouxe, pontuado de 0 a 100" },
  "/funil": { title: "Funil", subtitle: "Arraste um negócio para mudar de etapa" },
  "/garimpo": { title: "Garimpo", subtitle: "Encontre negócios reais e traga o contato deles" },
  "/vendas": { title: "Vendas" },
  "/clientes": { title: "Clientes" },
  "/financeiro": { title: "Financeiro" },
  "/usuarios": { title: "Usuários" },
};

const page =
  location.pathname.startsWith("/leads/")
    ? { title: "Lead" }
    : pages[location.pathname] ?? { title: "Insights CRM" };
```

```tsx
// Sidebar.tsx — o cromo RECUA (Attio). Hoje a sidebar é mais clara que a página.
<aside
  className="... border-r border-line-2"
  style={{ background: "var(--surface-0)" }}   // era --surface-1
>
```

```tsx
// Topbar.tsx — hairline só ao rolar, blur que realmente aparece, subtítulo
<header
  className="sticky top-0 z-20 flex h-14 items-center justify-between px-4 backdrop-blur-md md:px-6"
  style={{
    background: "color-mix(in oklab, var(--surface-0) 72%, transparent)",
    borderBottom: `1px solid ${scrolled ? "var(--border-strong)" : "transparent"}`,
    transition: "border-color var(--dur-base) var(--ease-out)",
  }}
>
  <div className="min-w-0">
    <h1 className="t-title truncate text-ink">{title}</h1>
    {subtitle && <p className="truncate text-[12px] leading-tight text-ink-3">{subtitle}</p>}
  </div>
  ...
</header>
```

> Ao adotar o subtítulo no `Topbar`, **remova o `<h1>` interno da `ProspectingPage`**
> (l.144–152) — hoje há dois H1 na mesma tela.

## 4.14 Motion no job ao vivo (P2 nº15)

Na `ProspectingPage`, o job rodando não tem nenhum sinal de vida além do texto. Um ponto
pulsante junto ao badge custa 4 linhas e é a diferença entre "travou?" e "está trabalhando":

```tsx
{(job.status === "running" || job.status === "queued") && (
  <span
    className="pulse-dot h-1.5 w-1.5 rounded-full"
    style={{ background: "var(--status-warning)" }}
    aria-hidden
  />
)}
```

E a barra de progresso do job (`createdCount / limit`) com `transition: width var(--dur-slow)`.

---

# 5. Notas de rigor

**Sobre animar `width`.** A regra geral é `transform`/`opacity`, porque `width` força
layout. Nos dois casos acima (barra de score e progresso do job) eu abri exceção
conscientemente: são elementos pequenos, isolados, com `contain` implícito, e a alternativa
(`scaleX`) distorceria os cantos arredondados e as marcas de limiar. Se a lista chegar a
100+ barras animando simultaneamente, troque por `transform: scaleX()` com
`transform-origin: left` e mova as marcas para um elemento irmão não-transformado.

**Sobre `overflow-x-auto` e `thead` sticky.** São mutuamente exclusivos como estão hoje: o
`overflow-x-auto` cria um contexto de rolagem que impede o sticky de ancorar no scroller
externo. A solução na §4.8 (wrapper com `max-h` + `overflow: auto`) resolve, mas cria um
segundo scroller na página. A alternativa mais limpa a médio prazo é `table-layout: fixed` com
`min-width` no `<table>` e o `main` como único scroller, com `top` do `thead` = altura do
topbar. Escolha uma; não dá para ter as duas.

**Sobre `font-feature-settings: "cv05" "ss03"`.** São alternativas estilísticas do Inter v4.
Confira no browser antes de fechar — se o "l" com cauda não agradar, remova; nada mais depende
disso.

**Sobre mexer na paleta.** Não inventei cor nova. Todos os tokens `-text` que adicionei são
versões **mais escuras da mesma matiz** já validada, seguindo exatamente o padrão que o
`--status-good-text` (`#006300`) já estabelecia. Os tokens de preenchimento
(`--status-*` sem sufixo, `--series-*`, `--accent`) estão **intocados** — barras, gráficos e
fundos continuam idênticos. As mudanças de superfície (`--surface-1/2`) são de luminância, não
de matiz, e mantêm o caráter quente-neutro do original.

**Portadores de informação.** Onde havia cor sozinha, agora há cor + forma + texto:
faixa de score (número + marcas de limiar + cor), badges (ponto opcional + texto + cor),
linha em hover (fundo + barra lateral de 2px).

---

# 6. Checklist de aplicação

```
P0 — uma tarde
[ ] index.html: preconnect + Inter
[ ] index.css: substituir pelo arquivo da §4.2 (atenção ao bloco dark canônico)
[ ] components/ui/Icon.tsx: criar
[ ] Sidebar / Topbar / leadDisplay: trocar emoji por Icon.*
[ ] AppLayout: mapa `pages` corrigido (bug do título "Dashboard")
[ ] ProspectingPage: remover o <h1> duplicado
[ ] Card, Button, Badge: §4.4–4.6
[ ] LeadsPage: tabela da §4.8 (colgroup, hover, 52px, sticky, linha clicável)

P1 — segunda sessão
[ ] Sidebar: background --surface-0
[ ] KPIs → tabs de status (§4.9); remover o <select> de Status
[ ] Filtros → toolbar + chips (§4.10)
[ ] ScoreBar (§4.7) + size="lg" no LeadDetailPage
[ ] EmptyState (§4.11) nas 4 telas
[ ] PageState com shape (§4.12)

P2 — polimento
[ ] .row-in na tabela; .pulse-dot no job
[ ] Toggle de densidade (52px / 40px via data-density no wrapper)
[ ] Seleção em lote + barra de ação
[ ] ⌘K
```

---

## Fontes

- [Attio Table UI: Real Screenshots & UX Patterns — SaaSUI](https://www.saasui.design/pattern/table/attio)
- [Attio UI Design Examples — CRM UX Patterns — SaaSUI](https://www.saasui.design/application/attio)
- [Attio — DESIGN.md (tokens: Inter, #3abdaf, raio 6px, "1px inner borders")](https://explainx.ai/designs/whyashthakker-design-md-templates-skills/attio/design-md)
- [attio-com Design System, Tokens and DESIGN.md — DesignMD](https://www.designmd.co/d/attio-com)
- [Linear design system — DESIGN.md (escada de superfícies, 3 bordas, escala tipográfica, zero sombra)](https://github.com/voltagent/awesome-design-md/blob/main/design-md/linear.app/DESIGN.md)
- [Linear Design Tokens, Typography & CSS Variables — DesignMD](https://designmd.cc/benchmarks/linear)
- [Inter UI em uso no linear.app — Typ.io](https://typ.io/s/2jmp)
- [Vercel Geist Design System — DesignSystems.one](https://www.designsystems.one/design-systems/vercel-geist)
- [Vercel DESIGN.md (box-shadow 0 0 0 1px no lugar de border, stack de sombra, raios)](https://github.com/ItamarZand88/design-skills/blob/main/design-md/vercel/DESIGN.md)
- [Stripe Dashboard Design Breakdown: Trust Through Clarity — 925 Studios](https://www.925studios.co/blog/stripe-dashboard-design-breakdown)
- [Best Dashboard Design Patterns 2026 (densidade Linear 36px, sidebar 240–280px, 4 KPIs)](https://artofstyleframe.com/blog/dashboard-design-patterns-web-apps/)
- [folk UI Design Examples — CRM UX Patterns — SaaSUI](https://www.saasui.design/application/folk)
- [9 Best CRM Dashboard Examples & Designs (2026) — AdminLTE](https://adminlte.io/blog/crm-dashboard-examples/)
- [Clay UI — show-quick-actions-on-hover (padrão de ação revelada no hover, com acessibilidade de teclado)](https://www.clayui.com/docs/components/table/markup)
```
