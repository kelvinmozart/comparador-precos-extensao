# Backend local do comparador

Backend simples em Node.js para desenvolvimento local. Ele recebe o produto detectado pela extensão e retorna ofertas parecidas usando providers de preço.

## Objetivo do projeto

Fornecer uma API local mínima para a extensão consultar ofertas parecidas de um produto detectado. O backend não garante que uma oferta seja exatamente o mesmo produto; ele calcula um score simples de similaridade e filtra candidatos ruins.

## O que foi feito na Semana 1

A Semana 1 ficou concentrada na extensão:

- Estrutura inicial da extensão.
- Content script em páginas `http://` e `https://`.
- Widget flutuante simples.
- Detecção inicial de produto por JSON-LD.
- Exibição de nome e preço detectados quando a página expõe `Product`.

## O que foi feito na Semana 2

- Criado backend local em Node.js.
- Criado endpoint `GET /health`.
- Criado endpoint `POST /compare`.
- Criada normalização de produto recebido.
- Criado serviço que gera 5 ofertas mockadas.
- Adicionado CORS para desenvolvimento local.
- Permitido produto sem preço, usando preço base fixo para gerar mock.
- Mantidos `brand`, `sku` e `gtin` como campos opcionais.
- Integrada a extensão ao endpoint `POST /compare`.

## O que foi iniciado na Semana 3

- Criada arquitetura simples de providers de preço.
- Criado contrato de provider com a função `searchOffers(product)`.
- Criado `mockPriceProvider`, mantendo as ofertas mockadas atuais.
- Implementado `mercadoLivrePriceProvider` usando chamada HTTP para a API de busca do Mercado Livre Brasil.
- Criado `priceProviderFactory` para escolher provider por variável de ambiente.
- Criado `compareService` para normalizar produto, chamar provider, calcular similaridade e montar a resposta do `/compare`.
- Criado `similarityService` com cálculo simples de similaridade.
- Criado `normalizeSearchQuery` para preparar buscas futuras.
- Atualizado `POST /compare` para usar `compareService`.
- Adicionado fallback opcional para mock quando um provider falhar.
- Criado filtro de similaridade com threshold `confidence >= 0.70`.
- Adicionado `matchLabel` em cada oferta retornada.

## O que foi iniciado na Semana 4

- Criado cache simples em memoria para respostas do `POST /compare`.
- Criada chave de cache baseada em provider, nome normalizado, marca e `gtin` quando existirem.
- Adicionado `cacheHit` na resposta do endpoint.
- Adicionadas variaveis `COMPARE_CACHE_ENABLED` e `COMPARE_CACHE_TTL_MS`.
- Mantido o cache apenas em memoria, sem banco, Redis ou persistencia.
- Criado checklist manual de validacao em `../docs/manual-test-checklist.md`.

## Como rodar o backend local

Entre na pasta `backend`:

```powershell
cd backend
```

Instale as dependências:

```powershell
npm install
```

Este backend não usa dependências externas nesta etapa, mas o comando mantém o fluxo padrão do projeto.

Inicie o servidor:

```powershell
npm start
```

Por padrão, o servidor sobe em:

```text
http://localhost:3000
```

Para usar outra porta durante desenvolvimento:

```powershell
$env:PORT=3333; npm start
```

## Configurar provider de preço

Por padrão, o backend usa o provider mock:

```powershell
$env:PRICE_PROVIDER="mock"; npm start
```

Providers disponíveis nesta etapa:

- `mock`: retorna ofertas mockadas e continua sendo o provider funcional.
- `mercadolivre`: busca candidatos reais usando a API de busca do Mercado Livre Brasil. Não faz scraping de HTML.

Para selecionar o provider Mercado Livre:

```powershell
$env:PRICE_PROVIDER="mercadolivre"; npm start
```

Se a API externa retornar erro, timeout, `403`, `429` ou formato inesperado, o erro é registrado no console e o endpoint continua respondendo sem derrubar a API.

O provider usa `fetch` nativo do Node.js quando disponível. Se `fetch` não existir, usa os módulos nativos `http`/`https`, sem dependência externa.

Para usar fallback mock quando o provider escolhido falhar:

```powershell
$env:PRICE_PROVIDER="mercadolivre"
$env:PRICE_PROVIDER_FALLBACK_MOCK="true"
npm start
```

Variáveis suportadas:

