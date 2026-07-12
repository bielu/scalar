/**
 * WebSocket connection orchestrator for AsyncAPI channel operations.
 *
 * Mirrors the `sendRequest` pattern: accepts a connection URL, optional plugins,
 * and a session, then wires up the lifecycle. Plugin hooks (`beforeConnect`,
 * `onWebSocketMessage`, `onWebSocketClose`) run at the appropriate points.
 *
 * Browser WebSocket cannot set arbitrary headers on the handshake, so auth is
 * applied via query parameters. The proxy URL is intentionally unused here
 * because WebSocket traffic does not go through an HTTP CORS proxy.
 */
import { type Result, err, ok } from '@scalar/helpers/types/result'
import { safeRun } from '@scalar/helpers/types/safe-run'
import type { ClientPlugin } from '@scalar/oas-utils/helpers'
import { executeWebSocketHook, normalizeTransportProtocol, resolveChannelTransport } from '@scalar/oas-utils/helpers'

import { createChannelTransportSocket } from './channel-transport-socket'
import type {
  WebSocketCloseInfo,
  WebSocketConstructorLike,
  WebSocketFrame,
  WebSocketSession,
  WebSocketSessionState,
} from './websocket-session'

export type ConnectWebSocketOptions = {
  connectionUrl: string
  protocols?: string | string[]
  session: WebSocketSession
  plugins?: ClientPlugin[]
  callbacks?: {
    onFrame?: (frame: WebSocketFrame) => void
    onStateChange?: (state: WebSocketSessionState, previous: WebSocketSessionState) => void
    onError?: (event: Event) => void
    onClose?: (info: WebSocketCloseInfo) => void
    onOpen?: () => void
  }
  /** Injectable socket constructor for tests or Electron override. Takes precedence over plugin transports. */
  customWebSocket?: WebSocketConstructorLike
}

export type ConnectWebSocketData = {
  session: WebSocketSession
}

/** Failure code when the WebSocket handshake or connection cannot be established. */
export const WEBSOCKET_CONNECTION_FAILED = 'WEBSOCKET_CONNECTION_FAILED' as const

export const WEBSOCKET_CONNECTION_FAILED_MESSAGE = 'The WebSocket connection could not be established' as const

export type ConnectWebSocketFailureCode = typeof WEBSOCKET_CONNECTION_FAILED

export type ConnectWebSocketResult = Result<ConnectWebSocketData, ConnectWebSocketFailureCode>

const connectionFailed = (): ConnectWebSocketResult =>
  err(WEBSOCKET_CONNECTION_FAILED, WEBSOCKET_CONNECTION_FAILED_MESSAGE)

/**
 * Resolves the socket constructor for a connection URL.
 *
 * An explicit `customWebSocket` (tests, Electron override) always wins. Otherwise, a
 * plugin-registered channel transport matching the URL protocol is adapted into the
 * socket surface — this is how plugins provide clients for protocols the API client
 * has no built-in support for (SignalR, gRPC streaming, MQTT, …). With no match, the
 * session falls back to the native WebSocket.
 */
const resolveSocketConstructor = (
  url: string,
  plugins: ClientPlugin[],
  customWebSocket?: WebSocketConstructorLike,
): WebSocketConstructorLike | undefined => {
  if (customWebSocket) {
    return customWebSocket
  }

  const protocol = normalizeTransportProtocol(safeParseProtocol(url))

  if (!protocol) {
    return undefined
  }

  // Channel operations are AsyncAPI-only today
  const documentType = 'asyncapi'
  const transport = resolveChannelTransport({ documentType, protocol, plugins })

  if (!transport) {
    return undefined
  }

  return createChannelTransportSocket(transport, { documentType, protocol })
}

/** Parses the protocol of a connection URL, or undefined when the URL is not absolute. */
const safeParseProtocol = (url: string): string | undefined => {
  try {
    return new URL(url).protocol
  } catch {
    return undefined
  }
}

/**
 * Connects a WebSocket session after running plugin `beforeConnect` hooks.
 *
 * Resolves once the socket opens, or returns a failure result on error or close
 * before open. After the initial connect, the session stays alive and messages
 * flow through `onFrame` until the caller (or the server) closes it.
 */
export const connectWebSocket = async ({
  connectionUrl,
  protocols,
  session,
  plugins = [],
  callbacks,
  customWebSocket,
}: ConnectWebSocketOptions): Promise<ConnectWebSocketResult> => {
  const guarded = await safeRun(async () => {
    const beforeConnectResult = await executeWebSocketHook({ url: connectionUrl }, 'beforeConnect', plugins)
    const url = beforeConnectResult.url

    // Resolve after beforeConnect so a hook-rewritten URL selects the transport
    const socketConstructor = resolveSocketConstructor(url, plugins, customWebSocket)

    return new Promise<ConnectWebSocketResult>((resolve) => {
      session.connect({
        url,
        protocols,
        customWebSocket: socketConstructor,
        callbacks: {
          onOpen: () => {
            callbacks?.onOpen?.()
            resolve(ok({ session }))
          },
          onFrame: (frame) => {
            callbacks?.onFrame?.(frame)
            void executeWebSocketHook({ frame }, 'onWebSocketMessage', plugins)
          },
          onStateChange: (state, previous) => {
            callbacks?.onStateChange?.(state, previous)
          },
          onError: (event) => {
            callbacks?.onError?.(event)

            if (session.state === 'error' && session.frames.length === 0) {
              resolve(connectionFailed())
            }
          },
          onClose: (info) => {
            callbacks?.onClose?.(info)
            void executeWebSocketHook({ info }, 'onWebSocketClose', plugins)

            if (session.state !== 'open') {
              resolve(connectionFailed())
            }
          },
        },
      })

      if (session.state === 'error') {
        resolve(connectionFailed())
      }
    })
  })

  if (!guarded.ok) {
    return err(WEBSOCKET_CONNECTION_FAILED, guarded.error)
  }

  return guarded.data
}
