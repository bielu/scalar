import type { ChannelCloseInfo, ChannelTransport, ClientTransportContext } from '@scalar/oas-utils/helpers'

import type {
  WebSocketCloseInfo,
  WebSocketConstructorLike,
  WebSocketLike,
} from '@/v2/blocks/channel-operation-block/helpers/websocket-session'

/** Close code reported when a transport connection fails or closes without close metadata. */
const ABNORMAL_CLOSE_CODE = 1006

/**
 * Bridges a plugin channel transport (SignalR, gRPC streaming, MQTT, …) into the
 * socket surface the WebSocket session drives, so the session state machine, frame
 * log, and plugin hooks work identically for custom transports and native sockets.
 *
 * The returned constructor plugs into the session's `customWebSocket` seam. The
 * transport's async `connect` maps onto socket events: resolution fires `onopen`
 * (queued sends/closes are honored), rejection fires `onerror` followed by `onclose`
 * with an abnormal close code, mirroring how a native WebSocket fails a handshake.
 */
export const createChannelTransportSocket = (
  transport: ChannelTransport,
  context: ClientTransportContext,
): WebSocketConstructorLike =>
  class ChannelTransportSocket implements WebSocketLike {
    binaryType: BinaryType = 'arraybuffer'
    onopen: WebSocketLike['onopen'] = null
    onmessage: WebSocketLike['onmessage'] = null
    onerror: WebSocketLike['onerror'] = null
    onclose: WebSocketLike['onclose'] = null

    private connection: Awaited<ReturnType<ChannelTransport['connect']>> | null = null
    private closeRequested: { code?: number; reason?: string } | null = null
    private closed = false

    constructor(url: string, protocols?: string | string[]) {
      void this.establish(url, protocols)
    }

    private async establish(url: string, protocols?: string | string[]): Promise<void> {
      try {
        const connection = await transport.connect(
          {
            url,
            protocols,
            handlers: {
              onMessage: (data) => {
                if (!this.closed) {
                  this.onmessage?.(new MessageEvent('message', { data }))
                }
              },
              onError: (error) => {
                if (!this.closed) {
                  this.onerror?.(error instanceof Event ? error : new Event('error'))
                }
              },
              onClose: (info) => this.handleClose(info),
            },
          },
          context,
        )

        if (this.closed) {
          // The session gave up (destroy/reconnect) while the transport was connecting
          connection.close(this.closeRequested?.code, this.closeRequested?.reason)
          return
        }

        this.connection = connection

        if (this.closeRequested) {
          connection.close(this.closeRequested.code, this.closeRequested.reason)
          return
        }

        this.onopen?.(new Event('open'))
      } catch (_error) {
        this.onerror?.(new Event('error'))
        this.handleClose({ code: ABNORMAL_CLOSE_CODE, wasClean: false })
      }
    }

    private handleClose(info: ChannelCloseInfo): void {
      if (this.closed) {
        return
      }
      this.closed = true

      const closeInfo: WebSocketCloseInfo = {
        code: info.code ?? ABNORMAL_CLOSE_CODE,
        reason: info.reason ?? '',
        wasClean: info.wasClean ?? false,
      }

      this.onclose?.(Object.assign(new Event('close'), closeInfo))
    }

    send(data: string): void {
      if (!this.closed) {
        this.connection?.send(data)
      }
    }

    close(code?: number, reason?: string): void {
      if (this.closed) {
        return
      }

      if (!this.connection) {
        // Still connecting: remember the request and apply it once connect settles
        this.closeRequested = { code, reason }
        return
      }

      this.connection.close(code, reason)
    }
  }
