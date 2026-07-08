# Extensão de comparador de preços local

Extensão local para Brave/Chrome, usando Manifest V3, JavaScript puro e CSS, criada para identificar informações básicas de produto em páginas de lojas.

## Objetivo do projeto

Criar uma extensão que detecte um produto na página atual, mostre um widget flutuante com os dados encontrados e, futuramente, compare preços usando um backend próprio.

## Escopo da Semana 1

- Criar a estrutura inicial da extensão.
- Injetar um content script em páginas HTTP/HTTPS.
- Criar um widget flutuante simples no canto inferior direito.
- Detectar dados iniciais de produto a partir de JSON-LD.
- Mostrar nome e preço detectados quando a página tiver `Product` em JSON-LD.
- Preparar o fluxo para conectar com um backend em uma próxima etapa.

## O que a extensão faz agora

- Carrega em páginas `http://` e `https://`.
- Injeta um card flutuante com o título `Comparador de preços`.
- Mostra estados de `loading`, `detected`, `not_found` e `error`.
- Lê scripts `<script type="application/ld+json">`.
- Tenta encontrar objetos JSON-LD com `@type = "Product"`.
- Extrai, quando existirem, nome, imagem, preço, moeda, URL, SKU, GTIN e marca.
- Atualiza o widget com nome e preço quando um produto é detectado.
- Permite fechar o widget pelo botão `×`.
- Evita inserir o widget duas vezes na mesma página.
- Faz uma verificação básica para reexecutar a detecção quando a URL muda em sites SPA.

## O que ela ainda não faz

- Não compara preços reais.
- Não consulta outras lojas.
- Não possui backend.
- Não salva histórico de produtos.
- Não envia dados para servidor.
- Não detecta produto por scraping agressivo do HTML visível.
- Não garante suporte perfeito a todos os sites SPA.

## Estrutura de pastas

```text
extensao/
+-- manifest.json
+-- README.md
+-- src/
    +-- content.js
    +-- productDetector.js
    +-- widget.css
    +-- widget.js
```

## Como carregar no Brave

1. Abra o Brave.
2. Acesse:

```text
brave://extensions
```

3. Ative o modo desenvolvedor.
4. Clique em `Load unpacked` ou `Carregar sem compactação`.
5. Selecione a pasta do projeto:

```text
C:\Users\kelvi\OneDrive\Documentos\extensao
```

6. A extensão deverá aparecer na lista de extensões carregadas.

O mesmo fluxo também funciona no Chrome usando:

```text
chrome://extensions
```

## Como testar

1. Recarregue a extensão em `brave://extensions`.
2. Abra uma página `http://` ou `https://`.
3. Em uma página comum sem produto, verifique se o card aparece sem quebrar a página.
4. Em uma página de produto, verifique se aparece o card no canto inferior direito.
5. Se a página tiver JSON-LD com `@type = "Product"`, verifique se o widget mostra nome e preço.
6. Clique no botão `×` do widget e confirme que ele é removido da tela.

Para verificar se o widget não duplicou, abra o console da página e rode:

```js
document.querySelectorAll("#price-compare-widget").length
```

O resultado esperado é `1` enquanto o widget estiver aberto, ou `0` depois de clicar em fechar.

## Checklist manual

- [ ] Extensão carrega sem erro.
- [ ] Widget aparece no canto inferior direito.
- [ ] Widget não duplica na mesma página.
- [ ] Página sem produto não quebra.
- [ ] Produto com JSON-LD `Product` mostra nome e preço.
- [ ] Botão fechar remove o widget da tela.

## Próximos passos da Semana 2

- Criar backend simples.
- Criar endpoint `/compare`.
- Retornar dados mockados de comparação.
- Conectar a extensão com o backend.
