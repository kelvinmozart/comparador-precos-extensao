# Checklist manual de validacao

Use este checklist para fechar a Semana 5. Rode em uma execucao limpa: backend reiniciado, extensao recarregada em `brave://extensions` e pagina de produto aberta novamente.

## Preparacao

- [ ] Rodar `npm install` dentro de `backend`.
- [ ] Recarregar a extensao em `brave://extensions`.
- [ ] Confirmar que a pasta carregada e a raiz do projeto `extensao`.
- [ ] Abrir uma nova aba de produto para evitar bloqueio por URL fechada em `sessionStorage`.
- [ ] Limpar sites ocultos, se necessario:

```js
chrome.storage.local.remove("priceCompareHiddenSites")
```

- [ ] Limpar URLs fechadas na sessao, se necessario:

```js
sessionStorage.removeItem("priceCompareClosedUrls")
```

## Backend

- [ ] `/health` retorna `ok`.
- [ ] `/compare` funciona com `PRICE_PROVIDERS=mock`.
- [ ] `/compare` funciona com `PRICE_PROVIDERS=mercadolivre`, se a fonte externa estiver disponivel.
- [ ] `/compare` funciona com multiplos providers, por exemplo `PRICE_PROVIDERS=mercadolivre,mock`.
- [ ] `/compare` funciona com `PRICE_PROVIDERS=mercadolivre,generic`.
- [ ] `PRICE_PROVIDERS=generic` nao quebra sem `GENERIC_SEARCH_PROVIDER_BASE_URL`.
- [ ] Provider com erro nao derruba a resposta quando outro provider responde.
- [ ] Fallback mock funciona com `PRICE_PROVIDER_FALLBACK_MOCK=true`.
- [ ] Resposta mantem `provider` para compatibilidade.
- [ ] Resposta inclui `providers` com `name`, `status` e `count`.
- [ ] Primeira chamada igual para um produto retorna `cacheHit: false`.
- [ ] Segunda chamada igual para o mesmo produto retorna `cacheHit: true`.
- [ ] `confidence` e calculada.
- [ ] Resultados abaixo de `confidence < 0.70` sao filtrados.
- [ ] Resultados finais retornam no maximo 10 itens.
- [ ] Duplicados sao removidos.
- [ ] Melhor oferta retorna `isBestPrice: true`.
- [ ] Resultados retornam `rank`.
- [ ] Economia e calculada quando o preco atual existe.
- [ ] Quando o produto atual tem preco, nenhuma oferta igual ou mais cara aparece.
- [ ] Ofertas sem titulo, sem preco valido ou sem URL valida nao aparecem no resultado final.
- [ ] Logs aparecem conforme `LOG_LEVEL=info`.
- [ ] Logs detalhados aparecem com `LOG_LEVEL=debug`.
- [ ] Logs incluem `requestId` por chamada de `/compare`.
- [ ] API keys, `Authorization`, tokens e `raw` externo completo nao aparecem nos logs.
- [ ] Resposta de erro do `/compare` nao expoe stack trace.

### Comandos uteis

Health check:

```powershell
Invoke-RestMethod -Method GET -Uri http://localhost:3000/health
```

POST `/compare`:

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

Cache esperado:

- [ ] Primeira execucao mostra `cacheHit: false`.
- [ ] Segunda execucao igual mostra `cacheHit: true`.

## Extensao

- [ ] Extensao carrega no Brave sem erro.
- [ ] Widget aparece em pagina de produto detectavel.
- [ ] Widget nao aparece duplicado.
- [ ] Pagina sem produto nao chama backend.
- [ ] Produto detectado e enviado ao backend.
- [ ] Widget compacto nao mostra bloco de produto atual/preco atual/menor preco.
- [ ] Ofertas aparecem com loja, preco, economia, fonte e botao `Ver oferta`.
- [ ] Similaridade percentual nao aparece no widget compacto.
- [ ] Primeira oferta com `isBestPrice=true` mostra `Melhor preco`.
- [ ] Widget compacto exibe no maximo 3 ofertas mesmo se o backend retornar ate 10.
- [ ] `Resultado em cache` aparece quando o backend retornar `cacheHit: true`.
- [ ] `Dados de teste` aparece quando resultados vierem de mock.
- [ ] Fallback mock mostra aviso de fonte real indisponivel.
- [ ] Botao fechar remove o widget.
- [ ] Widget nao reaparece automaticamente na mesma URL durante a mesma sessao apos fechar.
- [ ] Botao minimizar/expandir funciona.
- [ ] Barrinha minimizada mostra texto curto.
- [ ] Clicar na barrinha minimizada expande o widget.
- [ ] `Nao mostrar neste site` funciona.
- [ ] Dominio salvo em `Nao mostrar neste site` impede reabertura do widget nesse site.
- [ ] Backend offline mostra erro amigavel no widget.
- [ ] Troca de URL em SPA nao duplica widget.
- [ ] Troca de URL em SPA reexecuta analise de forma controlada.
- [ ] A mesma pagina/produto nao chama `/compare` repetidamente sem necessidade.

### Verificacoes no console da pagina

Quantidade de widgets:

```js
document.querySelectorAll("#price-compare-widget").length
```

Resultado esperado:

- [ ] `1` quando o widget estiver aberto.
- [ ] `0` depois de fechar.
- [ ] `0` em pagina sem produto detectado.

## UX

- [ ] Texto usa "ofertas parecidas".
- [ ] Texto nao promete "mesmo produto".
- [ ] Widget continua pequeno e discreto.
- [ ] Widget nao cobre botao de compra nas paginas testadas.
- [ ] Lista limita a no maximo 3 ofertas.
- [ ] Titulo longo de oferta nao quebra layout.
- [ ] Preco longo nao quebra layout.
- [ ] Link de oferta abre em nova aba.
- [ ] Link de oferta usa `rel="noopener noreferrer"`.
- [ ] Botao fechar e botao minimizar sao faceis de encontrar.
- [ ] Opcao `Nao mostrar neste site` e discreta.
- [ ] Resultado mock aparece como dado de teste.
- [ ] Erro de backend offline nao mostra stack trace.

## Documentacao

- [ ] README principal descreve arquitetura atual.
- [ ] README principal descreve escopo entregue por semana.
- [ ] README principal documenta como rodar backend.
- [ ] README principal documenta providers.
- [ ] README principal documenta variaveis do backend.
- [ ] README principal documenta como carregar extensao no Brave.
- [ ] README principal lista limitacoes conhecidas.
- [ ] README principal lista proximos passos sugeridos.
- [ ] `backend/README.md` esta atualizado.
- [ ] `docs/manual-test-checklist.md` esta atualizado.
- [ ] Nenhuma dependencia nova foi adicionada para esta documentacao.
- [ ] Nenhum banco, login, historico, alerta, scraping amplo ou publicacao foi prometido como existente.
