<script setup lang="ts">
import { ScalarMarkdown } from '@scalar/components/markdown'
import type { ArazzoDocument } from '@scalar/types/arazzo/1.1'
import type { WorkspaceEventBus } from '@scalar/workspace-store/events'
import {
  getResolvedRef,
  mergeSiblingReferences,
} from '@scalar/workspace-store/helpers/get-resolved-ref'
import type { TraversedArazzoStep } from '@scalar/workspace-store/schemas/navigation'
import type { WorkspaceDocument } from '@scalar/workspace-store/schemas/workspace'
import { computed, useId, useTemplateRef } from 'vue'

import { Anchor } from '@/components/Anchor'
import { Badge } from '@/components/Badge'
import { adaptAsyncApiParameters } from '@/components/Content/AsyncApi/helpers/adapt-async-api-parameters'
import {
  resolveSchemaRenderOptions,
  type AsyncApiSchemaRenderOptions,
} from '@/components/Content/AsyncApi/helpers/async-api-render-options'
import { pickHeading } from '@/components/Content/AsyncApi/helpers/pick-heading'
import { SectionHeaderTag } from '@/components/Section'
import ParameterList from '@/features/Operation/components/ParameterList.vue'
import { useIntersection } from '@/hooks/use-intersection'

import { resolveArazzoStep } from './helpers/resolve-arazzo-nodes'
import { resolveArazzoStepTarget } from './helpers/resolve-arazzo-target'

const { step, document, documents, eventBus, options } = defineProps<{
  step: TraversedArazzoStep
  document: ArazzoDocument
  documents: Record<string, WorkspaceDocument>
  eventBus: WorkspaceEventBus | null
  options?: Partial<AsyncApiSchemaRenderOptions>
  expandedItems?: Record<string, boolean>
}>()

const headerId = useId()
const section = useTemplateRef<HTMLElement>('section')

useIntersection(section, () =>
  eventBus?.emit('intersecting:nav-item', { id: step.id }),
)

/** Resolve the step from its workflow so we can read its own description/parameters/outputs. */
const resolvedStep = computed(() =>
  resolveArazzoStep(document, step.workflowId, step.stepId),
)

/** Steps have no title/summary field — only `description`, falling back to the stepId. */
const headingText = computed(() =>
  pickHeading(resolvedStep.value?.description, step.stepId),
)

/**
 * The step's own parameters, adapted into the OpenAPI `ParameterObject` shape so the shared
 * `ParameterList` can render them. Arazzo parameter `value` is usually a Runtime Expression or a
 * constant rather than a schema, so there is nothing to type-check against — the adapter folds it
 * into a plain string schema whose default carries the raw value, purely for display.
 */
const parameters = computed(() =>
  (resolvedStep.value?.parameters ?? []).flatMap((entry) => {
    const parameter = getResolvedRef(entry, mergeSiblingReferences)
    // Reusable Object form (`{ reference, value }`) has no `name`/`in` of its own to render as a
    // parameter row — skip it rather than show a blank entry.
    if (!('name' in parameter)) {
      return []
    }
    const value =
      typeof parameter.value === 'string'
        ? parameter.value
        : JSON.stringify(parameter.value)
    return [
      {
        name: parameter.name,
        in:
          parameter.in === 'channel' || parameter.in === 'querystring'
            ? 'query'
            : (parameter.in ?? 'query'),
        required: true,
        schema: { type: 'string', default: value },
      },
    ]
  }),
)

const parameterListOptions = computed(() => ({
  hideModels: false,
  ...resolveSchemaRenderOptions(options),
}))

/** Output name → Runtime Expression (or Selector Object) pairs, rendered as a simple key/value list. */
const outputs = computed(() =>
  Object.entries(resolvedStep.value?.outputs ?? {}),
)

const successCriteria = computed(
  () => resolvedStep.value?.successCriteria ?? [],
)

/**
 * Resolves whichever of operationId/operationPath/channelPath/workflowId this step declares.
 * Reads the raw step object (`resolvedStep`), not the navigation entry (`step`) — the navigation
 * entry's own `workflowId` names the *parent* workflow this step belongs to, which is always set
 * and would otherwise shadow the raw step's `workflowId` (the *target* workflow it invokes).
 */
const target = computed(() =>
  resolvedStep.value
    ? resolveArazzoStepTarget(document, resolvedStep.value, documents)
    : undefined,
)

const targetLabel = computed(() => {
  switch (target.value?.kind) {
    case 'workflow':
      return 'Invokes workflow'
    case 'operation':
      return 'Calls operation'
    case 'channel':
      return 'Calls channel'
    default:
      return undefined
  }
})

/** Adapted parameters for a resolved AsyncAPI channel target, matching `Channel.vue`'s own treatment. */
const targetChannelParameters = computed(() =>
  target.value?.kind === 'channel'
    ? adaptAsyncApiParameters(target.value.channel?.parameters)
    : [],
)

