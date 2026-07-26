# Extensao de comparador de precos local

Extensao local para Brave/Chrome, usando Manifest V3, JavaScript puro e CSS. O projeto detecta produto e preco em paginas de lojas, mostra um widget compacto na pagina e consulta um backend local para retornar ofertas parecidas.

O projeto ainda e experimental. Ele nao garante que uma oferta seja exatamente o mesmo produto, nao faz scraping amplo de paginas HTML de lojas e ainda nao esta publicado em loja de extensoes.

## Visao geral

O fluxo atual valida uma comparacao local ponta a ponta:

- detecta produto/preco na pagina;
- evita chamadas repetidas desnecessarias;
- consulta `POST /compare` no backend local;
- busca ofertas em um ou mais providers;
- calcula similarity/confidence;
- remove duplicatas;
- ranqueia ofertas;
- calcula economia quando existe preco atual;
- mostra um widget pequeno com ofertas parecidas.

## Arquitetura atual

```text
Pagina de produto
↓
Content script
↓
Detector de produto
↓
Widget
↓
Backend /compare
↓
Multiplos providers
↓
Similarity
↓
Deduplicacao
↓
Ranking
↓
Cache
↓
Resposta para extensao
```

Arquivos principais:

- `manifest.json`: configuracao da extensao.
- `src/productDetector.js`: deteccao de produto por JSON-LD/schema.org.
- `src/content.js`: orquestra deteccao, preferencias locais, widget e chamada ao backend.
- `src/widget.js` e `src/widget.css`: UI compacta do comparador.
- `src/apiClient.js` e `src/background.js`: comunicacao com o backend local.
- `backend/src/server.js`: servidor HTTP local.
- `backend/src/routes/compareRoutes.js`: endpoint `POST /compare`.
- `backend/src/services/compareService.js`: providers, similarity, ranking, cache e resposta.
- `backend/src/services/offerRankingService.js`: deduplicacao, ranking e economia.
- `backend/src/services/cacheService.js`: cache simples em memoria.
- `backend/src/utils/logger.js`: logger simples com `LOG_LEVEL`.

## Escopo entregue

### Semana 1

- Extensao local em Brave/Chrome.
- Content script em paginas `http://` e `https://`.
- Card/widget flutuante inicial.
- Detector inicial por JSON-LD com `@type = "Product"`.

### Semana 2

- Backend local em Node.js.
- Endpoint `GET /health`.
- Endpoint `POST /compare`.
- Provider mock.
- Integracao extensao/backend em `http://localhost:3000`.

### Semana 3

- Provider real inicial do Mercado Livre usando API de busca.
- Similarity/confidence.
- Filtro de resultados ruins.
- Fallback mock opcional.
- Texto do widget usando "ofertas parecidas", sem prometer mesmo produto.

### Semana 4

- Cache simples em memoria.
- Campo `cacheHit`.
- Widget com minimizar/expandir.
- Preferencia de fechar por URL durante a sessao.
- Opcao `Nao mostrar neste site`.
- Evita chamada repetida para o mesmo produto na mesma pagina.

### Semana 5

- Multiplos providers com `PRICE_PROVIDERS`.
- Provider generico configuravel `generic`.
- Deduplicacao de ofertas.
- Ranking final.
- Marcacao de melhor preco.
- Calculo de economia.
- Logs melhores com `LOG_LEVEL` e `requestId`.
- Widget compacto atualizado para mostrar ofertas, fonte, economia, cache e dados de teste.

## Como rodar o backend

Entre na pasta do backend:

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

Por padrao, o backend sobe em:

```text
http://localhost:3000
```

Teste o health check:

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

Use `PRICE_PROVIDERS` para escolher uma ou mais fontes:

```powershell
$env:PRICE_PROVIDERS="mock"
```

```powershell
$env:PRICE_PROVIDERS="mercadolivre"
```

```powershell
$env:PRICE_PROVIDERS="mercadolivre,mock"
```

```powershell
$env:PRICE_PROVIDERS="mercadolivre,generic"
```

O `generic` e uma camada de integracao futura para APIs JSON externas. Sem `GENERIC_SEARCH_PROVIDER_BASE_URL`, ele retorna lista vazia e nao quebra o `/compare`.

## Variaveis do backend

