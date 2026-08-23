import { afterEach, describe, expect, it, vi } from 'vitest'

const mermaidRender = vi.fn()
const mermaidInitialize = vi.fn()

vi.mock('mermaid', () => ({
  default: {
    initialize: mermaidInitialize,
    render: mermaidRender,
  },
}))

const { renderMermaidCodeBlock } = await import('./code-block-renderer')

describe('renderMermaidCodeBlock', () => {
  afterEach(() => {
    mermaidRender.mockReset()
    mermaidInitialize.mockReset()
    document.body.classList.remove('dark-mode', 'light-mode')
  })

  it('sets the element innerHTML to the rendered SVG on success', async () => {
    mermaidRender.mockResolvedValue({ svg: '<svg>diagram</svg>' })
    const element = document.createElement('code')

    await renderMermaidCodeBlock('flowchart TD\n  a --> b', element)

    expect(element.innerHTML).toBe('<svg>diagram</svg>')
    expect(element.classList.contains('scalar-mermaid-code-block')).toBe(true)
  })

  it('shows an error message and marks the element on failure', async () => {
    mermaidRender.mockRejectedValue(new Error('bad diagram'))
    const element = document.createElement('code')

    await renderMermaidCodeBlock('not a diagram', element)

    expect(element.textContent).toBe('Failed to render Mermaid diagram: bad diagram')
    expect(element.classList.contains('scalar-mermaid-code-block-error')).toBe(true)
  })

  it('initializes with the dark theme when the dark-mode body class is set', async () => {
    document.body.classList.add('dark-mode')
    mermaidRender.mockResolvedValue({ svg: '<svg />' })
    const element = document.createElement('code')

    await renderMermaidCodeBlock('flowchart TD', element)

    expect(mermaidInitialize).toHaveBeenCalledWith(expect.objectContaining({ theme: 'dark' }))
  })

  it('initializes with the default theme when the dark-mode body class is absent', async () => {
    mermaidRender.mockResolvedValue({ svg: '<svg />' })
    const element = document.createElement('code')

    await renderMermaidCodeBlock('flowchart TD', element)

    expect(mermaidInitialize).toHaveBeenCalledWith(expect.objectContaining({ theme: 'default' }))
  })
})
