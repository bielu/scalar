import type {
  ArazzoCriterionObject,
  ArazzoFailureActionObject,
  ArazzoReusableObject,
  ArazzoStepObject,
  ArazzoSuccessActionObject,
  ArazzoWorkflowObject,
} from '@scalar/types/arazzo/1.1'

/** Mermaid node ids must be identifier-safe; stepId is free-form per spec, so sanitize defensively. */
const toNodeId = (stepId: string): string => stepId.replace(/[^A-Za-z0-9_-]/g, '_')

/** Mermaid quoted text uses `"..."` as the delimiter; escape embedded quotes and flatten newlines. */
const escapeMermaidText = (text: string): string => text.replace(/"/g, '#quot;').replace(/\s+/g, ' ').trim()

const SUCCESS_NODE_ID = '__workflow_success__'
const FAILURE_NODE_ID = '__workflow_failure__'

/**
 * Drops Reusable Object entries (`{ reference, value }`, pointing into `components.successActions` /
 * `failureActions`) — unlike OpenAPI's `$ref`, Arazzo's reference shape isn't bundler-resolved onto
 * a `$ref-value`, so there is nothing here to dereference. Same gap Step.vue's own parameter
 * resolution already lives with (see its `'name' in parameter` check) rather than something new.
 */
const resolveActions = <Action extends { type: string }>(
  actions: (Action | ArazzoReusableObject)[] | undefined,
): Action[] => (actions ?? []).filter((action): action is Action => 'type' in action)

/** Joins a criteria array (spec: all must hold) into one label; undefined when there's nothing to show. */
const describeCriteria = (criteria: ArazzoCriterionObject[] | undefined): string | undefined =>
  criteria?.length ? criteria.map((criterion) => criterion.condition).join(' && ') : undefined

/** Prefers the actual condition over the action's own name, since the condition is what a reader wants. */
const actionLabel = (action: ArazzoSuccessActionObject | ArazzoFailureActionObject, extra?: string): string =>
  escapeMermaidText([describeCriteria(action.criteria) ?? action.name, extra].filter(Boolean).join(' — '))

const failureExtra = (action: ArazzoFailureActionObject): string | undefined => {
  if (action.type !== 'retry') {
    return undefined
  }
  return typeof action.retryLimit === 'number' ? `retry, ≤${action.retryLimit}x` : 'retry'
}

/**
 * Builds a Mermaid flowchart source (top-down) from a workflow's steps, for the `x-mermaid`
 * extension `Workflow.vue` renders via `@scalar/plugin-mermaid`. Purely a string builder — no
 * Mermaid dependency here, so this stays free even for consumers who never register that plugin.
 *
 * Two edge sources, kept from double-drawing the same arrow:
 * - Explicit `onSuccess`/`onFailure` actions become labeled edges to their `goto`/`retry` target (or
 *   to a synthetic terminal node for `end`) — this is the only source of *conditional* edges, since
 *   `dependsOn` records prerequisites, not the criteria that decide which one is actually taken.
 * - Every other step relationship falls back to `dependsOn` (labeled with the source step's own
 *   `successCriteria` when that source step has actions at all, so a branch point reads consistently
 *   across all of its outgoing edges — see the `hasActions` check below). When no step declares
 *   `dependsOn` at all, falls back further to a straight chain in document order, since an Arazzo
 *   workflow's steps still run in that order by default.
 */
export const buildWorkflowMermaidDiagram = (workflow: ArazzoWorkflowObject | undefined): string => {
  const steps = workflow?.steps ?? []
  if (steps.length === 0) {
    return ''
  }

  const lines = ['flowchart TD']
  let usesSuccessNode = false
  let usesFailureNode = false

  for (const step of steps) {
    lines.push(`  ${toNodeId(step.stepId)}["${escapeMermaidText(step.stepId)}"]`)
  }

  const explicitTargets = new Set<string>()
  const explicitEdges: string[] = []

  for (const step of steps) {
    const from = toNodeId(step.stepId)

    for (const action of resolveActions<ArazzoSuccessActionObject>(step.onSuccess)) {
      if (action.type === 'end') {
        usesSuccessNode = true
        explicitEdges.push(`  ${from} -- "${actionLabel(action)}" --> ${SUCCESS_NODE_ID}`)
      } else if (action.stepId) {
        explicitTargets.add(`${from}->${toNodeId(action.stepId)}`)
        const label = describeCriteria(action.criteria)
        explicitEdges.push(
          label
            ? `  ${from} -- "${escapeMermaidText(label)}" --> ${toNodeId(action.stepId)}`
            : `  ${from} --> ${toNodeId(action.stepId)}`,
        )
      }
    }

    for (const action of resolveActions<ArazzoFailureActionObject>(step.onFailure)) {
      if (action.type === 'end') {
        usesFailureNode = true
        explicitEdges.push(`  ${from} -- "${actionLabel(action)}" --> ${FAILURE_NODE_ID}`)
      } else if (action.stepId) {
        explicitTargets.add(`${from}->${toNodeId(action.stepId)}`)
        explicitEdges.push(`  ${from} -- "${actionLabel(action, failureExtra(action))}" --> ${toNodeId(action.stepId)}`)
      }
      // A retry/goto action with neither stepId nor workflowId retries this same step — nothing to
      // draw beyond the node itself, since a self-loop back onto an unlabeled box adds noise without
      // conveying more than the label already would.
    }
  }

  const hasActions = (step: ArazzoStepObject): boolean => Boolean(step.onSuccess?.length || step.onFailure?.length)

  const defaultEdges: string[] = []
  const hasExplicitDependsOn = steps.some((step) => step.dependsOn?.length)

  if (hasExplicitDependsOn) {
    for (const step of steps) {
      for (const dependsOnId of step.dependsOn ?? []) {
        const source = steps.find((candidate) => candidate.stepId === dependsOnId)
        const from = toNodeId(dependsOnId)
        const to = toNodeId(step.stepId)
        if (explicitTargets.has(`${from}->${to}`)) {
          continue
        }
        const label = source && hasActions(source) ? describeCriteria(source.successCriteria) : undefined
        defaultEdges.push(label ? `  ${from} -- "${escapeMermaidText(label)}" --> ${to}` : `  ${from} --> ${to}`)
      }
    }
  } else {
    for (let index = 1; index < steps.length; index++) {
      defaultEdges.push(`  ${toNodeId(steps[index - 1]!.stepId)} --> ${toNodeId(steps[index]!.stepId)}`)
    }
  }

  if (usesSuccessNode) {
    lines.push(`  ${SUCCESS_NODE_ID}((Success))`)
  }
  if (usesFailureNode) {
    lines.push(`  ${FAILURE_NODE_ID}((Failed))`)
  }

  return [...lines, ...defaultEdges, ...explicitEdges].join('\n')
}
