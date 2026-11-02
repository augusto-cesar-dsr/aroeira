# Mural de Imóveis — Residencial Flora Park Aroeira

Site responsivo que simula um mural de cortiça físico, com anúncios de imóveis
à venda e para locação carregados em tempo real de uma planilha pública do
Google Sheets.

## Arquivos

```
index.html            Estrutura e conteúdo estático
style.css             Design system, layout, animações e responsividade
script.js             Integração com a planilha, CSV parser e renderização
planilha-exemplo.csv  Modelo de planilha para importar no Google Sheets
```

## Como abrir

Basta abrir `index.html` no navegador. Para evitar bloqueios de CORS em alguns
navegadores, prefira servir a pasta localmente:

```bash
python3 -m http.server 8000
# acesse http://localhost:8000
```

Enquanto nenhuma planilha estiver configurada, o mural exibe **dados de
demonstração** e um aviso indicando o modo de exemplo.

## Conectar a planilha do Google

### 1. Monte a planilha

Na primeira linha da aba, use os cabeçalhos:

| status | unidade | contato |
| --- | --- | --- |
| VENDE-SE | Quadra 4, Lote 12 | (62) 99999-1010 |
| ALUGA-SE | Quadra 2, Lote 8 | (62) 98888-2020 |

- `status`: aceita `VENDE-SE`, `VENDA`, `ALUGA-SE`, `ALUGUEL`, `LOCAÇÃO` etc.
  Status não reconhecidos aparecem em cinza com o texto original.
- `unidade`: texto livre (ex.: `Quadra 4, Lote 12`).
- `contato`: telefone/WhatsApp ou e-mail. Telefones ganham link automático
  para o WhatsApp; e-mails viram `mailto:`.
- Colunas extras são ignoradas. Também é possível usar colunas separadas
  `quadra` e `lote` no lugar de `unidade`.
- Linhas sem `unidade` são ignoradas.

### 2. Publique a planilha

1. No Google Sheets: **Arquivo → Compartilhar → Publicar na web**.
2. Escolha a aba correta e o formato **CSV**.
3. Copie o link gerado.

### 3. Configure o site

Abra `script.js` e preencha **uma** das opções:

```js
const CONFIG = {
  // Opção A — link CSV publicado
  csvUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX.../pub?output=csv',

  // Opção B — ID da planilha + nome da aba
  sheetId: '1AbC...',
  sheetName: '', // vazio = primeira aba; ou informe 'Mural'
  ...
};
```

O link normal de edição (`.../spreadsheets/d/ID/edit#gid=0`) também funciona,
desde que a planilha esteja acessível publicamente. O código converte para o
endpoint CSV automaticamente.

### 4. Ajustes opcionais

```js
demoFallback: true,     // false = mostra tela de erro se a planilha falhar
refreshMinutes: 5,      // atualização automática; 0 desativa
timeoutMs: 12000,       // tempo máximo de espera pela planilha
```

## Personalização visual

As cores ficam em `:root`, no início de `style.css`:

```css
--green-800: #1e4d3b;   /* cabeçalho VENDE-SE */
--terracotta: #d9822b;  /* cabeçalho ALUGA-SE */
--cream: #fdfbf7;       /* corpo dos cards */
--board: #f4ebd0;       /* painel claro do cabeçalho */
--cork: #b7a28f;        /* painel de cortiça atrás dos cards */
--wood: #b89772;        /* moldura e faixas de madeira */
--footer-bg: #faf6e9;   /* barra do rodapé */
--footer-ink: #24543c;  /* texto do rodapé */
```

Se preferir um painel de fundo mais claro, troque `--cork` e `--cork-light`
por `#f4ebd0` e `#f7efd8`; o restante do layout continua igual.

Para trocar o logotipo, substitua o SVG dentro de `.brand__mark` em
`index.html` por uma imagem:

```html
<img src="logo.png" alt="Residencial Flora Park Aroeira">
```

## Recursos incluídos

- Layout em Grid/Flexbox com 4, 3, 2 ou 1 coluna conforme a largura.
- 12 anúncios de demonstração (6 vende-se / 6 aluga-se) em 3 linhas × 4
  colunas, alternando as cores como na referência visual.
- Cards com tachinha, cantos retos e efeito de elevação no hover.
- Filtros por tipo de anúncio e contador de resultados.
- Estados de carregamento (skeleton), erro e modo demonstração.
- Atualização automática periódica e link direto para WhatsApp.
- Acessibilidade: navegação por teclado, `aria-live`, foco visível e
  respeito a `prefers-reduced-motion`.
- Estilos de impressão para gerar uma versão em papel do mural.

## Solução de problemas

| Problema | Causa provável / solução |
| --- | --- |
| Aviso de demonstração | `CONFIG.csvUrl` e `CONFIG.sheetId` estão vazios ou a planilha não está pública. |
| “Retornou HTML em vez de CSV” | Use o link **Publicar na web → CSV**, não o link de edição. |
| Nenhum anúncio válido | Confira os cabeçalhos e se a coluna `unidade` está preenchida. |
| Erro de CORS/rede | Publique a planilha como CSV e sirva o site por HTTP. |
| Números sem link | O contato precisa ter 10 a 13 dígitos (DDD + número). |
# aroeira
