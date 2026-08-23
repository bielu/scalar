import { describe, expect, it } from 'vitest'

import { renderMermaidCodeBlock } from './code-block-renderer'
import MermaidDiagram from './MermaidDiagram.vue'
import { MERMAID_CODE_BLOCK_LANGUAGE, MERMAID_EXTENSION_NAME, createMermaidPlugin } from './plugin'

describe('createMermaidPlugin', () => {
  it('registers a single x-mermaid extension', () => {
    const plugin = createMermaidPlugin()()

    expect(plugin.name).toBe('mermaid')
    expect(plugin.extensions).toEqual([{ name: MERMAID_EXTENSION_NAME, component: MermaidDiagram }])
  })

  it('registers a mermaid code block renderer', () => {
    const plugin = createMermaidPlugin()()

    expect(plugin.codeBlockRenderers).toEqual({ [MERMAID_CODE_BLOCK_LANGUAGE]: renderMermaidCodeBlock })
  })

  it('uses the x-mermaid extension name', () => {
    expect(MERMAID_EXTENSION_NAME).toBe('x-mermaid')
  })

  it('uses the mermaid code block language', () => {
    expect(MERMAID_CODE_BLOCK_LANGUAGE).toBe('mermaid')
  })
})
