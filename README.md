# Extensao de comparador de precos local

Extensao local para Brave/Chrome, usando Manifest V3, JavaScript puro e CSS. O projeto detecta produto e preco em paginas de lojas, mostra um widget pequeno na pagina e consulta um backend local para retornar ofertas parecidas.

O projeto ainda e experimental. Ele nao garante que uma oferta seja exatamente o mesmo produto, nao faz scraping de paginas HTML de lojas e ainda nao esta publicado na Chrome Web Store.

## Visao geral

O objetivo e validar um fluxo ponta a ponta de comparacao de precos local:

- detectar um produto na pagina atual;
- mostrar o produto detectado em um widget discreto;
- consultar um backend local em `POST /compare`;
- buscar ofertas por provider mock ou provider real inicial;
- calcular similaridade;
- filtrar ofertas ruins;
- evitar chamadas repetidas usando cache em memoria;
- devolver a resposta para a extensao sem quebrar a experiencia da pagina.

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
Provider mock ou provider real
↓
Similarity
↓
Cache
↓
Resposta para extensao
```

Arquivos principais:

- `manifest.json`: configuracao da extensao.
- `src/productDetector.js`: deteccao de produto por JSON-LD.
- `src/content.js`: orquestra deteccao, widget, preferencias locais e chamadas ao backend.
- `src/widget.js` e `src/widget.css`: UI do comparador.
- `src/apiClient.js` e `src/background.js`: comunicacao com o backend local.
- `backend/src/server.js`: servidor HTTP local.
- `backend/src/routes/compareRoutes.js`: endpoint `POST /compare`.
- `backend/src/services/compareService.js`: provider, similarity, cache e resposta.
- `backend/src/services/cacheService.js`: cache simples em memoria.
- `backend/src/services/similarityService.js`: score de similaridade.

## Escopo entregue

### Semana 1

- Estrutura inicial da extensao.
- Content script em paginas `http://` e `https://`.
- Card/widget flutuante no canto inferior direito.
- Detector inicial por JSON-LD com `@type = "Product"`.
- Protecao contra duplicacao basica do widget.
- Reexecucao simples da deteccao em mudancas de URL de SPAs.

### Semana 2

- Backend local em Node.js.
- Endpoint `GET /health`.
- Endpoint `POST /compare`.
- Provider mock com ofertas de teste.
- Normalizacao basica de produto no backend.
- Cliente da API na extensao.
- Integracao extensao/backend em `http://localhost:3000`.
- Estados de carregamento, ofertas e erro amigavel no widget.

### Semana 3

- Arquitetura de providers de preco.
- Provider real inicial do Mercado Livre usando API de busca, sem scraping.
- Fallback opcional para mock quando o provider real falha.
- Calculo simples de similarity/confidence.
- Filtro para ofertas com `confidence < 0.70`.
- Texto do widget ajustado para "ofertas parecidas", sem prometer mesmo produto.

### Semana 4

- Cache simples em memoria no backend.
- Campo `cacheHit` na resposta do `/compare`.
- Variaveis `COMPARE_CACHE_ENABLED` e `COMPARE_CACHE_TTL_MS`.
- Widget com minimizar/expandir.
- Preferencia de fechar por URL durante a sessao.
- Opcao `Nao mostrar neste site` usando `chrome.storage.local`.
- Evita chamadas repetidas ao backend para o mesmo produto na mesma pagina.
- Checklist manual de validacao em `docs/manual-test-checklist.md`.

## Como rodar o backend

Entre na pasta do backend:

```powershell
cd backend
```

Instale as dependencias:

```powershell
npm install
```

Inicie o servidor:

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

## Como carregar a extensao no Brave

1. Abra o Brave.
2. Acesse:

```text
brave://extensions
```

3. Ative o modo desenvolvedor.
4. Clique em `Load unpacked` ou `Carregar sem compactacao`.
5. Selecione a pasta da extensao:

```text
caminho/para/extensao
```

6. Recarregue a extensao sempre que alterar `manifest.json`, `src/*.js` ou `src/*.css`.

O mesmo fluxo tambem funciona no Chrome usando:

```text
chrome://extensions
```

## Variaveis de ambiente do backend

| Variavel | Padrao | Uso |
| --- | --- | --- |
| `PRICE_PROVIDER` | `mock` | Escolhe o provider usado pelo `/compare`. Valores atuais: `mock` ou `mercadolivre`. |
| `PRICE_PROVIDER_FALLBACK_MOCK` | `false` | Quando `true`, usa o mock se o provider escolhido falhar. |
| `MERCADOLIVRE_SEARCH_BASE_URL` | `https://api.mercadolibre.com/sites/MLB/search` | URL base da busca do Mercado Livre. |
| `PROVIDER_TIMEOUT_MS` | `5000` | Timeout da chamada do provider em milissegundos. |
| `COMPARE_CACHE_ENABLED` | `true` | Habilita ou desabilita o cache em memoria do `/compare`. |
| `COMPARE_CACHE_TTL_MS` | `3600000` | TTL do cache em milissegundos. Respostas vazias ou com fallback por erro usam TTL curto de 5 minutos. |

