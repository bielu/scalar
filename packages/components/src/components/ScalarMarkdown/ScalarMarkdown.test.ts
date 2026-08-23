import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import ScalarMarkdown from './ScalarMarkdown.vue'

describe('ScalarMarkdown', () => {
  it('renders properly with basic markdown', () => {
    const wrapper = mount(ScalarMarkdown, {
      props: {
        value:
          '# Scalar Galaxy\n\nThe Scalar Galaxy is an example OpenAPI specification to test OpenAPI tools and libraries.',
      },
    })

    expect(wrapper.find('h1').exists()).toBe(true)
    expect(wrapper.find('h1').text()).toBe('Scalar Galaxy')
    expect(wrapper.find('p').exists()).toBe(true)
    expect(wrapper.find('p').text()).toBe(
      'The Scalar Galaxy is an example OpenAPI specification to test OpenAPI tools and libraries.',
    )
  })

  it('applies custom class', () => {
    const wrapper = mount(ScalarMarkdown, {
      props: {
        value: '# Get all planets',
        class: 'operation-description',
      },
    })

    expect(wrapper.find('div').classes()).toContain('operation-description')
  })

  describe('withAnchors functionality', () => {
    it('does not add anchors when withAnchors is false', () => {
      const wrapper = mount(ScalarMarkdown, {
        props: {
          value: "# Physical Properties\n\nDetailed information about the planet's physical characteristics.",
          withAnchors: false,
        },
      })

      const heading = wrapper.find('h1')
      expect(heading.exists()).toBe(true)
      expect(heading.attributes('id')).toBeUndefined()
    })

    it('adds anchors when withAnchors is true', () => {
      const wrapper = mount(ScalarMarkdown, {
        props: {
          value: "# Physical Properties\n\nDetailed information about the planet's physical characteristics.",
          withAnchors: true,
          transformType: 'heading',
        },
      })

      const heading = wrapper.find('h1')
      expect(heading.exists()).toBe(true)
      expect(heading.attributes('id')).toBe('physical-properties')
    })

    it('adds anchors with prefix when anchorPrefix is provided', () => {
      const wrapper = mount(ScalarMarkdown, {
        props: {
          value: '# Atmosphere Composition\n\nInformation about the atmospheric gases.',
          withAnchors: true,
          anchorPrefix: 'tag/planets/PUT/planets/{planetId}',
          transformType: 'heading',
        },
      })

      const heading = wrapper.find('h1')
      expect(heading.exists()).toBe(true)
      expect(heading.attributes('id')).toBe('tag/planets/PUT/planets/{planetId}/description/atmosphere-composition')
    })

    it('handles multiple headings with anchors', () => {
      const wrapper = mount(ScalarMarkdown, {
        props: {
          value:
            "# Planet Details\n\n## Physical Properties\n\n### Temperature Range\n\nThe planet's temperature varies significantly.",
          withAnchors: true,
          transformType: 'heading',
        },
      })

      const h1 = wrapper.find('h1')
      const h2 = wrapper.find('h2')
      const h3 = wrapper.find('h3')

      expect(h1.attributes('id')).toBe('planet-details')
      expect(h2.attributes('id')).toBe('physical-properties')
      expect(h3.attributes('id')).toBe('temperature-range')
    })

    it('handles headings with special characters in slug generation', () => {
      const wrapper = mount(ScalarMarkdown, {
        props: {
          value: '# Planet HD 40307g & Its Moons!\n\nA super-earth exoplanet.',
          withAnchors: true,
          transformType: 'heading',
        },
      })

      const heading = wrapper.find('h1')
      expect(heading.attributes('id')).toBe('planet-hd-40307g-&-its-moons!')
    })
  })

  it('includes images when withImages is true', () => {
    const wrapper = mount(ScalarMarkdown, {
      props: {
        value:
          '![Jupiter with Great Red Spot](https://cdn.scalar.com/photos/jupiter.jpg)\n\nA gas giant with a distinctive storm.',
        withImages: true,
      },
    })

    expect(wrapper.find('img').exists()).toBe(true)
    expect(wrapper.find('img').attributes('alt')).toBe('Jupiter with Great Red Spot')
    expect(wrapper.find('img').attributes('src')).toBe('https://cdn.scalar.com/photos/jupiter.jpg')
  })

  describe('codeBlockRenderers', () => {
    it('calls the matching renderer with the block source and element', () => {
      const calls: Array<{ source: string; tagName: string }> = []

      mount(ScalarMarkdown, {
        props: {
          value: '```mermaid\nflowchart TD\n  a --> b\n```',
          codeBlockRenderers: {
            mermaid: (source, element) => {
              calls.push({ source, tagName: element.tagName })
            },
          },
        },
      })

      expect(calls).toEqual([{ source: 'flowchart TD\n  a --> b', tagName: 'CODE' }])
    })

    it('does not call a renderer for a non-matching language', () => {
      const renderer = vi.fn()

      mount(ScalarMarkdown, {
        props: {
          value: '```json\n{}\n```',
          codeBlockRenderers: { mermaid: renderer },
        },
      })

      expect(renderer).not.toHaveBeenCalled()
    })

    it('leaves the code block as a plain, unrendered element when no renderer is registered', () => {
      const wrapper = mount(ScalarMarkdown, {
        props: {
          value: '```mermaid\nflowchart TD\n  a --> b\n```',
        },
      })

      expect(wrapper.find('code').text()).toContain('flowchart TD')
    })

    it('re-renders when value changes', async () => {
      const renderer = vi.fn()

      const wrapper = mount(ScalarMarkdown, {
        props: {
          value: '```mermaid\nflowchart TD\n  a --> b\n```',
          codeBlockRenderers: { mermaid: renderer },
        },
      })

      expect(renderer).toHaveBeenCalledTimes(1)

      await wrapper.setProps({ value: '```mermaid\nflowchart TD\n  a --> c\n```' })

      expect(renderer).toHaveBeenCalledTimes(2)
      expect(renderer).toHaveBeenLastCalledWith('flowchart TD\n  a --> c', expect.any(HTMLElement))
    })
  })

  it('parses inline markdown in HTML paragraphs', () => {
    const wrapper = mount(ScalarMarkdown, {
      props: {
        value: '<p>`Foobar`</p>',
      },
    })

    expect(wrapper.find('p').exists()).toBe(true)
    expect(wrapper.find('code').exists()).toBe(true)
    expect(wrapper.find('code').text()).toBe('Foobar')
  })
})