- `PRICE_PROVIDER`: define o provider usado pelo `/compare`. Valores atuais: `mock` ou `mercadolivre`.
- `PRICE_PROVIDER_FALLBACK_MOCK`: quando `true`, usa o mock se o provider escolhido falhar.
- `MERCADOLIVRE_SEARCH_BASE_URL`: URL base da busca do Mercado Livre. Padrão: `https://api.mercadolibre.com/sites/MLB/search`.
- `PROVIDER_TIMEOUT_MS`: timeout da chamada do provider em milissegundos. Padrão: `5000`.
- `COMPARE_CACHE_ENABLED`: habilita ou desabilita o cache do `/compare`. Padrao: `true`.
- `COMPARE_CACHE_TTL_MS`: tempo de vida do cache em milissegundos. Padrao: `3600000` (1 hora). Respostas sem ofertas ou com fallback por erro usam TTL curto de 5 minutos.

Exemplo em uma linha usando mock:

```powershell
$env:PRICE_PROVIDER="mock"; npm start
```

Exemplo em uma linha usando Mercado Livre com fallback mock:

```powershell
$env:PRICE_PROVIDER="mercadolivre"; $env:PRICE_PROVIDER_FALLBACK_MOCK="true"; npm start
```

## Testar GET /health

```powershell
Invoke-RestMethod -Method GET -Uri http://localhost:3000/health
```

Resposta esperada:

```json
{
  "status": "ok"
}
```

## Testar POST /compare

```powershell
$body = @{
  name = "iPhone 15 128GB"
  price = 4299.90
  currency = "BRL"
  url = "https://site-atual.com/produto"
  brand = "Apple"
  sku = "123"
  gtin = "7891234567890"
} | ConvertTo-Json

Invoke-RestMethod `
  -Method POST `
  -Uri http://localhost:3000/compare `
  -ContentType "application/json" `
  -Body $body
```

Resposta esperada no formato:

```json
{
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
      "confidence": 0.92,
      "matchLabel": "Alta similaridade",
      "source": "mock"
    }
  ],
  "provider": {
    "name": "mock",
    "requestedProvider": "mock",
    "fallbackUsed": false,
    "failedProvider": null
  },
  "cacheHit": false,
  "generatedAt": "2026-07-08T00:00:00.000Z"
}
```

A resposta real retorna 5 ofertas mockadas, ordenadas do menor preço para o maior preço. O campo `generatedAt` usa a data/hora atual.

Com `PRICE_PROVIDER=mock`, o formato da resposta continua sendo:

- `currentProduct`
- `results`
- `provider`
- `cacheHit`
- `generatedAt`

Com `PRICE_PROVIDER=mercadolivre`, o backend tenta buscar ofertas reais na API do Mercado Livre Brasil. Se a fonte externa falhar e o fallback estiver desligado, o backend ainda responde no mesmo formato, mas `results` pode vir vazio.

Na primeira chamada para uma chave de produto/provider, `cacheHit` retorna `false`. Enquanto o TTL estiver valido, chamadas seguintes para o mesmo produto retornam `cacheHit: true` e nao chamam o provider novamente.

Para desligar o cache temporariamente:

```powershell
$env:COMPARE_CACHE_ENABLED="false"; npm start
```

Para alterar o TTL para 10 minutos:

```powershell
$env:COMPARE_CACHE_TTL_MS="600000"; npm start
```

## Como interpretar confidence

Cada oferta retornada passa pelo `similarityService`.

- `confidence >= 0.85`: `matchLabel` será `Alta similaridade`.
- `confidence >= 0.70` e `< 0.85`: `matchLabel` será `Oferta parecida`.
- `confidence < 0.70`: a oferta é filtrada e não aparece em `results`.

O cálculo considera palavras iguais, marca, possíveis modelos, capacidade/tamanho como `128GB`, `256GB`, `55"` ou `15.6"`, termos problemáticos e identificadores como `gtin`, `sku` e `mpn` quando existirem.

Termos como `usado`, `seminovo`, `recondicionado`, `vitrine`, `open box`, `peça`, `capa`, `película`, `carregador` e `compatível` reduzem a confiança quando o produto original não indica esse contexto.

## Como carregar a extensão no Brave

1. Abra o Brave.
2. Acesse:

```text
brave://extensions
```

3. Ative o modo desenvolvedor.
4. Clique em `Load unpacked` ou `Carregar sem compactação`.
5. Selecione a pasta principal da extensão:

```text
caminho/para/extensao
```

