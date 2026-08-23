import { nextMermaidElementId, renderMermaidToSvg } from './helpers/render-mermaid'

/**
 * Reads the current color mode without `useColorMode()` — this renderer is called imperatively
 * from `ScalarMarkdown`'s post-mount DOM walk, outside any component's `setup()`, so composables
 * relying on `onMounted`/`onUnmounted` (as `useColorMode` does, to track OS theme changes) aren't
 * safe to call here. `useColorMode` itself sets this body class on every color-mode change, so
 * reading it directly gives the same answer without registering a watcher this call site could
 * never clean up.
 *
 * Trade-off: unlike the `x-mermaid` extension component, a diagram rendered by this function does
 * not live-update if the user toggles color mode afterwards — it reflects whatever the mode was
 * at render time.
 */
const currentTheme = (): 'dark' | 'default' =>
  typeof document !== 'undefined' && document.body.classList.contains('dark-mode') ? 'dark' : 'default'

/**
 * Renders a ` ```mermaid ` fenced code block's source into its `<code>` element — the shape
 * `ScalarMarkdown`'s `codeBlockRenderers` prop expects. Register it under the `mermaid` language
 * key (see `createMermaidPlugin`) to get diagrams from Markdown descriptions, not just from the
 * `x-mermaid` specification extension.
 */
export const renderMermaidCodeBlock = async (source: string, element: HTMLElement): Promise<void> => {
  const result = await renderMermaidToSvg(source, nextMermaidElementId(), currentTheme())

  if (result.svg) {
    element.innerHTML = result.svg
    element.classList.add('scalar-mermaid-code-block')
    element.style.display = 'block'
    element.style.overflowX = 'auto'
  } else {
    element.textContent = `Failed to render Mermaid diagram: ${result.error}`
    element.classList.add('scalar-mermaid-code-block-error')
  }
}
