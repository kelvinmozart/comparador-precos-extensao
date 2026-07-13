# Backend local do comparador

Backend simples em Node.js para desenvolvimento local. Ele recebe o produto detectado pela extensão e retorna ofertas mockadas para testar o fluxo de comparação.

## Objetivo do projeto

Fornecer uma API local mínima para a extensão consultar ofertas de um produto detectado. Nesta etapa, a resposta é mockada e serve apenas para validar a integração entre extensão, widget e backend.

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
      "confidence": 0.92
    }
  ],
  "generatedAt": "2026-07-08T00:00:00.000Z"
}
```

A resposta real retorna 5 ofertas mockadas, ordenadas do menor preço para o maior preço. O campo `generatedAt` usa a data/hora atual.

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
C:\Users\kelvi\OneDrive\Documentos\extensao
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

## Checklist manual

- [ ] Backend sobe sem erro.
- [ ] `/health` retorna `ok`.
- [ ] `/compare` retorna mock.
- [ ] Extensão carrega sem erro.
- [ ] Widget aparece em página com produto.
- [ ] Página sem produto não chama backend.
- [ ] Página com produto chama backend.
- [ ] Ofertas mockadas aparecem.
- [ ] Botão fechar funciona.
- [ ] Erro de backend offline é tratado.

## O que ainda não existe

- Scraping real.
- APIs de lojas reais.
- Banco de dados.
- Cache.
- Histórico de preço.
- Login.
- Alertas.
- Publicação na Chrome Web Store.
- Comparação real de preços.

## Próximos passos da Semana 3

- Escolher a primeira fonte real de comparação.
- Criar uma camada de provedores de preço.
- Criar score simples de similaridade.
- Começar com uma fonte controlada antes de fazer scraping amplo.

## Estrutura

```text
backend/
+-- package.json
+-- README.md
+-- src/
    +-- server.js
    +-- routes/
    |   +-- compareRoutes.js
    +-- services/
    |   +-- mockCompareService.js
    +-- utils/
        +-- normalizeProduct.js
```

## Observações honestas

- O backend não consulta lojas externas.
- As URLs das ofertas apontam para `example.com`.
- Os preços são gerados com fatores fixos a partir do preço recebido ou de um preço base.
- A similaridade é mockada.
- O objetivo atual é validar o fluxo técnico antes de integrar fontes reais.
