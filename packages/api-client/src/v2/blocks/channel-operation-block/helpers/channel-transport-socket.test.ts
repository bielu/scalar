import type {
  ChannelConnectHandlers,
  ChannelConnection,
  ChannelTransport,
  ClientPlugin,
} from '@scalar/oas-utils/helpers'
import { describe, expect, it, vi } from 'vitest'

import { createChannelTransportSocket } from './channel-transport-socket'
import { connectWebSocket } from './connect-websocket'
import { createWebSocketSession } from './websocket-session'

/**
 * A controllable fake channel transport: `resolveConnect` / `rejectConnect` settle the
 * pending connect, `handlers` exposes the callbacks the adapter registered.
 */
const createFakeTransport = () => {
  let handlers: ChannelConnectHandlers | null = null
  let resolveConnect: (connection: ChannelConnection) => void = () => undefined
  let rejectConnect: (error: unknown) => void = () => undefined

  const sent: string[] = []
  const closeCalls: { code?: number; reason?: string }[] = []

  const connection: ChannelConnection = {
    send: (data) => sent.push(data),
    close: (code, reason) => closeCalls.push({ code, reason }),
  }

  const transport: ChannelTransport = {
    kind: 'channel',
    connect: (options) => {
      handlers = options.handlers
      return new Promise<ChannelConnection>((resolve, reject) => {
        resolveConnect = () => resolve(connection)
        rejectConnect = reject
      })
    },
  }

  return {
    transport,
    connection,
    sent,
    closeCalls,
    get handlers() {
      return handlers
    },
    resolveConnect: () => resolveConnect(connection),
    rejectConnect: (error: unknown) => rejectConnect(error),
  }
}

const context = { documentType: 'asyncapi', protocol: 'wss' } as const

describe('createChannelTransportSocket', () => {
  it('opens the session once the transport connect resolves', async () => {
    const fake = createFakeTransport()
    const session = createWebSocketSession()

    session.connect({
      url: 'wss://example.com',
      customWebSocket: createChannelTransportSocket(fake.transport, context),
    })

    expect(session.state).toBe('connecting')

    fake.resolveConnect()
    await vi.waitFor(() => expect(session.state).toBe('open'))
  })

  it('records incoming messages as session frames', async () => {
    const fake = createFakeTransport()
    const session = createWebSocketSession()

    session.connect({
      url: 'wss://example.com',
      customWebSocket: createChannelTransportSocket(fake.transport, context),
    })
    fake.resolveConnect()
    await vi.waitFor(() => expect(session.state).toBe('open'))

    fake.handlers?.onMessage('hello')
    const binary = new ArrayBuffer(4)
    fake.handlers?.onMessage(binary)

    expect(session.frames).toHaveLength(2)
    expect(session.frames[0]).toMatchObject({ direction: 'incoming', data: 'hello', opcode: 'text' })
    expect(session.frames[1]).toMatchObject({ direction: 'incoming', opcode: 'binary' })
  })

  it('sends outgoing messages through the transport connection', async () => {
    const fake = createFakeTransport()
    const session = createWebSocketSession()

    session.connect({
      url: 'wss://example.com',
      customWebSocket: createChannelTransportSocket(fake.transport, context),
    })
    fake.resolveConnect()
    await vi.waitFor(() => expect(session.state).toBe('open'))

    session.send('ping')

    expect(fake.sent).toEqual(['ping'])
    expect(session.frames[0]).toMatchObject({ direction: 'outgoing', data: 'ping' })
  })

  it('propagates transport close info to the session', async () => {
    const fake = createFakeTransport()
    const session = createWebSocketSession()

    session.connect({
      url: 'wss://example.com',
      customWebSocket: createChannelTransportSocket(fake.transport, context),
    })
    fake.resolveConnect()
    await vi.waitFor(() => expect(session.state).toBe('open'))

    fake.handlers?.onClose({ code: 1000, reason: 'done', wasClean: true })

    expect(session.state).toBe('closed')
    expect(session.closeInfo).toEqual({ code: 1000, reason: 'done', wasClean: true })
  })

  it('reports an abnormal close when the transport connect rejects', async () => {
    const fake = createFakeTransport()
    const session = createWebSocketSession()

    session.connect({
      url: 'wss://example.com',
      customWebSocket: createChannelTransportSocket(fake.transport, context),
    })

    fake.rejectConnect(new Error('unreachable'))
    await vi.waitFor(() => expect(session.state).toBe('closed'))

    expect(session.closeInfo).toEqual({ code: 1006, reason: '', wasClean: false })
  })

  it('applies a close requested while the transport is still connecting', async () => {
    const fake = createFakeTransport()
    const session = createWebSocketSession()

    session.connect({
      url: 'wss://example.com',
      customWebSocket: createChannelTransportSocket(fake.transport, context),
    })

    session.close(1000, 'changed my mind')
    expect(session.state).toBe('closing')

    fake.resolveConnect()
    await vi.waitFor(() => expect(fake.closeCalls).toEqual([{ code: 1000, reason: 'changed my mind' }]))
  })
})

