/**
 * Client transport registry.
 *
 * Plugins can register custom transports that replace the built-in request execution
 * engine (the global `fetch` for HTTP today, channel transports for AsyncAPI protocols
 * later). A transport is selected by the type of the current document and the protocol
 * of the target server, so a plugin can, for example, take over `https` requests only
 * for AsyncAPI documents, or serve a protocol the client has no built-in support for.
 */

/** Document flavors a transport registration can be scoped to. */
export type TransportDocumentType = 'openapi' | 'asyncapi'

/** Context passed to a transport when it executes a request. */
export type ClientTransportContext = {
  /** The type of the document the request originates from. */
  documentType: TransportDocumentType
  /** Normalized protocol of the target server (lowercase, no trailing colon), e.g. `http`, `https`. */
  protocol: string
}

/**
 * A one-shot request/response transport.
 *
 * Receives the exact fetch `Request` the client built and returns a standard `Response`,
 * so the entire downstream pipeline (streaming detection, cookie handling, response body
 * decoding, plugin hooks) keeps working unchanged. Transports own their I/O: requests
 * executed through a transport are never routed through the CORS proxy.
 */
export type HttpTransport = {
  kind: 'http'
  send: (request: Request, context: ClientTransportContext) => Response | Promise<Response>
}

/** Close metadata reported by a channel transport. Fields follow WebSocket close semantics. */
export type ChannelCloseInfo = {
  code?: number
  reason?: string
  wasClean?: boolean
}

/** Callbacks a channel transport invokes to report connection events back to the client. */
export type ChannelConnectHandlers = {
  /** Invoke for every message received on the connection. */
  onMessage: (data: string | ArrayBuffer) => void
  /** Invoke when the connection errors. Errors after open are advisory; `onClose` owns terminal state. */
  onError: (error: unknown) => void
  /** Invoke exactly once when the connection closes (cleanly or due to error). */
  onClose: (info: ChannelCloseInfo) => void
}

/** An established channel connection returned by {@link ChannelTransport.connect}. */
export type ChannelConnection = {
  /** Send a message over the open connection. */
  send: (data: string) => void
  /** Close the connection. Codes follow WebSocket close semantics. */
  close: (code?: number, reason?: string) => void
}

/**
 * A session-based transport for long-lived, bidirectional connections
 * (SignalR, gRPC streaming, MQTT, …).
 *
 * `connect` resolves once the connection is established (for example after
 * `HubConnection.start()` for SignalR) and rejects when it cannot be. Incoming
 * traffic is reported through the provided handlers; outgoing traffic and
 * shutdown go through the returned {@link ChannelConnection}.
 */
export type ChannelTransport = {
  kind: 'channel'
  connect: (
    options: {
      /** The resolved connection URL. */
      url: string
      /** Subprotocols requested for the connection, when the caller provides any. */
      protocols?: string | string[]
      /** Callbacks to report connection events back to the client. */
      handlers: ChannelConnectHandlers
    },
    context: ClientTransportContext,
  ) => ChannelConnection | Promise<ChannelConnection>
}

/**
 * A transport registration on a client plugin.
 *
 * The `kind` discriminator selects the execution model: `http` transports serve
 * one-shot request/response operations, `channel` transports serve long-lived
 * bidirectional connections.
 */
export type ClientTransport = {
  /** Restrict the transport to a document flavor. Matches all document types when omitted. */
  documentType?: TransportDocumentType
  /** Protocols this transport serves. Case-insensitive, a trailing `:` is ignored. */
  protocols: string[]
  /** The transport implementation. */
  transport: HttpTransport | ChannelTransport
}

/** The subset of a client plugin the transport resolver cares about. */
type PluginWithTransports = {
  transports?: ClientTransport[]
}

/**
 * Normalizes a protocol identifier for comparison: trimmed, lowercased, and without a
 * trailing colon (so both `https` and the `https:` form produced by `URL.protocol` match).
 *
 * Returns `undefined` when the protocol is missing or blank, so callers can treat
 * "no protocol" distinctly instead of comparing against an empty string.
 */
export const normalizeTransportProtocol = (protocol: string | undefined): string | undefined => {
  const normalized = protocol?.trim().toLowerCase().replace(/:$/, '')
  return normalized ? normalized : undefined
}

/** Arguments shared by the transport resolvers. */
type ResolveTransportArgs = {
  documentType: TransportDocumentType
  protocol: string
  plugins: PluginWithTransports[]
}

/**
 * Resolves the first transport of the given kind matching the document type and protocol.
 * Plugins are scanned in registration order, so the first matching registration wins.
 */
const resolveTransport = <Kind extends ClientTransport['transport']['kind']>(
  kind: Kind,
  { documentType, protocol, plugins }: ResolveTransportArgs,
): Extract<ClientTransport['transport'], { kind: Kind }> | undefined => {
  const normalizedProtocol = normalizeTransportProtocol(protocol)

  if (!normalizedProtocol) {
    return undefined
  }

  for (const plugin of plugins) {
    for (const registration of plugin.transports ?? []) {
      if (registration.documentType && registration.documentType !== documentType) {
        continue
      }

      if (registration.transport.kind !== kind) {
        continue
      }

      if (registration.protocols.some((p) => normalizeTransportProtocol(p) === normalizedProtocol)) {
        return registration.transport as Extract<ClientTransport['transport'], { kind: Kind }>
      }
    }
  }

  return undefined
}

/**
 * Resolves the HTTP transport to execute a request with.
 *
 * Returns `undefined` when no plugin claims the document type and protocol combination,
 * in which case the caller falls back to the built-in engine (global fetch).
 */
export const resolveHttpTransport = (args: ResolveTransportArgs): HttpTransport | undefined =>
  resolveTransport('http', args)

/**
 * Resolves the channel transport to establish a connection with.
 *
 * Returns `undefined` when no plugin claims the document type and protocol combination,
 * in which case the caller falls back to the built-in engine (native WebSocket for ws/wss).
 */
export const resolveChannelTransport = (args: ResolveTransportArgs): ChannelTransport | undefined =>
  resolveTransport('channel', args)
