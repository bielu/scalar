<script setup lang="ts">
import { ScalarIconButton } from '@scalar/components/icon-button'
import { ScalarMarkdown } from '@scalar/components/markdown'
import { ScalarModal, useModal } from '@scalar/components/modal'
import { ScalarIconArrowsIn, ScalarIconCornersOut } from '@scalar/icons'
import type { ArazzoDocument } from '@scalar/types/arazzo/1.1'
import type { WorkspaceEventBus } from '@scalar/workspace-store/events'
import type {
  TraversedArazzoStep,
  TraversedArazzoWorkflow,
} from '@scalar/workspace-store/schemas/navigation'
import type { SchemaObject } from '@scalar/workspace-store/schemas/v3.1/strict/openapi-document'
import type { WorkspaceDocument } from '@scalar/workspace-store/schemas/workspace'
import { computed, ref, useId } from 'vue'

import { Anchor } from '@/components/Anchor'
import { Badge } from '@/components/Badge'
import {
  resolveSchemaRenderOptions,
  type AsyncApiSchemaRenderOptions,
} from '@/components/Content/AsyncApi/helpers/async-api-render-options'
import { filterChildrenByType } from '@/components/Content/AsyncApi/helpers/filter-children-by-type'
import { pickHeading } from '@/components/Content/AsyncApi/helpers/pick-heading'
import { Schema } from '@/components/Content/Schema'
import type { SchemaOptions } from '@/components/Content/Schema/types'
import {
  Section,
  SectionContainer,
  SectionContainerAccordion,
  SectionContent,
  SectionHeader,
  SectionHeaderTag,
} from '@/components/Section'
import SpecificationExtension from '@/features/specification-extension/SpecificationExtension.vue'

import { buildWorkflowMermaidDiagram } from './helpers/build-workflow-diagram'
import { resolveArazzoWorkflow } from './helpers/resolve-arazzo-nodes'
import Step from './Step.vue'

const {
  workflow,
  document,
  documents,
  layout,
  isCollapsed,
  eventBus,
  options,
  expandedItems = {},
  level = 0,
} = defineProps<{
  workflow: TraversedArazzoWorkflow
  document: ArazzoDocument
  documents: Record<string, WorkspaceDocument>
  layout: 'classic' | 'modern'
  isCollapsed: boolean
  eventBus: WorkspaceEventBus | null
  options?: Partial<AsyncApiSchemaRenderOptions>
  expandedItems?: Record<string, boolean>
  /** Nesting depth, matching `Channel.vue`'s own use — skips the section's own padding when nested. */
  level?: number
}>()

const headerId = useId()

/** Resolve the workflow from the document so we can read its description/inputs. */
const resolvedWorkflow = computed(() =>
  resolveArazzoWorkflow(document, workflow.workflowId),
)

const description = computed(() => resolvedWorkflow.value?.description ?? '')

const headingText = computed(() =>
  pickHeading(workflow.title, workflow.workflowId),
)

/**
 * A JSON Schema 2020-12 object describing the workflow's inputs, when declared. Arazzo types
 * `inputs` as `unknown` (it's schema-shaped by spec, not a typed reference into the Arazzo schema
 * itself), so this is cast to what `<Schema>` actually expects.
 */
const inputsSchema = computed(
  () => resolvedWorkflow.value?.inputs as SchemaObject | undefined,
)

const schemaOptions = computed<SchemaOptions>(() => ({
  hideReadOnly: false,
  ...resolveSchemaRenderOptions(options),
}))

/** Steps in this workflow, in document order — see `traverse-arazzo-document.ts` for why they are never re-sorted. */
const steps = computed(() =>
  filterChildrenByType<TraversedArazzoStep>(workflow.children, 'arazzo-step'),
)

/**
 * A Mermaid flowchart of this workflow's steps, exposed as a synthetic `x-mermaid` value so it
 * renders through the existing plugin-extension mechanism (`SpecificationExtension`) — nothing
 * renders unless a consumer registers `@scalar/plugin-mermaid` (or their own `x-mermaid` renderer);
 * without one, `SpecificationExtension` finds no matching component and renders nothing.
 */
