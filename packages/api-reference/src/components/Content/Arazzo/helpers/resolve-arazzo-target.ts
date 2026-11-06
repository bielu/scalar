import { parseJsonPointerSegments } from '@scalar/helpers/json/parse-json-pointer-segments'
import type { ArazzoDocument, ArazzoStepObject } from '@scalar/types/arazzo/1.1'
import type { AsyncApiChannelObject, AsyncApiOperationObject } from '@scalar/types/asyncapi/3.1'
import { forEachPathItemOperation } from '@scalar/workspace-store/helpers/for-each-path-item-operation'
import { getResolvedRef, mergeSiblingReferences } from '@scalar/workspace-store/helpers/get-resolved-ref'
import { isAsyncApiDocument, isOpenApiDocument } from '@scalar/workspace-store/schemas/type-guards'
import type { OperationObject } from '@scalar/workspace-store/schemas/v3.1/strict/openapi-document'
import type { WorkspaceDocument } from '@scalar/workspace-store/schemas/workspace'

import { resolveArazzoWorkflow } from './resolve-arazzo-nodes'

/**
 * A step target resolved to another workflow in the *same* Arazzo document — no cross-document
 * lookup involved.
 */
type ResolvedWorkflowTarget = {
  kind: 'workflow'
  identifier: string
  workflow: ReturnType<typeof resolveArazzoWorkflow>
}

/** A step target resolved to an OpenAPI operation in a sibling document. */
type ResolvedOperationTarget = {
  kind: 'operation'
  identifier: string
  documentSlug: string | undefined
  path: string | undefined
  method: string | undefined
  operation: OperationObject | undefined
}

/** A step target resolved to an AsyncAPI operation (and the channel it targets) in a sibling document. */
type ResolvedChannelTarget = {
  kind: 'channel'
  identifier: string
  documentSlug: string | undefined
  channelName: string | undefined
  channel: AsyncApiChannelObject | undefined
  operation: AsyncApiOperationObject | undefined
}

/**
 * The result of resolving a step's target. `identifier` is always the raw
 * `operationId`/`operationPath`/`channelPath`/`workflowId` the step declared, so the UI has
 * something to show even when the rest of the fields stay `undefined` (source not loaded, id not
 * found — resolution degrades gracefully rather than throwing).
 */
export type ArazzoStepTarget = ResolvedWorkflowTarget | ResolvedOperationTarget | ResolvedChannelTarget | undefined

/** Matches the one Runtime Expression form `operationPath`/`channelPath` actually use in practice: `{$sourceDescriptions.NAME.url}#/POINTER`. */
const SOURCE_DESCRIPTION_POINTER = /^\{\$sourceDescriptions\.([^.}]+)\.url\}#(\/.*)$/

/**
 * Splits `operationPath`/`channelPath`'s Runtime Expression into the source description name and
 * the JSON Pointer suffix.
 *
 * Deliberately narrow: Arazzo defines many other Runtime Expression forms (`$steps.x.outputs.y`,
 * `$response.body#/...`, …), but those are execution-time-only and irrelevant to static rendering —
 * this only ever needs to understand the one form these two fields use.
 */
const parseSourceDescriptionPointer = (value: string): { sourceName: string; pointer: string } | undefined => {
  const match = SOURCE_DESCRIPTION_POINTER.exec(value)
  return match ? { sourceName: match[1]!, pointer: match[2]! } : undefined
}

/**
 * Finds the workspace document whose `x-scalar-original-source-url` matches a `sourceDescriptions[].url`.
 *
 * This is the one place a step's declared source actually reaches into a *different* loaded
 * document — nothing else in the workspace store resolves an identifier across documents like this.
 */
const findDocumentBySourceUrl = (
  documents: Record<string, WorkspaceDocument>,
  url: string,
): { slug: string; document: WorkspaceDocument } | undefined => {
  for (const [slug, document] of Object.entries(documents)) {
    if ((document as { 'x-scalar-original-source-url'?: string })['x-scalar-original-source-url'] === url) {
      return { slug, document }
    }
  }
  return undefined
}

const findSourceDescriptionUrl = (document: ArazzoDocument, sourceName: string): string | undefined =>
  document.sourceDescriptions.find((source) => source.name === sourceName)?.url

/**
 * Walks a JSON Pointer's segments against a plain object — the pointer is already parsed via the
 * shared `parseJsonPointerSegments`, this just does the property-by-property lookup.
 */
const getByPointerSegments = (root: unknown, segments: string[]): unknown =>
  segments.reduce<unknown>(
    (node, segment) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[segment] : undefined),
    root,
  )

/**
 * Resolves `step.operationId` — a bare string, deliberately *not* qualified with a source name (the
 * Arazzo spec requires it to be unique across every combined `sourceDescriptions` entry), so every
 * source has to be searched in declaration order until a match turns up.
 *
 * OpenAPI operations carry their own `operationId` field, searched via the existing
 * `forEachPathItemOperation`. AsyncAPI 3.x operations do not — the operation's id *is* the map key
 * on `document.operations`, so that's a direct lookup rather than a search.
 */
