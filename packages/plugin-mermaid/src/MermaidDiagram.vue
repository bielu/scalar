<script setup lang="ts">
import { useColorMode } from '@scalar/use-hooks/useColorMode'
import { onMounted, ref, watch } from 'vue'

import {
  nextMermaidElementId,
  renderMermaidToSvg,
} from './helpers/render-mermaid'

const props = defineProps<{
  /**
   * The `x-mermaid` extension value: raw Mermaid diagram source. `SpecificationExtension` binds
   * the raw `x-mermaid` key via `v-bind`, which Vue's runtime prop resolution camelizes before
   * matching — the prop must be declared (and read) in its camelCase form to receive it.
   */
  xMermaid?: unknown
}>()

const { isDarkMode } = useColorMode()

const elementId = nextMermaidElementId()
const svg = ref<string>('')
const error = ref<string>('')

const render = async () => {
  const source = typeof props.xMermaid === 'string' ? props.xMermaid : ''
  if (!source.trim()) {
    svg.value = ''
    error.value = ''
    return
  }

  const result = await renderMermaidToSvg(
    source,
    elementId,
    isDarkMode.value ? 'dark' : 'default',
  )
  svg.value = result.svg ?? ''
  error.value = result.error ?? ''
}

onMounted(render)
watch(() => props.xMermaid, render)
watch(isDarkMode, render)
</script>

<template>
  <div
    v-if="svg"
    class="scalar-mermaid-diagram"
    v-html="svg" />
  <div
    v-else-if="error"
    class="scalar-mermaid-diagram-error">
    Failed to render Mermaid diagram: {{ error }}
  </div>
</template>

<style scoped>
.scalar-mermaid-diagram {
  margin: 16px 0;
  overflow-x: auto;
}
.scalar-mermaid-diagram :deep(svg) {
  max-width: 100%;
  height: auto;
}
.scalar-mermaid-diagram-error {
  margin: 16px 0;
  padding: 8px 12px;
  border-radius: var(--scalar-radius, 4px);
  border: 1px solid var(--scalar-border-color, #e5e5e5);
  color: var(--scalar-color-2, #666);
  font-size: 0.875em;
}
</style>