/** Parameters declared directly on a resolved OpenAPI operation target. */
const targetOperationParameters = computed(() => {
  if (target.value?.kind !== 'operation' || !target.value.operation) {
    return []
  }
  return (target.value.operation.parameters ?? []).map((entry) =>
    getResolvedRef(entry, mergeSiblingReferences),
  )
})
</script>

<template>
  <div
    :id="step.id"
    ref="section"
    class="step">
    <Anchor
      @copyAnchorUrl="
        () => eventBus?.emit('copy-url:nav-item', { id: step.id })
      ">
      <div class="step-kicker">Step: {{ step.stepId }}</div>
      <SectionHeaderTag
        :id="headerId"
        class="step-title"
        :level="3">
        {{ headingText }}
      </SectionHeaderTag>
    </Anchor>

    <div
      v-if="resolvedStep?.dependsOn?.length"
      class="step-depends-on">
      <Badge
        v-for="dependsOnId in resolvedStep.dependsOn"
        :key="dependsOnId">
        Depends on: {{ dependsOnId }}
      </Badge>
    </div>

    <div
      v-if="targetLabel"
      class="step-target">
      <Badge class="step-target-badge">
        {{ targetLabel }}: {{ target?.identifier }}
        <template
          v-if="target?.kind === 'operation' && target.method && target.path">
          ({{ target.method.toUpperCase() }} {{ target.path }})
        </template>
      </Badge>

      <template v-if="target?.kind === 'operation' && target.operation">
        <ScalarMarkdown
          v-if="target.operation.summary || target.operation.description"
          class="step-target-description"
          :value="
            target.operation.summary || target.operation.description || ''
          "
          withImages />
        <ParameterList
          v-if="targetOperationParameters.length"
          :eventBus="eventBus"
          :options="parameterListOptions"
          :parameters="targetOperationParameters">
          <template #title>Target operation parameters</template>
        </ParameterList>
      </template>

      <template v-else-if="target?.kind === 'channel' && target.channel">
        <ScalarMarkdown
          v-if="target.channel.title || target.channel.description"
          class="step-target-description"
          :value="target.channel.title || target.channel.description || ''"
          withImages />
        <ParameterList
          v-if="targetChannelParameters.length"
          :eventBus="eventBus"
          :options="parameterListOptions"
          :parameters="targetChannelParameters">
          <template #title>Target channel parameters</template>
        </ParameterList>
      </template>

      <template v-else-if="target?.kind === 'workflow' && target.workflow">
        <ScalarMarkdown
          v-if="target.workflow.summary || target.workflow.description"
          class="step-target-description"
          :value="target.workflow.summary || target.workflow.description || ''"
          withImages />
      </template>
    </div>

    <ParameterList
      v-if="parameters.length"
      :eventBus="eventBus"
      :options="parameterListOptions"
      :parameters="parameters">
      <template #title>Parameters</template>
    </ParameterList>

    <div
      v-if="outputs.length"
      class="step-outputs">
      <div class="step-section-title">Outputs</div>
      <dl>
        <template
          v-for="[name, value] in outputs"
          :key="name">
          <dt>{{ name }}</dt>
          <dd>
            {{ typeof value === 'string' ? value : JSON.stringify(value) }}
          </dd>
        </template>
      </dl>
    </div>

    <div
      v-if="successCriteria.length"
      class="step-success-criteria">
      <div class="step-section-title">Success criteria</div>
      <ul>
        <li
          v-for="(criterion, index) in successCriteria"
          :key="index">
          {{ criterion.condition }}
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.step {
  margin-top: 32px;
  scroll-margin-top: var(--refs-viewport-offset);
}
.step-kicker {
  font-family: var(--scalar-font-code);
  font-size: var(--scalar-font-size-4);
  font-weight: var(--scalar-semibold);
  color: var(--scalar-color-2);
  text-transform: uppercase;
  letter-spacing: 0.02em;
  margin-bottom: 4px;
}
.step-title {
  font-size: var(--scalar-heading-3);
  font-weight: var(--scalar-semibold);
  color: var(--scalar-color-1);
}
.step-depends-on {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}
.step-target {
  margin-top: 12px;
}
.step-target-description {
  margin-top: 8px;
  text-align: left;
}
.step-section-title {
  font-size: var(--scalar-font-size-2);
  font-weight: var(--scalar-semibold);
  color: var(--scalar-color-1);
  padding-bottom: 8px;
  border-bottom: var(--scalar-border-width) solid var(--scalar-border-color);
  margin: 16px 0 8px;
}
.step-outputs dl {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 4px 12px;
  margin: 0;
}
.step-outputs dt {
  font-weight: var(--scalar-semibold);
  color: var(--scalar-color-1);
}
.step-outputs dd {
  margin: 0;
  color: var(--scalar-color-2);
  font-family: var(--scalar-font-code);
  word-break: break-all;
}
.step-success-criteria ul {
  margin: 0;
  padding-left: 20px;
}
</style>
