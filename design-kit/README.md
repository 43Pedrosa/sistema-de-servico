# Store Acessórios — Design kit

Este pacote documenta a interface pública de consulta e os componentes usados nas telas de acompanhamento. A implementação React continua no projeto; os mockups de consulta e resultado são as telas reais do app em `/consultar` e `/consultar/:osNumber`.

## Arquivos

- `tokens.css`: tokens claros conforme o briefing e seus equivalentes para o tema escuro.
- `components.css`: classes portáveis para container, hero, card, input, botão e modal.
- `implementation-guide.md`: mapa dos componentes, regras responsivas e checklist de acessibilidade.
- `mockups/viewports.md`: rotas e tamanhos usados para conferir os mockups renderizados.

## Telas

- Consulta pública: `http://localhost:3000/consultar`
- Resultado e galeria: `http://localhost:3000/consultar/:osNumber`
- Modal de fotos: abrir uma foto dentro da tela de resultado; Escape fecha e devolve o foco à miniatura.

O mockup de resultado foi revisado com o registro local de preview `1687`; esse registro não foi confirmado como uma OS real de produção. Não incluí números inventados nem restaurei a lista de demonstração na página de consulta.
