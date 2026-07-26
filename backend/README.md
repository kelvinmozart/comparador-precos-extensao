# Backend local do comparador

Backend simples em Node.js para desenvolvimento local. Ele recebe o produto detectado pela extensao e retorna ofertas parecidas usando providers de preco.

O backend nao garante que uma oferta seja exatamente o mesmo produto. Ele usa heuristicas de similarity/confidence, deduplicacao e ranking para reduzir resultados ruins.

## O que existe hoje

- `GET /health`.
- `POST /compare`.
- Provider `mock`.
- Provider `mercadolivre` usando API de busca, sem scraping HTML.
- Provider `generic` configuravel para APIs JSON externas.
- Multiplos providers via `PRICE_PROVIDERS`.
- Fallback mock opcional.
- Similarity/confidence.
- Filtro por threshold.
- Deduplicacao.
- Ranking.
- Melhor preco com `isBestPrice`.
- Economia com `priceDifferenceFromCurrent` e `priceDifferencePercentFromCurrent`.
- Cache simples em memoria.
- Logs com `LOG_LEVEL` e `requestId`.

## Escopo por semana

- Semana 1: extensao local e card flutuante.
- Semana 2: backend mock e integracao extensao/backend.
- Semana 3: provider real inicial e similarity.
- Semana 4: cache, UX e preferencias locais.
- Semana 5: multiplos providers, provider generico, ranking, deduplicacao, economia e logs.

## Rodar localmente

Entre na pasta:

```powershell
cd backend
```

Instale:

```powershell
npm install
```

Inicie:

```powershell
npm start
```

Por padrao:

```text
http://localhost:3000
```

Para mudar porta:

```powershell
$env:PORT=3333; npm start
```

## Health check

```powershell
Invoke-RestMethod -Method GET -Uri http://localhost:3000/health
```

Resposta esperada:

```json
{
  "status": "ok"
}
```

## Configurar providers

Mock:

```powershell
$env:PRICE_PROVIDERS="mock"; npm start
```

Mercado Livre:

```powershell
$env:PRICE_PROVIDERS="mercadolivre"; npm start
```

Mercado Livre + mock:

```powershell
$env:PRICE_PROVIDERS="mercadolivre,mock"; npm start
```

Mercado Livre + generic:

```powershell
$env:PRICE_PROVIDERS="mercadolivre,generic"; npm start
```

Generic configurado:

```powershell
$env:PRICE_PROVIDERS="generic"
$env:GENERIC_SEARCH_PROVIDER_ENABLED="true"
$env:GENERIC_SEARCH_PROVIDER_BASE_URL="https://api.exemplo.com/search"
$env:GENERIC_SEARCH_PROVIDER_API_KEY="sua-chave-apenas-no-backend"
npm start
```

Sem `GENERIC_SEARCH_PROVIDER_BASE_URL`, o provider `generic` retorna `[]` e nao quebra a API.

Fallback mock:

```powershell
$env:PRICE_PROVIDERS="mercadolivre"
$env:PRICE_PROVIDER_FALLBACK_MOCK="true"
npm start
```

## Variaveis suportadas

| Variavel | Padrao | Uso |
| --- | --- | --- |
| `PRICE_PROVIDERS` | vazio | Lista de providers ativos separados por virgula. |
| `PRICE_PROVIDER` | `mock` | Compatibilidade com provider unico antigo. |
| `PRICE_PROVIDER_FALLBACK_MOCK` | `false` | Usa mock se provider real falhar. |
| `MERCADOLIVRE_SEARCH_BASE_URL` | `https://api.mercadolibre.com/sites/MLB/search` | URL de busca Mercado Livre. |
| `GENERIC_SEARCH_PROVIDER_ENABLED` | `false` | Habilita provider `generic`. |
| `GENERIC_SEARCH_PROVIDER_NAME` | `Generic Search` | Nome padrao de loja/fonte generica. |
| `GENERIC_SEARCH_PROVIDER_BASE_URL` | vazio | URL base da API generica. |
| `GENERIC_SEARCH_PROVIDER_API_KEY` | vazio | Chave opcional usada somente no backend. |
| `GENERIC_SEARCH_PROVIDER_API_KEY_HEADER` | `Authorization` | Header usado para a chave. |
| `GENERIC_SEARCH_PROVIDER_TIMEOUT_MS` | `5000` | Timeout do provider generico. |
| `PROVIDER_TIMEOUT_MS` | `5000` | Timeout dos providers reais. |
| `COMPARE_CACHE_ENABLED` | `true` | Liga/desliga cache em memoria. |
| `COMPARE_CACHE_TTL_MS` | `3600000` | TTL do cache em ms. |
| `LOG_LEVEL` | `info` | Nivel de logs: `debug`, `info`, `warn`, `error`. |

