# Mockups renderizados

Os mockups são as próprias telas React para manter navegação, estados e conteúdo alinhados ao produto.

| Tela | Desktop | Tablet | Mobile |
|---|---:|---:|---:|
| Consulta | 1440 × 960 | 769 × 960 | 374 × 844 |
| Resultado da OS | 1440 × 960 | — | 376 × 844 |
| Modal da galeria | incluído no resultado | responsivo | incluído no resultado (376 × 844) |

Rotas locais: `/consultar` e `/consultar/:osNumber`. O modal abre ao selecionar uma miniatura. A tela de resultado foi conferida com o registro de preview local existente `1687`, que não foi validado como uma ordem de produção real. Nenhum número novo foi inventado e a página pública não exibe uma lista de exemplos.

O navegador de validação aplica escala ao viewport: os alvos de 768 px e 375 px ficaram em 767/769 px e 374/376 px CSS. Ambos os lados do breakpoint de tablet foram conferidos para confirmar a troca de composição e o mobile foi verificado sem overflow horizontal.
