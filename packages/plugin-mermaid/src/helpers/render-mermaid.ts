type RenderMermaidResult = { svg: string; error?: undefined } | { svg?: undefined; error: string }

let counter = 0

/** A fresh, stable id for each render — `mermaid.render()` requires one per call. */
export const nextMermaidElementId = (): string => `mermaid-${counter++}`

/**
 * Renders Mermaid diagram source to an SVG string. `mermaid` is dynamically imported here, not at
 * module scope, so it is only ever fetched/parsed by a caller that actually needs to render —
 * shared by both the `x-mermaid` extension component and the Markdown code-block renderer.
 */
export const renderMermaidToSvg = async (
  source: string,
  elementId: string,
  theme: 'dark' | 'default',
): Promise<RenderMermaidResult> => {
  try {
    const { default: mermaid } = await import('mermaid')
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme,
    })
    const result = await mermaid.render(elementId, source)
    return { svg: result.svg }
  } catch (cause) {
    return { error: cause instanceof Error ? cause.message : 'Failed to render Mermaid diagram.' }
  }
}
