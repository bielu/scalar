<script setup lang="ts">
import {
  ScalarMarkdown as BaseScalarMarkdown,
  type ScalarMarkdownProps,
} from '@scalar/components/markdown'
import { computed } from 'vue'

import { usePluginManager } from '@/plugins'

const props = defineProps<ScalarMarkdownProps>()

const { getCodeBlockRenderers } = usePluginManager()

/**
 * Every plugin-registered code block renderer, wired in here so the ~20 call sites throughout the
 * reference just import this component instead of `@scalar/components/markdown` directly and get
 * plugin-rendered code blocks (e.g. Mermaid diagrams) for free — `@scalar/components` itself stays
 * plugin-agnostic (see `ScalarMarkdown.vue`'s own `codeBlockRenderers` prop).
 */
const codeBlockRenderers = computed(() => getCodeBlockRenderers())
</script>

<template>
  <BaseScalarMarkdown
    v-bind="props"
    :codeBlockRenderers="codeBlockRenderers" />
</template>