## Testar POST /compare

```powershell
$body = @{
  name = "iPhone 15 128GB"
  price = 4299.90
  currency = "BRL"
  brand = "Apple"
  gtin = "7891234567890"
  url = "https://site-atual.com/produto"
} | ConvertTo-Json

Invoke-RestMethod `
  -Method POST `
  -Uri http://localhost:3000/compare `
  -ContentType "application/json" `
  -Body $body
```

Campos principais da resposta:

```json
{
  "requestId": "abc123",
  "currentProduct": {
    "name": "iPhone 15 128GB",
    "price": 4299.9,
    "currency": "BRL",
    "url": "https://site-atual.com/produto"
  },
  "results": [
    {
      "store": "Loja Mock 1",
      "title": "iPhone 15 128GB",
      "price": 4041.91,
      "currency": "BRL",
      "url": "https://example.com/oferta-1",
      "source": "mock",
      "confidence": 0.84,
      "matchLabel": "Oferta parecida",
      "rank": 1,
      "isBestPrice": true,
      "priceDifferenceFromCurrent": -257.99,
      "priceDifferencePercentFromCurrent": -6
    }
  ],
  "provider": {
    "name": "mock",
    "requestedProvider": "mock",
    "fallbackUsed": false,
    "failedProvider": null
  },
  "providers": [
    {
      "name": "mock",
      "status": "ok",
      "count": 5
    }
  ],
  "cacheHit": false,
  "generatedAt": "2026-07-25T00:00:00.000Z"
}
```

## Similarity, deduplicacao e ranking

O backend calcula `confidence` para cada oferta e remove resultados abaixo de `0.70`.

A deduplicacao remove ofertas repetidas por sinais simples:

- URL igual.
- Mesmo provider e mesmo ID externo em `raw`, quando existir.
- Titulo normalizado igual e preco igual.
- Titulo muito parecido com preco proximo ou mesma loja.

O ranking considera:

- preco menor;
- confidence maior;
- URL valida;
- imagem;
- provider real antes de mock quando precos forem parecidos.

Quando o produto atual tem preco, ofertas iguais ou mais caras sao filtradas. O backend retorna no maximo 10 ofertas finais.

## Cache

Por padrao, o cache fica ligado:

```powershell
$env:COMPARE_CACHE_ENABLED="true"
$env:COMPARE_CACHE_TTL_MS="3600000"
```

Primeira chamada para o mesmo produto/provider:

```json
"cacheHit": false
```

Segunda chamada igual dentro do TTL:

```json
"cacheHit": true
```

Respostas vazias ou com fallback por erro usam TTL curto de 5 minutos.

## Logs

Modo normal:

```powershell
$env:LOG_LEVEL="info"; npm start
```

Mostra:

- backend iniciado;
- chamada recebida;
- provider usado;
- `cacheHit`;
- quantidade final de resultados.

Modo diagnostico:

```powershell
$env:LOG_LEVEL="debug"; npm start
```

Mostra tambem:

- produto normalizado;
- cache key;
- providers habilitados;
- contagens por provider;
- quantidade removida por similarity;
- quantidade removida por deduplicacao;
- TTL de cache.

O logger evita expor API keys, `Authorization`, tokens, `raw` externo completo e stack trace completo por padrao.

## Estrutura

```text
backend/
+-- package.json
+-- README.md
+-- src/
    +-- server.js
    +-- config/
    |   +-- providerConfig.js
    +-- providers/
    |   +-- genericSearchPriceProvider.js
    |   +-- mercadoLivrePriceProvider.js
    |   +-- mockPriceProvider.js
    |   +-- priceProviderFactory.js
    +-- routes/
    |   +-- compareRoutes.js
    +-- services/
    |   +-- cacheService.js
    |   +-- compareService.js
    |   +-- mockCompareService.js
    |   +-- offerRankingService.js
    |   +-- similarityService.js
    +-- utils/
        +-- buildCacheKey.js
        +-- logger.js
        +-- normalizeProduct.js
        +-- normalizeSearchQuery.js
```

## Limitacoes

- Matching ainda e heuristico.
- Pode haver falso positivo.
- Pode haver falso negativo.
- Fonte externa pode falhar.
- Preco pode mudar rapidamente.
- Nao existe banco.
- Nao existe login.
- Nao existe historico.
- Nao existe alerta de preco.
- Nao existe scraping amplo.
- Nao existe publicacao em loja.
