import type { ApiReferencePlugin } from '@scalar/types/api-reference'

import { renderMermaidCodeBlock } from './code-block-renderer'
import MermaidDiagram from './MermaidDiagram.vue'

/** The specification extension name this plugin renders. Works on any object — `info`, a tag, an operation, an Arazzo workflow or step, … — wherever the surrounding UI passes its extensions through `SpecificationExtension`. */
export const MERMAID_EXTENSION_NAME = 'x-mermaid'

/** The fenced code block language this plugin renders in Markdown descriptions. */
export const MERMAID_CODE_BLOCK_LANGUAGE = 'mermaid'

/**
 * Renders Mermaid diagrams two ways: `x-mermaid` specification extensions (on any object — `info`,
 * a tag, an operation, an Arazzo workflow or step, …), and ` ```mermaid ` fenced code blocks inside
 * Markdown descriptions. Neither runs, and `mermaid` is never fetched, unless a document actually
 * uses one of the two and the surrounding UI renders it — a consumer who never registers this
 * plugin, or a document that never uses either, pays nothing.
 *
 * @example
 * ```ts
 * import { createMermaidPlugin } from '@scalar/plugin-mermaid'
 *
 * createApiReference('#app', {
 *   url: '/openapi.json',
 *   plugins: [createMermaidPlugin()],
 * })
 * ```
 *
 * As a specification extension, on any object:
 * ```yaml
 * paths:
 *   /orders:
 *     post:
 *       x-mermaid: |
 *         sequenceDiagram
 *           Client->>API: POST /orders
 *           API->>Client: 201 Created
 * ```
 *
 * Or as a fenced code block inside a `description`:
 * ```yaml
 * paths:
 *   /orders:
 *     post:
 *       description: |
 *         ```mermaid
 *         sequenceDiagram
 *           Client->>API: POST /orders
 *           API->>Client: 201 Created
 *         ```
 * ```
 */
export const createMermaidPlugin = (): ApiReferencePlugin => {
  return () => ({
    name: 'mermaid',
    extensions: [{ name: MERMAID_EXTENSION_NAME, component: MermaidDiagram }],
    codeBlockRenderers: { [MERMAID_CODE_BLOCK_LANGUAGE]: renderMermaidCodeBlock },
  })
}