const diagramExtension = computed(() => ({
  'x-mermaid': buildWorkflowMermaidDiagram(resolvedWorkflow.value),
}))

const diagramModal = useModal()

/**
 * Bumped to force the modal's diagram to remount, which resets its pan/zoom back to default —
 * `MermaidDiagram` lives behind the generic `x-mermaid` plugin extension, so there's no direct ref
 * to call a reset method on from here; remounting is the simplest way to reach through that boundary.
 */
const diagramResetKey = ref(0)
</script>

<template>
  <SectionContainerAccordion
    v-if="layout === 'classic'"
    class="workflow-section"
    :modelValue="!isCollapsed"
    @update:modelValue="
      (value) =>
        eventBus?.emit('toggle:nav-item', { id: workflow.id, open: value })
    ">
    <template #title>
      <SectionHeader class="workflow-name">
        <Anchor
          @copyAnchorUrl="
            () => eventBus?.emit('copy-url:nav-item', { id: workflow.id })
          ">
          <SectionHeaderTag :level="2">
            {{ headingText }}
          </SectionHeaderTag>
        </Anchor>
      </SectionHeader>
      <div
        v-if="workflow.dependsOn?.length"
        class="workflow-depends-on">
        <Badge
          v-for="dependsOnId in workflow.dependsOn"
          :key="dependsOnId">
          Depends on: {{ dependsOnId }}
        </Badge>
      </div>
      <ScalarMarkdown
        class="workflow-description"
        :value="description"
        withImages />
    </template>
    <div class="workflow-content">
      <div class="workflow-main">
        <Schema
          v-if="inputsSchema"
          compact
          :eventBus="eventBus"
          name="Inputs"
          noncollapsible
          :options="schemaOptions"
          :schema="inputsSchema" />
        <Step
          v-for="step in steps"
          :key="step.id"
          :document="document"
          :documents="documents"
          :eventBus="eventBus"
          :expandedItems="expandedItems"
          :options="options"
          :step="step" />
      </div>
      <aside
        v-if="steps.length"
        class="workflow-diagram">
        <div class="workflow-diagram-panel">
          <div class="workflow-diagram-header">
            <div class="workflow-diagram-title">Workflow overview</div>
            <ScalarIconButton
              :icon="ScalarIconCornersOut"
              label="Expand workflow diagram"
              size="xs"
              variant="ghost"
              @click="
                () => {
                  diagramResetKey++
                  diagramModal.show()
                }
              " />
          </div>
          <SpecificationExtension :value="diagramExtension" />
        </div>
      </aside>
    </div>
  </SectionContainerAccordion>

  <SectionContainer
    v-else
    :aria-labelledby="headerId"
    :omit="level !== 0"
    role="region">
    <Section
      :id="workflow.id"
      role="none"
      @intersecting="
        () => eventBus?.emit('intersecting:nav-item', { id: workflow.id })
      ">
      <SectionHeader>
        <Anchor
          @copyAnchorUrl="
            () => eventBus?.emit('copy-url:nav-item', { id: workflow.id })
          ">
          <SectionHeaderTag
            :id="headerId"
            :level="2">
            {{ headingText }}
          </SectionHeaderTag>
        </Anchor>
      </SectionHeader>
      <SectionContent>
        <div
          v-if="workflow.dependsOn?.length"
          class="workflow-depends-on">
          <Badge
            v-for="dependsOnId in workflow.dependsOn"
            :key="dependsOnId">
            Depends on: {{ dependsOnId }}
          </Badge>
        </div>
        <ScalarMarkdown
          :value="description"
          withImages />
        <div class="workflow-content">
          <div class="workflow-main">
            <Schema
              v-if="inputsSchema"
              compact
              :eventBus="eventBus"
              name="Inputs"
              noncollapsible
              :options="schemaOptions"
              :schema="inputsSchema" />
            <Step
              v-for="step in steps"
              :key="step.id"
              :document="document"
              :documents="documents"
              :eventBus="eventBus"
              :expandedItems="expandedItems"
              :options="options"
              :step="step" />
          </div>
          <aside
            v-if="steps.length"
            class="workflow-diagram">
            <div class="workflow-diagram-panel">
              <div class="workflow-diagram-header">
                <div class="workflow-diagram-title">Workflow overview</div>
                <ScalarIconButton
                  :icon="ScalarIconCornersOut"
                  label="Expand workflow diagram"
                  size="xs"
                  variant="ghost"
                  @click="
                    () => {
                      diagramResetKey++
                      diagramModal.show()
                    }
                  " />
              </div>
              <SpecificationExtension :value="diagramExtension" />
            </div>
          </aside>
        </div>
      </SectionContent>
    </Section>
  </SectionContainer>

  <ScalarModal
    bodyClass="workflow-diagram-modal-body"
    maxWidth="min(1440px, 94vw)"
    size="xl"
    :state="diagramModal"
    title="Workflow overview">
    <div class="workflow-diagram-modal-toolbar">
      <ScalarIconButton
        :icon="ScalarIconArrowsIn"
        label="Reset view"
        size="xs"
        variant="ghost"
        @click="diagramResetKey++" />
    </div>
    <div class="workflow-diagram-modal-canvas">
      <SpecificationExtension
        :key="diagramResetKey"
        :value="diagramExtension" />
    </div>
  </ScalarModal>