describe('connectWebSocket with plugin channel transports', () => {
  const createPlugin = (transport: ChannelTransport, protocols = ['wss']): ClientPlugin => ({
    transports: [{ documentType: 'asyncapi', protocols, transport }],
  })

  /** A socket stand-in that opens immediately, for asserting the built-in path was taken */
  const openingSocket = class {
    binaryType: BinaryType = 'arraybuffer'
    onopen: ((event: Event) => void) | null = null
    onmessage: ((event: MessageEvent) => void) | null = null
    onerror: ((event: Event) => void) | null = null
    onclose: ((event: Event & { code: number; reason: string; wasClean: boolean }) => void) | null = null
    constructor() {
      queueMicrotask(() => this.onopen?.(new Event('open')))
    }
    send(): void {
      // noop
    }
    close(): void {
      // noop
    }
  }

  it('connects through a plugin transport matching the URL protocol', async () => {
    const fake = createFakeTransport()
    const session = createWebSocketSession()

    const pending = connectWebSocket({
      connectionUrl: 'wss://example.com',
      session,
      plugins: [createPlugin(fake.transport)],
    })

    await vi.waitFor(() => expect(fake.handlers).not.toBeNull())
    fake.resolveConnect()

    const result = await pending
    expect(result.ok).toBe(true)
    expect(session.state).toBe('open')
  })

  it('fails the connection when the plugin transport cannot connect', async () => {
    const fake = createFakeTransport()
    const session = createWebSocketSession()

    const pending = connectWebSocket({
      connectionUrl: 'wss://example.com',
      session,
      plugins: [createPlugin(fake.transport)],
    })

    await vi.waitFor(() => expect(fake.handlers).not.toBeNull())
    fake.rejectConnect(new Error('unreachable'))

    const result = await pending
    expect(result.ok).toBe(false)
  })

  it('ignores plugin transports for other protocols', async () => {
    const fake = createFakeTransport()
    const session = createWebSocketSession()

    // The mqtt-only plugin must not claim a wss:// connection
    const connectSpy = vi.spyOn(fake.transport, 'connect')

    const result = await connectWebSocket({
      connectionUrl: 'wss://example.com',
      session,
      plugins: [createPlugin(fake.transport, ['mqtt'])],
      customWebSocket: openingSocket,
    })

    expect(result.ok).toBe(true)
    expect(connectSpy).not.toHaveBeenCalled()
  })

  it('prefers an explicit customWebSocket over plugin transports', async () => {
    const fake = createFakeTransport()
    const session = createWebSocketSession()
    const connectSpy = vi.spyOn(fake.transport, 'connect')

    const result = await connectWebSocket({
      connectionUrl: 'wss://example.com',
      session,
      plugins: [createPlugin(fake.transport)],
      customWebSocket: openingSocket,
    })

    expect(result.ok).toBe(true)
    expect(connectSpy).not.toHaveBeenCalled()
  })
})
