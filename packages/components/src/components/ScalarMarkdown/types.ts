import type { Node } from '@scalar/code-highlight'

/**
 * Renders a fenced code block's source into the given element after the surrounding markdown has
 * mounted. Declared generically here (not tied to any particular plugin system) — a consumer
 * derives this map however it likes and passes it down.
 */
export type CodeBlockRenderer = (source: string, element: HTMLElement) => void | Promise<void>

export type ScalarMarkdownProps = {
  /**
   * The markdown content to render.
   */
  value?: string
  /**
   * Whether to render images.
   *
   * @default false
   */
  withImages?: boolean
  /**
   * Whether to add anchors to the headings.
   *
   * @default false
   */
  withAnchors?: boolean
  /**
   * A function to transform the Markdown content.
   *
   * @see https://github.com/remarkjs/remark-rehype
   */
  transform?: (node: Node) => Node
  /**
   * The type of transform to apply.
   *
   * @see https://github.com/remarkjs/remark-rehype
   */
  transformType?: string
  /**
   * The number of lines to truncate the content to.
   */
  clamp?: number
  /**
   * Whether to add anchors to the headings.
   */
  anchorPrefix?: string
  /**
   * Renderers for fenced code blocks, keyed by language (the fence info string, e.g. `mermaid`
   * for ` ```mermaid `). A matched block's source is left untouched by syntax highlighting and
   * whitespace reformatting, and its renderer is called with the raw source and the `<code>`
   * element to render into, once after mount and again whenever `value` changes.
   */
  codeBlockRenderers?: Record<string, CodeBlockRenderer>
}

export type ScalarMarkdownSummaryProps = ScalarMarkdownProps & {
  /**
   * Allows the summary's open and closed state to
   * be controlled by the parent component and hides
   * the "More" and "Less" buttons.
   *
   * @default false
   */
  controlled?: boolean
}
