---
'@scalar/components': minor
'@scalar/code-highlight': minor
'@scalar/types': minor
'@scalar/api-reference': patch
'@scalar/plugin-mermaid': minor
---

feat: render plugin-supplied code block renderers in Markdown descriptions

`ScalarMarkdown` accepts a new `codeBlockRenderers` prop — a map of fenced-code-block language to a
renderer function, called with the block's raw source and its `<code>` element after mount. A
matched block is left untouched by syntax highlighting and whitespace reformatting
(`htmlFromMarkdown`'s new `noHighlightLanguages` option) so its source survives intact for the
renderer to use.

`@scalar/api-reference` wires this to its plugin system: `ApiReferencePlugin` gained a
`codeBlockRenderers` field, the plugin manager merges it across registered plugins
(`getCodeBlockRenderers`), and every `ScalarMarkdown` in the reference now goes through a thin
wrapper that supplies it automatically.

`@scalar/plugin-mermaid` registers a renderer for the `mermaid` language, so a fenced
` ```mermaid ` block in any description now renders as a diagram — the same Mermaid support the
`x-mermaid` specification extension already had, now also available directly in Markdown prose.