const findOperationById = (
  arazzoDocument: ArazzoDocument,
  operationId: string,
  documents: Record<string, WorkspaceDocument>,
): ResolvedOperationTarget | ResolvedChannelTarget | undefined => {
  for (const source of arazzoDocument.sourceDescriptions) {
    const match = findDocumentBySourceUrl(documents, source.url)
    if (!match) {
      continue
    }

    if (isOpenApiDocument(match.document)) {
      for (const [path, pathItem] of Object.entries(match.document.paths ?? {})) {
        let found: { method: string; operation: OperationObject } | undefined
        forEachPathItemOperation(pathItem, (method, operationNode) => {
          if (found) {
            return
          }
          const operation = getResolvedRef(operationNode, mergeSiblingReferences)
          if (operation.operationId === operationId) {
            found = { method, operation }
          }
        })
        if (found) {
          return { kind: 'operation', identifier: operationId, documentSlug: match.slug, path, ...found }
        }
      }
    }

    if (isAsyncApiDocument(match.document)) {
      const operationNode = match.document.operations?.[operationId]
      if (operationNode) {
        const operation = getResolvedRef(operationNode, mergeSiblingReferences)
        const channelRef = operation.channel
        const channelName =
          channelRef && '$ref' in channelRef ? channelRef.$ref.match(/^#\/channels\/([^/]+)$/)?.[1] : undefined
        const channelNode = channelName ? match.document.channels?.[channelName] : undefined
        return {
          kind: 'channel',
          identifier: operationId,
          documentSlug: match.slug,
          channelName,
          channel: channelNode ? getResolvedRef(channelNode, mergeSiblingReferences) : undefined,
          operation,
        }
      }
    }
  }

  return undefined
}

/**
 * Resolves `step.operationPath`/`step.channelPath` — the `{$sourceDescriptions.NAME.url}#/POINTER`
 * form, which names its source explicitly rather than searching every one.
 */
const findByPointer = (
  arazzoDocument: ArazzoDocument,
  value: string,
  documents: Record<string, WorkspaceDocument>,
  target: 'operation' | 'channel',
): ResolvedOperationTarget | ResolvedChannelTarget | undefined => {
  const parsed = parseSourceDescriptionPointer(value)
  if (!parsed) {
    return undefined
  }

  const sourceUrl = findSourceDescriptionUrl(arazzoDocument, parsed.sourceName)
  if (!sourceUrl) {
    return undefined
  }

  const match = findDocumentBySourceUrl(documents, sourceUrl)
  if (!match) {
    return undefined
  }

  const segments = parseJsonPointerSegments(parsed.pointer)

  if (target === 'operation' && isOpenApiDocument(match.document)) {
    // Pointer shape: /paths/<escaped-path>/<method>
    const [, path, method] = segments
    if (!path || !method) {
      return undefined
    }
    const node = getByPointerSegments(match.document, segments)
    return node
      ? {
          kind: 'operation',
          identifier: value,
          documentSlug: match.slug,
          path,
          method,
          operation: getResolvedRef(node, mergeSiblingReferences),
        }
      : undefined
  }

  if (target === 'channel' && isAsyncApiDocument(match.document)) {
    // Pointer shape: /channels/<name>
    const [, channelName] = segments
    if (!channelName) {
      return undefined
    }
    const node = getByPointerSegments(match.document, segments)
    return node
      ? {
          kind: 'channel',
          identifier: value,
          documentSlug: match.slug,
          channelName,
          channel: getResolvedRef(node, mergeSiblingReferences),
          operation: undefined,
        }
      : undefined
  }

  return undefined
}

/**
 * Resolves a step's target — whichever of `operationId`/`operationPath`/`channelPath`/`workflowId`
 * it declares (the four are mutually exclusive by spec). Never throws: an unresolvable target
 * (source not loaded yet, id renamed, …) returns a result with `identifier` set and the rest
 * `undefined`, so the caller can still show *what* the step points at even when it cannot show
 * the resolved content.
 */
export const resolveArazzoStepTarget = (
  arazzoDocument: ArazzoDocument,
  step: ArazzoStepObject,
  documents: Record<string, WorkspaceDocument>,
): ArazzoStepTarget => {
  if (step.workflowId) {
    return {
      kind: 'workflow',
      identifier: step.workflowId,
      workflow: resolveArazzoWorkflow(arazzoDocument, step.workflowId),
    }
  }

  if (step.operationId) {
    return (
      findOperationById(arazzoDocument, step.operationId, documents) ?? {
        kind: 'operation',
        identifier: step.operationId,
        documentSlug: undefined,
        path: undefined,
        method: undefined,
        operation: undefined,
      }
    )
  }

  if (step.operationPath) {
    return (
      findByPointer(arazzoDocument, step.operationPath, documents, 'operation') ?? {
        kind: 'operation',
        identifier: step.operationPath,
        documentSlug: undefined,
        path: undefined,
        method: undefined,
        operation: undefined,
      }
    )
  }

  if (step.channelPath) {
    return (
      findByPointer(arazzoDocument, step.channelPath, documents, 'channel') ?? {
        kind: 'channel',
        identifier: step.channelPath,
        documentSlug: undefined,
        channelName: undefined,
        channel: undefined,
        operation: undefined,
      }
    )
  }

  return undefined
}