</template>

<style scoped>
@reference "@/style.css";

.workflow-section {
  margin-bottom: 48px;
}
.workflow-depends-on {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}
.workflow-description {
  padding-bottom: 4px;
  text-align: left;
}

.workflow-content {
  display: grid;
  grid-auto-columns: 1fr;
  grid-auto-flow: row;
  align-items: start;
  gap: 24px;
}

@variant lg {
  .workflow-content {
    /* Same mechanism as `.endpoint-content` in the Operation classic layout — an even split, so the
       diagram panel matches the width of an operation's request/response boxes rather than reading
       as a narrow, cramped afterthought next to them. */
    grid-auto-flow: column;
  }
}

@container narrow-references-container (max-width: 900px) {
  .workflow-content {
    grid-auto-flow: row;
  }
}

.workflow-main {
  min-width: 0;
}

.workflow-diagram {
  min-width: 0;
}

.workflow-diagram-panel {
  position: sticky;
  top: calc(var(--refs-viewport-offset) + 24px);
  max-height: calc(var(--refs-viewport-height) - 48px);
  overflow: auto;

  padding: 12px;
  border: var(--scalar-border-width) solid var(--scalar-border-color);
  border-radius: var(--scalar-radius-lg);
}

.workflow-diagram-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.workflow-diagram-title {
  font-size: var(--scalar-mini);
  font-weight: var(--scalar-bold);
  text-transform: uppercase;
  letter-spacing: 0.02em;
  color: var(--scalar-color-2);
}

@media (max-width: 600px) {
  .workflow-diagram-panel {
    position: static;
    max-height: unset;
  }
}
</style>

<style>
/* Unscoped: ScalarModal teleports its content outside this component's DOM subtree. Selectors are
   doubled-up to out-specificity `ScalarModal`'s own Tailwind classes on the same element (notably
   `min-h-0`, which otherwise wins the cascade over a plain `min-height` here since both are
   single-class-specificity rules and Tailwind's utilities are injected later in the sheet). */
.workflow-diagram-modal-body.workflow-diagram-modal-body {
  display: flex;
  flex-direction: column;
  min-height: 70vh;
  overflow: hidden;
}
.workflow-diagram-modal-toolbar {
  display: flex;
  justify-content: flex-end;
  flex-shrink: 0;
  padding: 8px 8px 0;
}
.workflow-diagram-modal-canvas {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  min-height: 0;
  overflow: auto;
  padding: 40px;
}
.workflow-diagram-modal-canvas.workflow-diagram-modal-canvas
  .scalar-mermaid-diagram {
  margin: 0;
  width: 100%;
  height: 100%;
  max-height: unset;
}
</style>
