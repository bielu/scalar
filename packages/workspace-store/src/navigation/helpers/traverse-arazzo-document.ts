import type { ArazzoDocument, ArazzoStepObject, ArazzoWorkflowObject } from '@scalar/types/arazzo/1.1'

import { isHidden } from '@/helpers/is-hidden'
import { type NavigationOptions, getNavigationOptions } from '@/navigation/get-navigation-options'
import { traverseDescription } from '@/navigation/helpers/traverse-description'
import type { TraverseSpecOptions } from '@/navigation/types'
import type { XInternal } from '@/schemas/extensions/document/x-internal'
import type { XScalarIgnore } from '@/schemas/extensions/document/x-scalar-ignore'
import type {
  TraversedArazzoStep,
  TraversedArazzoWorkflow,
  TraversedDocument,
  TraversedEntry,
} from '@/schemas/navigation'

/** Anything that may carry the navigation visibility extensions. */
type Hideable = XInternal & XScalarIgnore

/** Arazzo document plus Scalar navigation extensions written during traversal. */
type ArazzoDocumentWithNavigationExtensions = ArazzoDocument & {
  'x-scalar-icon'?: string
}

/**
 * Sidebar label for a step: `description`, then `stepId`.
 * Steps have no `title`/`summary` field — only `description`.
 */
const getStepTitle = (step: ArazzoStepObject): string => step.description?.trim() || step.stepId

/**
 * Sidebar label for a workflow: `summary`, then `description`, then `workflowId`.
 */
const getWorkflowTitle = (workflow: ArazzoWorkflowObject): string =>
  workflow.summary?.trim() || workflow.description?.trim() || workflow.workflowId

/**
 * Builds one step navigation entry. Steps have no children and no `$ref` indirection —
 * they're read directly off `workflow.steps` in document order, the same order they execute in
 * absent a `dependsOn` override (which describes execution constraints, not display order).
 * Returns `undefined` when hidden via `x-internal`/`x-scalar-ignore`.
 */
const createStepEntry = ({
  step,
  workflowId,
  generateId,
  parentId,
}: {
  step: ArazzoStepObject
  workflowId: string
  generateId: TraverseSpecOptions['generateId']
  parentId: string
}): TraversedArazzoStep | undefined => {
  if (isHidden(step as Hideable)) {
    return undefined
  }

  return {
    type: 'arazzo-step',
    id: generateId({ type: 'arazzo-step', stepId: step.stepId, parentId }),
    title: getStepTitle(step),
    stepId: step.stepId,
    workflowId,
    operationId: step.operationId,
    operationPath: step.operationPath,
    channelPath: step.channelPath,
    targetWorkflowId: step.workflowId,
  }
}

/**
 * Builds one workflow navigation entry with its steps, in document order. `dependsOn` on a
 * workflow or step describes *execution* ordering (a runtime constraint), not display ordering,
 * so it is deliberately not used to sort the sidebar — that would misrepresent a dependency as a
 * content-organization decision, and would fight the document author's own ordering besides.
 * Returns `undefined` when the workflow itself is hidden.
 */
const createWorkflowEntry = ({
  workflow,
  generateId,
  parentId,
}: {
  workflow: ArazzoWorkflowObject
  generateId: TraverseSpecOptions['generateId']
  parentId: string
}): TraversedArazzoWorkflow | undefined => {
  if (isHidden(workflow as Hideable)) {
    return undefined
  }

  const workflowId = generateId({ type: 'arazzo-workflow', workflowId: workflow.workflowId, parentId })

  const steps = workflow.steps.flatMap((step) => {
    const entry = createStepEntry({ step, workflowId: workflow.workflowId, generateId, parentId: workflowId })
    return entry ? [entry] : []
  })

  return {
    type: 'arazzo-workflow',
    id: workflowId,
    title: getWorkflowTitle(workflow),
    workflowId: workflow.workflowId,
    dependsOn: workflow.dependsOn,
    children: steps.length > 0 ? steps : undefined,
  }
}

/**
 * Entry point: walks an Arazzo document and produces the sidebar tree.
 *
 * Deliberately simpler than `traverseAsyncApiDocument`/`traverseOpenApiDocument`:
 * - `workflows`/`steps` are plain ordered arrays, not `$ref`-able records, so there is no
 *   bucket-and-group pass and no reference resolution to do for the core walk.
 * - Arazzo has no `tags` field anywhere in the schema, so there is no tag-grouping pass.
 * - `components` holds inputs/parameters/actions, not JSON Schemas, so there is no "Models"
 *   section — `traverseSchemas` does not apply here.
 * - Step/workflow cross-references (`operationId`/`operationPath`/`channelPath`) are Runtime
 *   Expressions resolved at *execution* time, not `$ref`s, so no external document needs to be
 *   fetched to build the sidebar — step titles come from `step.description`/`stepId` alone.
 */
export const traverseArazzoDocument = (
  documentName: string,
  document: ArazzoDocumentWithNavigationExtensions,
  options?: NavigationOptions,
): TraversedDocument => {
  const { generateId } = getNavigationOptions(documentName, options)

  const documentId = generateId({ type: 'document', info: document.info, name: documentName })

  const entries: TraversedEntry[] = traverseDescription({ generateId, parentId: documentId, info: document.info })

  const workflowEntries = document.workflows.flatMap((workflow) => {
    const entry = createWorkflowEntry({ workflow, generateId, parentId: documentId })
    return entry ? [entry] : []
  })

  entries.push(...workflowEntries)

  return {
    id: documentId,
    type: 'document',
    title: document.info?.title?.trim() || 'Untitled Document',
    name: documentName,
    children: entries,
    icon: document['x-scalar-icon'],
  }
}
