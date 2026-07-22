# Checklist manual de validacao

Use este checklist para fechar a Semana 4 e validar o projeto ponta a ponta. Marque os itens em uma execucao limpa: backend reiniciado, extensao recarregada em `brave://extensions` e pagina de produto aberta novamente.

## Preparacao

- [ ] Rodar `npm install` dentro de `backend`.
- [ ] Recarregar a extensao em `brave://extensions`.
- [ ] Confirmar que a pasta carregada e a raiz do projeto `extensao`.
- [ ] Limpar sites ocultos, se necessario:

```js
chrome.storage.local.remove("priceCompareHiddenSites")
```

- [ ] Abrir uma nova aba de produto para evitar bloqueio por URL fechada em `sessionStorage`.

## Backend

- [ ] `/health` retorna `ok`.
- [ ] `/compare` funciona com `PRICE_PROVIDER=mock`.
- [ ] `/compare` funciona com `PRICE_PROVIDER=mercadolivre`, se a fonte externa estiver disponivel.
- [ ] Fallback mock funciona com `PRICE_PROVIDER_FALLBACK_MOCK=true` quando o provider real falha.
- [ ] Timeout do provider nao derruba a API.
- [ ] Primeira chamada igual para um produto retorna `cacheHit: false`.
- [ ] Segunda chamada igual para o mesmo produto retorna `cacheHit: true`.
- [ ] Resultados retornam `confidence`.
- [ ] Resultados retornam `matchLabel`.
- [ ] Resultados ruins abaixo de `confidence < 0.70` sao filtrados.
- [ ] Resposta de erro do `/compare` nao expoe stack trace.
- [ ] Logs do backend ajudam a diagnosticar provider, fallback e cache.

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

- [ ] Primeira execucao do comando acima mostra `cacheHit: false`.
- [ ] Segunda execucao igual mostra `cacheHit: true`.

## Extensao

- [ ] Extensao carrega no Brave sem erro.
- [ ] Widget aparece em pagina de produto detectavel.
- [ ] Widget nao aparece duplicado.
- [ ] Pagina sem produto nao chama backend.
- [ ] Produto detectado mostra nome e preco.
- [ ] Ofertas aparecem com loja, preco, fonte e similaridade.
- [ ] Campo de menor preco aparece quando houver ofertas.
- [ ] Rodape mostra data/hora simples da atualizacao.
- [ ] Rodape mostra `cache` quando o backend retornar `cacheHit: true`.
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
- [ ] `0` em pagina sem produto.

## UX

- [ ] Widget continua pequeno e discreto.
- [ ] Widget nao cobre o botao de compra nas paginas testadas.
- [ ] Texto nao promete "mesmo produto".
- [ ] Texto usa "ofertas parecidas".
- [ ] Lista limita a no maximo 5 ofertas.
- [ ] Titulo longo de produto nao quebra layout.
- [ ] Titulo longo de oferta nao quebra layout.
- [ ] Preco longo nao quebra layout.
- [ ] Link de oferta abre em nova aba.
- [ ] Botao fechar e botao minimizar sao faceis de encontrar.
- [ ] Opcao `Nao mostrar neste site` e discreta.
- [ ] Erro de backend offline nao mostra stack trace.
- [ ] Aviso de fallback mock deixa claro que a fonte real esta indisponivel.

## Encerramento da Semana 4

- [ ] README principal descreve arquitetura atual.
- [ ] README principal descreve escopo entregue por semana.
- [ ] README principal documenta variaveis de ambiente do backend.
- [ ] README principal documenta como testar mock e provider real.
- [ ] README principal lista limitacoes conhecidas.
- [ ] README do backend continua coerente com cache e providers.
- [ ] Nenhuma dependencia nova foi adicionada.
- [ ] Nenhum banco, login, historico, alerta ou publicacao foi criado.
