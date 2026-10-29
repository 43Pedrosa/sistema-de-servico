# Guia de implementação

## Direção

Uma interface de assistência técnica organizada: hierarquia tipográfica Inter, superfícies claras, separadores suaves e laranja reservado à ação principal e ao estado atual. O grid 7/5 preserva a consulta como foco.

## Mapeamento no app

- `src/index.css`: tokens públicos, temas, escala tipográfica, breakpoints e componentes.
- `src/pages/PublicSearchPage.tsx`: hero, benefícios, formulário com estado de loading e erro.
- `src/pages/PublicOrderTrackingPage.tsx`: resultado público com status, timeline, dados técnicos e orçamento.
- `src/components/PhotoGallery.tsx`: miniaturas e modal responsivo, com Escape, navegação por setas, foco contido e foco restaurado ao fechar.
- `src/components/Header.tsx` e `src/components/Footer.tsx`: marca, tema, acesso técnico e dados públicos da loja.
- O conjunto de ícones permanece Lucide, já usado pelo sistema; os ícones são componentes SVG com `aria-hidden` quando decorativos.

## Regras de layout

- Container central de até 1200 px; margens laterais de 24 px no desktop e 16 px no mobile.
- Hero com 7/5 a partir de 1024 px; empilhado em tablet e mobile.
- H1: 44 px desktop, 32 px tablet, 28 px mobile; body 16 px; helper 13 px.
- Controles com 8 px de raio e cartões com 12 px. Sombra discreta apenas em superfícies interativas ou agrupadoras.
- No tema escuro, grafite azulado em superfícies e o mesmo laranja funcional.

## Acessibilidade

- Manter `label` ligado ao campo por `htmlFor`/`id` e usar `aria-describedby` para helper ou erro.
- O formulário usa `role="search"`; mensagens dinâmicas anunciam erro com `aria-live="polite"` e mantêm o campo focado.
- Botões e miniaturas permanecem navegáveis por teclado; foco visível; modal tem `role="dialog"`, `aria-modal`, Escape para fechar e foco devolvido à miniatura.
- Respeitar `prefers-reduced-motion` e manter o contraste do texto principal e das ações.

Referências: [WCAG 2.2 — contraste mínimo](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [WAI-ARIA APG — modal dialog](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) e [Lucide React](https://lucide.dev/guide/react).

## Nota de contraste

O laranja especificado `#F37021` com texto branco não atinge 4,5:1. A ação usa texto `#111827` sobre o laranja (6,04:1); texto/ícones laranja usam a variante `#D65A16` (4,51:1 em superfície clara). O WhatsApp usa o fundo solicitado e um verde foreground `#047857` para legibilidade.
