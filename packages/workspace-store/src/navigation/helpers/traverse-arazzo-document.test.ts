import type { ArazzoDocument } from '@scalar/types/arazzo/1.1'
import { describe, expect, it } from 'vitest'

import type { NavigationOptions } from '@/navigation/get-navigation-options'
import type { TraversedArazzoStep, TraversedArazzoWorkflow, TraversedEntry } from '@/schemas/navigation'

import { traverseArazzoDocument } from './traverse-arazzo-document'

const mockOptions: NavigationOptions = {}

const petPurchaseDocument = {
  arazzo: '1.1.0',
  info: { title: 'A pet purchasing workflow', version: '1.0.1' },
  sourceDescriptions: [
    { name: 'petstoreDescription', url: 'https://petstore.example.com/openapi.yaml', type: 'openapi' },
  ],
  workflows: [
    {
      workflowId: 'loginUserAndRetrievePet',
      summary: 'Login User and Retrieve Pet',
      steps: [
        { stepId: 'loginStep', operationId: 'loginUser' },
        { stepId: 'getPetStep', operationId: 'getPetById', dependsOn: ['loginStep'] },
      ],
    },
  ],
} as unknown as ArazzoDocument

const collectEntries = <Entry extends TraversedEntry>(
  children: TraversedEntry[] | undefined,
  type: Entry['type'],
): Entry[] => {
  if (!children) {
    return []
  }

  return children.flatMap((entry) => {
    if (entry.type === type) {
      return [entry as Entry]
    }

    if (entry.type === 'arazzo-workflow' && entry.children) {
      return collectEntries(entry.children, type)
    }

    return []
  })
}

const collectWorkflows = (children: TraversedEntry[] | undefined): TraversedArazzoWorkflow[] =>
  collectEntries(children, 'arazzo-workflow')

const collectSteps = (children: TraversedEntry[] | undefined): TraversedArazzoStep[] =>
  collectEntries(children, 'arazzo-step')

