import { describe, expect, it } from 'vitest'

import type { ClientPlugin } from './client-plugins'
import {
  type ChannelTransport,
  type HttpTransport,
  normalizeTransportProtocol,
  resolveChannelTransport,
  resolveHttpTransport,
} from './client-transports'

const createTransport = (): HttpTransport => ({
  kind: 'http',
  send: () => new Response('ok'),
})

const createChannelTransport = (): ChannelTransport => ({
  kind: 'channel',
  connect: () => ({
    send: () => undefined,
    close: () => undefined,
  }),
})

describe('normalizeTransportProtocol', () => {
  it('lowercases and trims the protocol', () => {
    expect(normalizeTransportProtocol('  HTTPS  ')).toBe('https')
  })

  it('strips the trailing colon produced by URL.protocol', () => {
    expect(normalizeTransportProtocol('https:')).toBe('https')
  })

  it('returns undefined for missing or blank input', () => {
    expect(normalizeTransportProtocol(undefined)).toBeUndefined()
    expect(normalizeTransportProtocol('')).toBeUndefined()
    expect(normalizeTransportProtocol('   ')).toBeUndefined()
    expect(normalizeTransportProtocol(':')).toBeUndefined()
  })
})

describe('resolveHttpTransport', () => {
  it('returns undefined when no plugin registers a transport', () => {
    const plugins: ClientPlugin[] = [{}, { hooks: {} }]

    expect(resolveHttpTransport({ documentType: 'openapi', protocol: 'https', plugins })).toBeUndefined()
  })

  it('resolves a transport matching the protocol', () => {
    const transport = createTransport()
    const plugins: ClientPlugin[] = [{ transports: [{ protocols: ['http', 'https'], transport }] }]

    expect(resolveHttpTransport({ documentType: 'openapi', protocol: 'https', plugins })).toBe(transport)
  })

  it('matches protocols case-insensitively and ignores trailing colons', () => {
    const transport = createTransport()
    const plugins: ClientPlugin[] = [{ transports: [{ protocols: ['HTTPS:'], transport }] }]

    expect(resolveHttpTransport({ documentType: 'openapi', protocol: 'https:', plugins })).toBe(transport)
  })

  it('does not match a different protocol', () => {
    const plugins: ClientPlugin[] = [{ transports: [{ protocols: ['https'], transport: createTransport() }] }]

    expect(resolveHttpTransport({ documentType: 'openapi', protocol: 'http', plugins })).toBeUndefined()
  })

  it('matches all document types when documentType is omitted', () => {
    const transport = createTransport()
    const plugins: ClientPlugin[] = [{ transports: [{ protocols: ['https'], transport }] }]

    expect(resolveHttpTransport({ documentType: 'openapi', protocol: 'https', plugins })).toBe(transport)
    expect(resolveHttpTransport({ documentType: 'asyncapi', protocol: 'https', plugins })).toBe(transport)
  })

  it('respects the documentType restriction', () => {
    const transport = createTransport()
    const plugins: ClientPlugin[] = [{ transports: [{ documentType: 'asyncapi', protocols: ['https'], transport }] }]

    expect(resolveHttpTransport({ documentType: 'asyncapi', protocol: 'https', plugins })).toBe(transport)
    expect(resolveHttpTransport({ documentType: 'openapi', protocol: 'https', plugins })).toBeUndefined()
  })

  it('returns the first matching transport in plugin order', () => {
    const first = createTransport()
    const second = createTransport()
    const plugins: ClientPlugin[] = [
      { transports: [{ protocols: ['https'], transport: first }] },
      { transports: [{ protocols: ['https'], transport: second }] },
    ]

    expect(resolveHttpTransport({ documentType: 'openapi', protocol: 'https', plugins })).toBe(first)
  })

  it('skips non-matching registrations within the same plugin', () => {
    const transport = createTransport()
    const plugins: ClientPlugin[] = [
      {
        transports: [
          { documentType: 'asyncapi', protocols: ['https'], transport: createTransport() },
          { protocols: ['http'], transport: createTransport() },
          { protocols: ['https'], transport },
        ],
      },
    ]

    expect(resolveHttpTransport({ documentType: 'openapi', protocol: 'https', plugins })).toBe(transport)
  })

  it('returns undefined for a blank protocol', () => {
    const plugins: ClientPlugin[] = [{ transports: [{ protocols: ['https'], transport: createTransport() }] }]

    expect(resolveHttpTransport({ documentType: 'openapi', protocol: '', plugins })).toBeUndefined()
  })

  it('does not resolve a channel transport', () => {
    const plugins: ClientPlugin[] = [{ transports: [{ protocols: ['https'], transport: createChannelTransport() }] }]

    expect(resolveHttpTransport({ documentType: 'openapi', protocol: 'https', plugins })).toBeUndefined()
  })
})

describe('resolveChannelTransport', () => {
  it('resolves a channel transport matching the protocol', () => {
    const transport = createChannelTransport()
    const plugins: ClientPlugin[] = [{ transports: [{ protocols: ['wss', 'mqtt'], transport }] }]

    expect(resolveChannelTransport({ documentType: 'asyncapi', protocol: 'mqtt', plugins })).toBe(transport)
  })

  it('does not resolve an http transport', () => {
    const plugins: ClientPlugin[] = [{ transports: [{ protocols: ['wss'], transport: createTransport() }] }]

    expect(resolveChannelTransport({ documentType: 'asyncapi', protocol: 'wss', plugins })).toBeUndefined()
  })

  it('picks the matching kind when a plugin registers both for the same protocol', () => {
    const httpTransport = createTransport()
    const channelTransport = createChannelTransport()
    const plugins: ClientPlugin[] = [
      {
        transports: [
          { protocols: ['https'], transport: httpTransport },
          { protocols: ['https'], transport: channelTransport },
        ],
      },
    ]

    expect(resolveHttpTransport({ documentType: 'openapi', protocol: 'https', plugins })).toBe(httpTransport)
    expect(resolveChannelTransport({ documentType: 'openapi', protocol: 'https', plugins })).toBe(channelTransport)
  })

  it('respects the documentType restriction', () => {
    const transport = createChannelTransport()
    const plugins: ClientPlugin[] = [{ transports: [{ documentType: 'asyncapi', protocols: ['wss'], transport }] }]

    expect(resolveChannelTransport({ documentType: 'asyncapi', protocol: 'wss', plugins })).toBe(transport)
    expect(resolveChannelTransport({ documentType: 'openapi', protocol: 'wss', plugins })).toBeUndefined()
  })
})
