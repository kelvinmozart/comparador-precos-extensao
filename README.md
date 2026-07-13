# Extensão de comparador de preços local

Extensão local para Brave/Chrome, usando Manifest V3, JavaScript puro e CSS. O projeto detecta informações básicas de produto em páginas de lojas e conversa com um backend local para exibir ofertas mockadas.

## Objetivo do projeto

Criar uma extensão capaz de detectar um produto na página atual, mostrar um widget compacto com o produto encontrado e consultar um backend próprio para comparar ofertas.

Neste momento, a comparação ainda é mockada. O projeto não busca preços reais em lojas.

## O que foi feito na Semana 1

- Criada a estrutura inicial da extensão.
- Configurado `manifest.json` com content scripts para páginas `http://` e `https://`.
- Criado um widget flutuante no canto inferior direito.
- Criado detector inicial de produto baseado em JSON-LD.
- Implementada leitura de scripts `<script type="application/ld+json">`.
- Implementada busca por objetos JSON-LD com `@type = "Product"`.
- Extraídos dados básicos quando disponíveis: nome, preço, moeda, imagem, URL, SKU, GTIN e marca.
- Adicionada proteção para evitar duplicação do widget.
- Adicionada reexecução simples da detecção quando a URL muda em sites SPA.

## O que foi feito na Semana 2

- Criado backend local em Node.js dentro da pasta `backend`.
- Criado endpoint `GET /health`.
- Criado endpoint `POST /compare`.
- Criado serviço mockado que retorna 5 ofertas para o produto recebido.
- Criada normalização básica de produto no backend.
- Criado cliente da API na extensão em `src/apiClient.js`.
- Criado utilitário de formatação/normalização na extensão em `src/formatters.js`.
- Conectada a extensão ao backend local em `http://localhost:3000`.
- Adicionada permissão mínima em `manifest.json` para acessar `http://localhost:3000/*`.
- Atualizado o widget para mostrar produto atual, preço atual e lista de ofertas mockadas.
- Adicionados estados de carregamento, busca de ofertas, ofertas encontradas e erro amigável.
- Adicionado botão de fechar e botão simples de minimizar/expandir.
- Ajustado o fluxo para não mostrar o widget e não chamar o backend quando nenhum produto for detectado.

## Como rodar o backend local

Entre na pasta do backend:

```powershell
cd backend
```

Instale as dependências:

```powershell
npm install
```

Inicie o servidor:

```powershell
npm start
```

Por padrão, o backend sobe em:

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

## Como carregar a extensão no Brave

1. Abra o Brave.
2. Acesse:

```text
brave://extensions
```

3. Ative o modo desenvolvedor.
4. Clique em `Load unpacked` ou `Carregar sem compactação`.
5. Selecione a pasta da extensão:

```text
C:\Users\kelvi\OneDrive\Documentos\extensao
```

6. A extensão deverá aparecer na lista de extensões carregadas.

O mesmo fluxo também funciona no Chrome usando:

```text
chrome://extensions
```

## Como testar o fluxo completo

1. Suba o backend local em `http://localhost:3000`:

```powershell
cd backend
npm start
```

2. Recarregue a extensão em `brave://extensions`.
3. Abra uma página de produto que tenha JSON-LD com `@type = "Product"`.
4. Verifique se o widget aparece no canto inferior direito.
5. Verifique se o produto detectado aparece no widget.
6. Verifique se o preço atual aparece quando a página informar preço.
7. Verifique se a extensão chama o backend e mostra ofertas mockadas.
8. Clique em `Ver oferta` e confirme que o link abre em nova aba.
9. Clique no botão de minimizar/expandir e confirme que o corpo do widget abre e fecha.
10. Clique no botão `×` e confirme que o widget some.
11. Abra uma página comum sem produto e confirme que o widget não aparece.
12. Desligue o backend com `Ctrl+C`.
13. Recarregue uma página de produto e confirme a mensagem amigável:

```text
Não foi possível buscar ofertas agora.
```

Para verificar se o widget não duplicou, abra o console da página e rode:

```js
document.querySelectorAll("#price-compare-widget").length
```

Resultado esperado:

- `1` quando o widget estiver aberto em uma página de produto.
- `0` depois de clicar em fechar.
- `0` em páginas sem produto detectado.

## Checklist manual

- [ ] Backend sobe sem erro.
- [ ] `GET /health` retorna `ok`.
- [ ] `POST /compare` retorna ofertas mockadas.
- [ ] Extensão carrega sem erro no Brave.
- [ ] Widget aparece em página com produto detectado.
- [ ] Página sem produto não chama o backend.
- [ ] Página sem produto não mostra o widget.
- [ ] Página com produto chama o backend.
- [ ] Produto detectado aparece no widget.
- [ ] Preço atual aparece quando disponível.
- [ ] Ofertas mockadas aparecem no widget.
- [ ] Botão minimizar/expandir funciona.
- [ ] Botão fechar funciona.
- [ ] Erro de backend offline é tratado com mensagem amigável.

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
- Garantia de suporte perfeito a todos os sites SPA.

## Próximos passos da Semana 3

- Escolher a primeira fonte real de comparação.
- Criar uma camada de provedores de preço.
- Criar um score simples de similaridade.
- Começar com uma fonte controlada antes de fazer scraping amplo.

## Estrutura de pastas

```text
extensao/
+-- manifest.json
+-- README.md
+-- src/
|   +-- apiClient.js
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
        +-- routes/
        |   +-- compareRoutes.js
        +-- services/
        |   +-- mockCompareService.js
        +-- utils/
            +-- normalizeProduct.js
```
