import type { Element, Root } from 'hast'
import { visit } from 'unist-util-visit'

/**
 * Marks fenced code blocks of the given languages as `no-highlight`, before `rehypeHighlight`
 * runs.
 *
 * Two things fall out of the `no-highlight` class:
 * - `rehypeHighlight` (see its own `language()` helper) bails out immediately for a `no-highlight`
 *   code block, leaving its children — the raw source text — completely untouched, rather than
 *   attempting (and failing) to syntax-highlight a language it doesn't know.
 * - `rehypeFormat`, which runs later in the pipeline, only preserves whitespace verbatim inside
 *   elements it recognizes as pre-formatted; a plain `language-xxx` code block it doesn't
 *   highlight can still have its whitespace collapsed. `no-highlight` avoids that, which matters
 *   for a language like Mermaid where newlines are syntactically significant.
 *
 * Used to keep a code block's source intact for a consumer that renders it after mount (see
 * `ScalarMarkdown`'s `codeBlockRenderers` prop) — this plugin only marks the block, it does not
 * render anything itself.
 */
export function rehypePreserveCodeBlocks(languages: ReadonlyArray<string> = []) {
  return (tree: Root) => {
    if (languages.length === 0) {
      return
    }

    visit(tree, 'element', (node: Element, _index, parent) => {
      if (node.tagName !== 'code' || !parent || parent.type !== 'element' || parent.tagName !== 'pre') {
        return
      }

      const className = node.properties.className
      const classNames = Array.isArray(className) ? className.map(String) : []
      const language = classNames.find((name) => name.startsWith('language-'))?.slice('language-'.length)

      if (!language || !languages.includes(language)) {
        return
      }

      if (!classNames.includes('no-highlight')) {
        // `rehypeHighlight`'s own language detection takes the *first* matching class name it
        // finds — unshift, not push, so `no-highlight` is checked before `language-<name>`.
        classNames.unshift('no-highlight')
      }

      node.properties.className = classNames
    })
  }
}
