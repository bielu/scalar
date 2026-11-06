<script setup lang="ts">
import type { ApiReferenceConfigurationRaw } from '@scalar/types/api-reference'
import type { ArazzoDocument } from '@scalar/types/arazzo/1.1'
import type { WorkspaceEventBus } from '@scalar/workspace-store/events'
import type {
  TraversedArazzoWorkflow,
  TraversedEntry,
} from '@scalar/workspace-store/schemas/navigation'
import type { WorkspaceDocument } from '@scalar/workspace-store/schemas/workspace'

import Lazy from '@/components/Lazy/Lazy.vue'

import Workflow from './Workflow.vue'

const {
  entries,
  document,
  documents,
  expandedItems,
  options,
  eventBus,
  level = 0,
} = defineProps<{
  entries: TraversedEntry[]
  document: ArazzoDocument
  /** Every document loaded in the workspace, so a step can resolve what it targets in a sibling document. */
  documents: Record<string, WorkspaceDocument>
  expandedItems: Record<string, boolean>
  options: Pick<
    ApiReferenceConfigurationRaw,
    | 'layout'
    | 'expandAllSchemaProperties'
    | 'orderRequiredPropertiesFirst'
    | 'orderSchemaPropertiesBy'
  >
  eventBus: WorkspaceEventBus
  level?: number
}>()

const isWorkflow = (entry: TraversedEntry): entry is TraversedArazzoWorkflow =>
  entry.type === 'arazzo-workflow'
</script>

<template>
  <Lazy
    v-for="entry in entries"
    :id="entry.id"
    :key="`${entry.id}-${options.layout}`"
    :expanded="!!expandedItems[entry.id]">
    <Workflow
      v-if="isWorkflow(entry)"
      :document="document"
      :documents="documents"
      :eventBus="eventBus"
      :expandedItems="expandedItems"
      :isCollapsed="!expandedItems[entry.id]"
      :layout="options.layout"
      :level="level"
      :options="options"
      :workflow="entry" />
  </Lazy>
</template>