| Variavel | Padrao | Uso |
| --- | --- | --- |
| `PRICE_PROVIDERS` | vazio | Lista de providers ativos separados por virgula. Exemplo: `mercadolivre,mock`. |
| `PRICE_PROVIDER` | `mock` | Compatibilidade com configuracao antiga de provider unico. |
| `PRICE_PROVIDER_FALLBACK_MOCK` | `false` | Usa mock quando provider real falha, se estiver `true`. |
| `MERCADOLIVRE_SEARCH_BASE_URL` | `https://api.mercadolibre.com/sites/MLB/search` | URL da busca Mercado Livre. |
| `GENERIC_SEARCH_PROVIDER_ENABLED` | `false` | Habilita provider `generic`. |
| `GENERIC_SEARCH_PROVIDER_NAME` | `Generic Search` | Nome usado quando a API generica nao informa loja. |
| `GENERIC_SEARCH_PROVIDER_BASE_URL` | vazio | URL base da API generica. |
| `GENERIC_SEARCH_PROVIDER_API_KEY` | vazio | Chave opcional, somente no backend. |
| `GENERIC_SEARCH_PROVIDER_API_KEY_HEADER` | `Authorization` | Header usado para a chave. |
| `PROVIDER_TIMEOUT_MS` | `5000` | Timeout dos providers reais em ms. |
| `COMPARE_CACHE_ENABLED` | `true` | Liga/desliga cache em memoria. |
| `COMPARE_CACHE_TTL_MS` | `3600000` | TTL do cache em ms. |
| `LOG_LEVEL` | `info` | Nivel de log: `debug`, `info`, `warn`, `error`. |

## Como carregar a extensao no Brave

1. Abra o Brave.
2. Acesse `brave://extensions`.
3. Ative o modo desenvolvedor.
4. Clique em `Load unpacked` ou `Carregar sem compactacao`.
5. Selecione a pasta raiz do projeto `extensao`.
6. Recarregue a extensao sempre que alterar arquivos em `src/` ou `manifest.json`.

O mesmo fluxo funciona no Chrome usando `chrome://extensions`.

## Como testar o fluxo completo

1. Suba o backend:

```powershell
cd backend
$env:PRICE_PROVIDERS="mock"
$env:LOG_LEVEL="info"
npm start
```

2. Teste `/health`.
3. Recarregue a extensao em `brave://extensions`.
4. Abra uma pagina de produto detectavel.
5. Confirme que o widget aparece.
6. Confirme que o terminal do backend mostra `Requisicao /compare recebida`.
7. Confirme que o widget mostra ofertas parecidas com loja, preco, fonte, economia e botao `Ver oferta`.
8. Recarregue a mesma pagina e confira `Resultado em cache` quando o backend retornar `cacheHit: true`.
9. Pare o backend com `Ctrl+C` e recarregue a pagina para validar erro amigavel.

Teste manual direto do `/compare`:

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

## Logs

Com `LOG_LEVEL=info`, o backend mostra logs enxutos:

- backend iniciado;
- chamada recebida em `/compare`;
- provider usado;
- `cacheHit`;
- quantidade final de resultados.

Com `LOG_LEVEL=debug`, tambem mostra:

- produto normalizado;
- cache key;
- providers habilitados;
- contagens por provider;
- filtros por similarity;
- deduplicacao;
- TTL usado no cache.

O logger evita expor API keys, `Authorization`, tokens, `raw` externo completo e stack trace completo por padrao.

## Preferencias locais da extensao

- Fechar remove o widget e impede reabertura automatica na mesma URL durante a sessao.
- `Nao mostrar neste site` salva o dominio em `chrome.storage.local`.
- Para limpar sites ocultos durante desenvolvimento:

```js
chrome.storage.local.remove("priceCompareHiddenSites")
```

- Para limpar URLs fechadas durante a sessao:

```js
sessionStorage.removeItem("priceCompareClosedUrls")
```

## Checklist manual

O checklist completo esta em:

```text
docs/manual-test-checklist.md
```

Verificacao rapida de duplicacao do widget:

```js
document.querySelectorAll("#price-compare-widget").length
```

Resultados esperados:

- `1` quando o widget estiver aberto.
- `0` depois de fechar.
- `0` em paginas sem produto detectado.

## Limitacoes conhecidas

- Matching ainda e heuristico.
- Pode haver falso positivo.
- Pode haver falso negativo.
- Fontes externas podem falhar, bloquear, limitar ou mudar formato.
- Preco pode mudar rapidamente.
- Ainda nao existe historico de preco.
- Ainda nao existe alerta de preco.
- Ainda nao existe login.
- Ainda nao existe publicacao em loja.
- Ainda nao existe monetizacao.
- Ainda nao existe banco.
- Ainda nao existe cache persistente.
- Ainda nao existe scraping amplo.
- Ainda nao existem multiplas fontes reais robustas.

## Proximos passos sugeridos

- Melhorar matching por categoria.
- Adicionar testes automatizados basicos.
- Adicionar cache persistente.
- Adicionar historico de preco depois que matching estiver confiavel.
- Preparar build/empacotamento da extensao.

## Estrutura de pastas

```text
extensao/
+-- manifest.json
+-- README.md
+-- docs/
|   +-- manual-test-checklist.md
+-- src/
|   +-- apiClient.js
|   +-- background.js
|   +-- content.js
|   +-- formatters.js
|   +-- productDetector.js
|   +-- widget.css
|   +-- widget.js
+-- backend/
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
