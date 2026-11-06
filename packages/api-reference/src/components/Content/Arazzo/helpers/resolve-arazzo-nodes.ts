import type { ArazzoDocument, ArazzoStepObject, ArazzoWorkflowObject } from '@scalar/types/arazzo/1.1'

/**
 * Resolve a workflow from the document by its `workflowId`.
 *
 * Unlike AsyncAPI channels/operations, `document.workflows` is a plain ordered array, not a
 * `$ref`-keyed map — the navigation entry only carries the identifying `workflowId`, so this walks
 * the array to find it, mirroring `resolveAsyncApiChannel`'s role for the AsyncAPI renderers.
 */
export const resolveArazzoWorkflow = (document: ArazzoDocument, workflowId: string): ArazzoWorkflowObject | undefined =>
  document.workflows.find((workflow) => workflow.workflowId === workflowId)

/**
 * Resolve a step from the workflow it lives on. Steps are likewise a plain ordered array on
 * `workflow.steps`, not a `$ref`-keyed map.
 */
export const resolveArazzoStep = (
  document: ArazzoDocument,
  workflowId: string,
  stepId: string,
): ArazzoStepObject | undefined =>
  resolveArazzoWorkflow(document, workflowId)?.steps.find((step) => step.stepId === stepId)
