import rehypeStringify from 'rehype-stringify'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'
import { describe, expect, it } from 'vitest'

import { rehypePreserveCodeBlocks } from './rehype-preserve-code-blocks'

describe('rehype-preserve-code-blocks', () => {
  const process = async (markdown: string, languages: ReadonlyArray<string>) => {
    const file = await unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkRehype)
      .use(rehypePreserveCodeBlocks, languages)
      .use(rehypeStringify)
      .process(markdown)

    return String(file)
  }

  it('adds no-highlight to a fenced block in a listed language', async () => {
    const output = await process('```mermaid\nflowchart TD\n  a --> b\n```', ['mermaid'])

    // `no-highlight` comes first so rehypeHighlight's language detection (which takes the first
    // matching class name) sees it before `language-mermaid`.
    expect(output).toContain('class="no-highlight language-mermaid"')
  })

  it('leaves a fenced block in an unlisted language untouched', async () => {
    const output = await process('```json\n{}\n```', ['mermaid'])

    expect(output).not.toContain('no-highlight')
    expect(output).toContain('class="language-json"')
  })

  it('does nothing when no languages are given', async () => {
    const output = await process('```mermaid\nflowchart TD\n  a --> b\n```', [])

    expect(output).not.toContain('no-highlight')
  })

  it('is a no-op for inline code', async () => {
    const output = await process('some `inline code` here', ['mermaid'])

    expect(output).not.toContain('no-highlight')
  })
})