## Como testar o fluxo completo

1. Suba o backend em `localhost:3000`.
2. Carregue ou recarregue a extensão no Brave.
3. Abra uma página de produto detectável pela extensão.
4. Verifique se o card aparece.
5. Verifique se o produto detectado aparece no widget.
6. Verifique se o backend recebe a chamada `POST /compare`.
7. Verifique se as ofertas mockadas aparecem no widget.
8. Desligue o backend com `Ctrl+C`.
9. Recarregue uma página de produto.
10. Confirme que a extensão mostra a mensagem:

```text
Não foi possível buscar ofertas agora.
```

11. Abra uma página sem produto e confirme que a extensão não chama o backend.

## Como ver logs de diagnóstico

No terminal onde o backend está rodando, os logs aparecem com estes prefixos:

- `[backend][compare]`: o endpoint `POST /compare` recebeu a requisição e gerou resposta.
- `[backend][server]`: erro inesperado no servidor HTTP.
- `[compareService]`: falha de provider e uso de fallback mock.
- `[mercadoLivrePriceProvider]`: falha, timeout ou resposta inesperada da API do Mercado Livre.

Na extensão, abra o DevTools da página de produto com `F12` e veja o console:

- `[PriceCompare][content]`: produto detectado, widget e conclusão da comparação.
- `[PriceCompare][apiClient]`: pedido de comparação enviado pelo content script. Quando estiver correto, deve mostrar `transport: "background"`.

Como a chamada ao `localhost` passa pelo background da extensão, os logs da requisição real ficam no service worker em `brave://extensions`, no link `Service worker` ou `Inspecionar visualizações`. Procure por `[PriceCompare][background]`.

Teste rápido do backend pelo console da página:

```js
fetch("http://localhost:3000/health").then((r) => r.json()).then(console.log).catch(console.error)
```

Se o widget mostrar `Não foi possível buscar ofertas agora.`, confira primeiro se aparece uma linha `[backend][compare]` no terminal. Se não aparecer, a requisição nem chegou ao backend.

## Checklist manual

- [ ] Backend sobe sem erro.
- [ ] `/health` retorna `ok`.
- [ ] `/compare` retorna mock.
- [ ] `PRICE_PROVIDER=mock` mantém o `/compare` funcionando.
- [ ] `PRICE_PROVIDER=mercadolivre` não derruba a API.
- [ ] `PRICE_PROVIDER_FALLBACK_MOCK=true` usa mock quando o provider escolhido falha.
- [ ] Primeira chamada para o mesmo produto retorna `cacheHit: false`.
- [ ] Segunda chamada para o mesmo produto retorna `cacheHit: true`.
- [ ] Resultados retornam `confidence`.
- [ ] Resultados retornam `matchLabel`.
- [ ] Resultados abaixo do threshold não aparecem.
- [ ] Extensão carrega sem erro.
- [ ] Widget aparece em página com produto.
- [ ] Página sem produto não chama backend.
- [ ] Página com produto chama backend.
- [ ] Ofertas mockadas aparecem.
- [ ] Botão fechar funciona.
- [ ] Erro de backend offline é tratado.

## O que ainda não existe

- Scraping real.
- Integrações com múltiplas APIs reais.
- Banco de dados.
- Histórico de preço.
- Login.
- Alertas.
- Publicação na Chrome Web Store.
- Comparação robusta com múltiplas fontes reais.
- Garantia de que toda oferta retornada é exatamente o mesmo produto.

## Proximos passos apos a Semana 4

- Melhorar qualidade e cobertura do provider real.
- Adicionar novas fontes reais de forma controlada.
- Evoluir o score de similaridade com mais sinais.
- Avaliar persistencia e historico apenas em etapa futura.

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

## Observações honestas

- O provider mock não consulta lojas externas.
- O provider Mercado Livre usa API de busca, não páginas HTML de produto.
- Nenhum HTML de loja é buscado.
- Não existe scraping.
- A API externa pode bloquear, limitar ou falhar.
- Pode haver falso positivo ou falso negativo no score.
- O preço pode mudar depois da consulta.
- As URLs das ofertas mockadas apontam para `example.com`.
- Os preços mockados são gerados com fatores fixos a partir do preço recebido ou de um preço base.
- A similaridade ainda é simples e serve para reduzir resultados ruins, não para garantir igualdade perfeita.
- O objetivo atual é validar o fluxo técnico antes de integrar fontes reais.