## Como testar com mock

Suba o backend com provider mock:

```powershell
cd backend
$env:PRICE_PROVIDER="mock"
npm start
```

Depois:

1. Recarregue a extensao em `brave://extensions`.
2. Abra uma pagina de produto detectavel.
3. Confirme que o widget aparece.
4. Confirme que o backend recebe `POST /compare`.
5. Confirme que aparecem ofertas mockadas com preco, fonte e similaridade.
6. Chame o mesmo produto novamente e confira `cacheHit: true` na resposta/log.

## Como testar com provider real

Suba o backend com Mercado Livre:

```powershell
cd backend
$env:PRICE_PROVIDER="mercadolivre"
npm start
```

Depois:

1. Abra uma pagina de produto detectavel.
2. Confirme que o backend tenta buscar ofertas reais.
3. Se a fonte externa responder, confira ofertas com `source: "mercadolivre"`.
4. Se a fonte externa falhar, confira que a API nao cai e retorna resposta amigavel, possivelmente com `results` vazio.

Para validar fallback mock:

```powershell
cd backend
$env:PRICE_PROVIDER="mercadolivre"
$env:PRICE_PROVIDER_FALLBACK_MOCK="true"
npm start
```

Quando o provider real falhar, a resposta deve indicar:

- `provider.fallbackUsed: true`
- `provider.failedProvider: "mercadolivre"`
- ofertas mockadas, se o fallback conseguir responder.

## Preferencias locais da extensao

- Fechar o widget remove o card e impede que ele reapareca automaticamente na mesma URL durante a mesma sessao.
- `Nao mostrar neste site` salva o dominio em `chrome.storage.local`.
- Para limpar sites ocultos durante desenvolvimento, abra o DevTools do service worker da extensao e rode:

```js
chrome.storage.local.remove("priceCompareHiddenSites")
```

O fechamento por URL usa `sessionStorage`. Para testar novamente, abra nova aba/sessao da pagina ou limpe o storage da aba.

## Checklist manual

O checklist completo esta em:

```text
docs/manual-test-checklist.md
```

Para verificar rapidamente se o widget nao duplicou, abra o console da pagina e rode:

```js
document.querySelectorAll("#price-compare-widget").length
```

Resultados esperados:

- `1` quando o widget estiver aberto em uma pagina de produto.
- `0` depois de clicar em fechar.
- `0` em paginas sem produto detectado.

## Como ver logs de diagnostico

Na pagina de produto, abra o DevTools com `F12` e veja o console:

- `[PriceCompare][content]`: deteccao, preferencias locais, widget e fluxo da comparacao.
- `[PriceCompare][apiClient]`: chamada ao backend local.
- `[PriceCompare][background]`: chamada feita pelo service worker da extensao.

No terminal do backend:

- `[backend][compare]`: entrada e saida do `POST /compare`.
- `[backend][server]`: erros inesperados do servidor HTTP.
- `[compareService]`: falha de provider e fallback mock.
- `[mercadoLivrePriceProvider]`: falha, timeout ou resposta inesperada da API do Mercado Livre.

## Limitacoes conhecidas

- Ainda pode haver falso positivo na deteccao de produto.
- Ainda pode haver falso negativo na deteccao de produto.
- A fonte externa pode falhar, limitar, bloquear ou mudar o formato da resposta.
- O preco exibido pode mudar depois da consulta.
- O score de similaridade reduz resultados ruins, mas nao garante igualdade perfeita.
- Ainda nao existe historico de preco.
- Ainda nao existe alerta de preco.
- Ainda nao existem multiplas fontes reais robustas.
- Ainda nao existe publicacao na Chrome Web Store.
- Ainda nao existe monetizacao ou afiliado.
- Ainda nao existe login, sincronizacao em nuvem, banco de dados ou cache persistente.

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
        |   +-- mercadoLivrePriceProvider.js
        |   +-- mockPriceProvider.js
        |   +-- priceProviderFactory.js
        +-- routes/
        |   +-- compareRoutes.js
        +-- services/
        |   +-- cacheService.js
        |   +-- compareService.js
        |   +-- mockCompareService.js
        |   +-- similarityService.js
        +-- utils/
            +-- buildCacheKey.js
            +-- normalizeProduct.js
            +-- normalizeSearchQuery.js
```