describe('traverseArazzoDocument', () => {
  it('emits only the default Introduction entry when there are no workflows or description', () => {
    const document = {
      arazzo: '1.1.0',
      info: { title: 'Empty workflow doc', version: '1.0.0' },
      sourceDescriptions: [],
      workflows: [],
    } as unknown as ArazzoDocument

    const result = traverseArazzoDocument('empty', document, mockOptions)

    expect(result).toMatchObject({
      id: 'empty',
      type: 'document',
      title: 'Empty workflow doc',
      name: 'empty',
      children: [{ type: 'text', title: 'Introduction' }],
    })
  })

  it('extracts headings from info.description as children of Introduction', () => {
    const document = {
      ...petPurchaseDocument,
      info: {
        ...petPurchaseDocument.info,
        description: 'Some leading text.\n\n## Authentication\n\n- bullet a\n',
      },
      workflows: [],
    } as unknown as ArazzoDocument

    const result = traverseArazzoDocument('pet-purchase', document, mockOptions)
    const intro = result.children?.[0]

    expect(intro).toMatchObject({ type: 'text', title: 'Introduction' })
    expect('children' in (intro ?? {}) ? (intro as { children?: unknown }).children : undefined).toEqual([
      { id: expect.any(String), title: 'Authentication', type: 'text', children: [] },
    ])
  })

  it('lists a workflow with its steps in document order, not sorted', () => {
    const result = traverseArazzoDocument('pet-purchase', petPurchaseDocument, mockOptions)
    const workflows = collectWorkflows(result.children)
    const steps = collectSteps(result.children)

    expect(workflows).toHaveLength(1)
    expect(steps).toHaveLength(2)

    expect(workflows[0]).toMatchObject({
      type: 'arazzo-workflow',
      workflowId: 'loginUserAndRetrievePet',
      title: 'Login User and Retrieve Pet',
      children: [
        expect.objectContaining({ type: 'arazzo-step', stepId: 'loginStep' }),
        expect.objectContaining({ type: 'arazzo-step', stepId: 'getPetStep' }),
      ],
    })
  })

  it('carries operationId/operationPath/channelPath/targetWorkflowId through to the step entry', () => {
    const document = {
      arazzo: '1.1.0',
      info: { title: 'Mixed targets', version: '1.0.0' },
      sourceDescriptions: [],
      workflows: [
        {
          workflowId: 'mixedTargets',
          steps: [
            { stepId: 'byOperationId', operationId: 'getPetById' },
            { stepId: 'byOperationPath', operationPath: '{$sourceDescriptions.petstore.url}#/paths/~1pets/get' },
            { stepId: 'byChannelPath', channelPath: '{$sourceDescriptions.events.url}#/channels/petEvents' },
            { stepId: 'byWorkflow', workflowId: 'anotherWorkflow' },
          ],
        },
      ],
    } as unknown as ArazzoDocument

    const result = traverseArazzoDocument('mixed', document, mockOptions)
    const steps = collectSteps(result.children)

    expect(steps.find((step) => step.stepId === 'byOperationId')).toMatchObject({ operationId: 'getPetById' })
    expect(steps.find((step) => step.stepId === 'byOperationPath')).toMatchObject({
      operationPath: '{$sourceDescriptions.petstore.url}#/paths/~1pets/get',
    })
    expect(steps.find((step) => step.stepId === 'byChannelPath')).toMatchObject({
      channelPath: '{$sourceDescriptions.events.url}#/channels/petEvents',
    })
    expect(steps.find((step) => step.stepId === 'byWorkflow')).toMatchObject({ targetWorkflowId: 'anotherWorkflow' })
  })

  it('falls back from summary to description to workflowId, and from step description to stepId, for titles', () => {
    const document = {
      arazzo: '1.1.0',
      info: { title: 'Titles', version: '1.0.0' },
      sourceDescriptions: [],
      workflows: [
        {
          workflowId: 'summaryOnly',
          summary: 'Has a summary',
          steps: [{ stepId: 'describedStep', description: 'A described step' }],
        },
        {
          workflowId: 'descriptionOnly',
          description: 'Has a description, no summary',
          steps: [{ stepId: 'bareStep' }],
        },
        { workflowId: 'idOnly', steps: [] },
      ],
    } as unknown as ArazzoDocument

    const result = traverseArazzoDocument('titles', document, mockOptions)
    const workflows = collectWorkflows(result.children)
    const steps = collectSteps(result.children)

    expect(workflows.find((w) => w.workflowId === 'summaryOnly')?.title).toBe('Has a summary')
    expect(workflows.find((w) => w.workflowId === 'descriptionOnly')?.title).toBe('Has a description, no summary')
    expect(workflows.find((w) => w.workflowId === 'idOnly')?.title).toBe('idOnly')

    expect(steps.find((s) => s.stepId === 'describedStep')?.title).toBe('A described step')
    expect(steps.find((s) => s.stepId === 'bareStep')?.title).toBe('bareStep')
  })

  it('leaves children unset for a workflow with an empty steps array', () => {
    const document = {
      arazzo: '1.1.0',
      info: { title: 'No steps', version: '1.0.0' },
      sourceDescriptions: [],
      workflows: [{ workflowId: 'noSteps', steps: [] }],
    } as unknown as ArazzoDocument

    const result = traverseArazzoDocument('no-steps', document, mockOptions)
    const workflows = collectWorkflows(result.children)

    expect(workflows).toEqual([expect.objectContaining({ workflowId: 'noSteps', children: undefined })])
  })

  it('filters out workflows and steps marked hidden via x-internal or x-scalar-ignore', () => {
    const document = {
      arazzo: '1.1.0',
      info: { title: 'Hidden entries', version: '1.0.0' },
      sourceDescriptions: [],
      workflows: [
        {
          workflowId: 'visibleWorkflow',
          steps: [
            { stepId: 'visibleStep' },
            { stepId: 'internalStep', 'x-internal': true },
            { stepId: 'ignoredStep', 'x-scalar-ignore': true },
          ],
        },
        { workflowId: 'internalWorkflow', 'x-internal': true, steps: [{ stepId: 'orphanStep' }] },
      ],
    } as unknown as ArazzoDocument

    const result = traverseArazzoDocument('hidden', document, mockOptions)
    const workflows = collectWorkflows(result.children)
    const steps = collectSteps(result.children)

    expect(workflows.map((w) => w.workflowId)).toEqual(['visibleWorkflow'])
    expect(steps.map((s) => s.stepId)).toEqual(['visibleStep'])
  })

  it('generates unique, stable ids for workflows and steps', () => {
    const result = traverseArazzoDocument('pet-purchase', petPurchaseDocument, mockOptions)
    const again = traverseArazzoDocument('pet-purchase', petPurchaseDocument, mockOptions)

    const workflows = collectWorkflows(result.children)
    const steps = collectSteps(result.children)
    const allIds = [result.id, ...workflows.map((w) => w.id), ...steps.map((s) => s.id)]

    expect(new Set(allIds).size).toBe(allIds.length)
    expect(again).toEqual(result)
  })
})
