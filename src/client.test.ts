import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HackerchatClient } from './client'
import { FakeWebSocket, FakeWebSocketCtor } from './test-support/fake-websocket'

const URL = 'wss://chat.example.test'

function makeClient() {
  return new HackerchatClient({ url: URL, webSocketImpl: FakeWebSocketCtor })
}

/** Connect and settle the handshake, returning the client and its socket. */
async function connected() {
  const client = makeClient()
  const pending = client.connect()
  FakeWebSocket.last.emitOpen()
  await pending
  return { client, socket: FakeWebSocket.last }
}

beforeEach(() => {
  FakeWebSocket.reset()
})

describe('constructor', () => {
  it('starts idle', () => {
    expect(makeClient().status).toBe('idle')
  })

  it('throws when no WebSocket implementation can be found', () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'WebSocket')
    // @ts-expect-error - deliberately removing the global for this test
    delete globalThis.WebSocket
    try {
      expect(() => new HackerchatClient({ url: URL })).toThrow(/No WebSocket implementation/)
    } finally {
      if (original) Object.defineProperty(globalThis, 'WebSocket', original)
    }
  })

  it('falls back to the global WebSocket when no impl is passed', () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'WebSocket')
    Object.defineProperty(globalThis, 'WebSocket', {
      value: FakeWebSocketCtor,
      configurable: true,
      writable: true,
    })
    try {
      const client = new HackerchatClient({ url: URL })
      void client.connect()
      expect(FakeWebSocket.last.url).toBe(URL)
    } finally {
      if (original) Object.defineProperty(globalThis, 'WebSocket', original)
      else Reflect.deleteProperty(globalThis, 'WebSocket')
    }
  })
})

describe('connect', () => {
  it('opens a socket against the configured url', async () => {
    const { socket } = await connected()
    expect(socket.url).toBe(URL)
  })

  it('walks idle -> connecting -> open', async () => {
    const client = makeClient()
    const seen: string[] = []
    client.on('status', s => seen.push(s))

    const pending = client.connect()
    expect(client.status).toBe('connecting')
    FakeWebSocket.last.emitOpen()
    await pending

    expect(seen).toEqual(['connecting', 'open'])
    expect(client.status).toBe('open')
  })

  it('emits `open` once the handshake completes', async () => {
    const client = makeClient()
    const onOpen = vi.fn()
    client.on('open', onOpen)

    const pending = client.connect()
    FakeWebSocket.last.emitOpen()
    await pending

    expect(onOpen).toHaveBeenCalledOnce()
  })

  it('rejects when the socket errors before opening', async () => {
    const client = makeClient()
    const pending = client.connect()
    FakeWebSocket.last.emitError()

    await expect(pending).rejects.toBeInstanceOf(Event)
  })

  it('does not open a second socket while already connected', async () => {
    const { client } = await connected()
    await client.connect()

    expect(FakeWebSocket.instances).toHaveLength(1)
  })

  it('does not open a second socket while still connecting', async () => {
    const client = makeClient()
    void client.connect()
    void client.connect()

    expect(FakeWebSocket.instances).toHaveLength(1)
  })

  it('reconnects with a fresh socket after a close', async () => {
    const { client, socket } = await connected()
    socket.emitClose()
    expect(client.status).toBe('closed')

    const pending = client.connect()
    FakeWebSocket.last.emitOpen()
    await pending

    expect(FakeWebSocket.instances).toHaveLength(2)
    expect(client.status).toBe('open')
  })
})

describe('joinRoom', () => {
  it('sends the join frame immediately when already open', async () => {
    const { client, socket } = await connected()
    client.joinRoom('neo', 'matrix')

    expect(socket.sentFrames).toEqual([
      { event: 'joinRoom', message: { userName: 'neo', roomId: 'matrix' } },
    ])
  })

  it('replays a join queued before connect once the socket opens', async () => {
    const client = makeClient()
    client.joinRoom('neo', 'matrix')
    expect(FakeWebSocket.instances).toHaveLength(0)

    const pending = client.connect()
    FakeWebSocket.last.emitOpen()
    await pending

    expect(FakeWebSocket.last.sentFrames).toEqual([
      { event: 'joinRoom', message: { userName: 'neo', roomId: 'matrix' } },
    ])
  })

  it('re-joins the last room after a reconnect', async () => {
    const { client, socket } = await connected()
    client.joinRoom('neo', 'matrix')
    socket.emitClose()

    const pending = client.connect()
    FakeWebSocket.last.emitOpen()
    await pending

    expect(FakeWebSocket.last.sentFrames).toEqual([
      { event: 'joinRoom', message: { userName: 'neo', roomId: 'matrix' } },
    ])
  })

  it('keeps only the most recent room', async () => {
    const client = makeClient()
    client.joinRoom('neo', 'matrix')
    client.joinRoom('neo', 'zion')

    const pending = client.connect()
    FakeWebSocket.last.emitOpen()
    await pending

    expect(FakeWebSocket.last.sentFrames).toEqual([
      { event: 'joinRoom', message: { userName: 'neo', roomId: 'zion' } },
    ])
  })
})

describe('sendMessage', () => {
  it('encodes the message as a frame', async () => {
    const { client, socket } = await connected()
    client.sendMessage('wake up')

    expect(socket.sent).toEqual(['{"event":"message","message":"wake up"}'])
  })

  it('throws when the socket is not open', () => {
    expect(() => makeClient().sendMessage('too early')).toThrow(/socket is not open/)
  })

  it('throws after the socket has closed', async () => {
    const { client, socket } = await connected()
    socket.emitClose()

    expect(() => client.sendMessage('too late')).toThrow(/socket is not open/)
  })
})

describe('incoming frames', () => {
  it('emits `message` for a chat frame', async () => {
    const { client, socket } = await connected()
    const onMessage = vi.fn()
    client.on('message', onMessage)

    socket.emitFrame('message', { userName: 'trinity', message: 'follow me' })

    expect(onMessage).toHaveBeenCalledExactlyOnceWith({
      userName: 'trinity',
      message: 'follow me',
    })
  })

  it('emits `updateUsers` with the full roster', async () => {
    const { client, socket } = await connected()
    const onUsers = vi.fn()
    client.on('updateUsers', onUsers)

    socket.emitFrame('updateUsers', [{ id: '1', userName: 'neo' }])

    expect(onUsers).toHaveBeenCalledExactlyOnceWith([{ id: '1', userName: 'neo' }])
  })

  it('emits `newUserConnected` and `disconnectUser`', async () => {
    const { client, socket } = await connected()
    const onJoin = vi.fn()
    const onLeave = vi.fn()
    client.on('newUserConnected', onJoin)
    client.on('disconnectUser', onLeave)

    socket.emitFrame('newUserConnected', { id: '2', userName: 'trinity' })
    socket.emitFrame('disconnectUser', { id: '2', userName: 'trinity' })

    expect(onJoin).toHaveBeenCalledExactlyOnceWith({ id: '2', userName: 'trinity' })
    expect(onLeave).toHaveBeenCalledExactlyOnceWith({ id: '2', userName: 'trinity' })
  })

  it('fans out several frames arriving in one socket payload', async () => {
    const { client, socket } = await connected()
    const onMessage = vi.fn()
    client.on('message', onMessage)

    socket.emitMessage(
      '{"event":"message","message":{"userName":"neo","message":"a"}}\n' +
        '{"event":"message","message":{"userName":"neo","message":"b"}}',
    )

    expect(onMessage).toHaveBeenCalledTimes(2)
  })

  it('ignores unknown event names', async () => {
    const { client, socket } = await connected()
    const onMessage = vi.fn()
    client.on('message', onMessage)

    expect(() => socket.emitFrame('somethingElse', {})).not.toThrow()
    expect(onMessage).not.toHaveBeenCalled()
  })

  it('survives a malformed payload without tearing down the socket', async () => {
    const { client, socket } = await connected()
    const onMessage = vi.fn()
    client.on('message', onMessage)

    socket.emitMessage('}{ not json')
    socket.emitFrame('message', { userName: 'neo', message: 'still here' })

    expect(client.status).toBe('open')
    expect(onMessage).toHaveBeenCalledOnce()
  })

  it('coerces non-string payloads before parsing', async () => {
    const { client, socket } = await connected()
    const onMessage = vi.fn()
    client.on('message', onMessage)

    socket.dispatchEvent(
      Object.assign(new Event('message'), {
        data: { toString: () => '{"event":"message","message":{"userName":"neo","message":"buf"}}' },
      }),
    )

    expect(onMessage).toHaveBeenCalledExactlyOnceWith({ userName: 'neo', message: 'buf' })
  })
})

describe('lifecycle events', () => {
  it('emits `error` for a post-handshake socket error', async () => {
    const { client, socket } = await connected()
    const onError = vi.fn()
    client.on('error', onError)

    socket.emitError()

    expect(onError).toHaveBeenCalledOnce()
  })

  it('emits `close` with the code and reason', async () => {
    const { client, socket } = await connected()
    const onClose = vi.fn()
    client.on('close', onClose)

    socket.emitClose(1006, 'gone')

    expect(onClose).toHaveBeenCalledExactlyOnceWith({ code: 1006, reason: 'gone' })
  })

  it('ignores events from a socket the client has already replaced', async () => {
    const { client, socket: stale } = await connected()
    stale.emitClose()

    const pending = client.connect()
    FakeWebSocket.last.emitOpen()
    await pending

    const onMessage = vi.fn()
    client.on('message', onMessage)
    stale.emitFrame('message', { userName: 'ghost', message: 'from the past' })

    expect(onMessage).not.toHaveBeenCalled()
    expect(client.status).toBe('open')
  })

  it('stops notifying a listener removed with off()', async () => {
    const { client, socket } = await connected()
    const onMessage = vi.fn()

    client.on('message', onMessage)
    client.off('message', onMessage)
    socket.emitFrame('message', { userName: 'neo', message: 'hi' })

    expect(onMessage).not.toHaveBeenCalled()
  })
})

describe('disconnect', () => {
  it('closes the underlying socket and reports `closing`', async () => {
    const { client, socket } = await connected()
    client.disconnect()

    expect(socket.closeCalls).toBe(1)
    expect(client.status).toBe('closing')
  })

  it('drops every listener', async () => {
    const { client, socket } = await connected()
    const onMessage = vi.fn()
    client.on('message', onMessage)

    client.disconnect()
    socket.emitFrame('message', { userName: 'neo', message: 'hi' })

    expect(onMessage).not.toHaveBeenCalled()
  })

  it('forgets the pending room so a later connect does not re-join', async () => {
    const { client, socket } = await connected()
    client.joinRoom('neo', 'matrix')
    client.disconnect()
    socket.emitClose()

    const pending = client.connect()
    FakeWebSocket.last.emitOpen()
    await pending

    expect(FakeWebSocket.last.sent).toEqual([])
  })

  it('is safe to call when never connected', () => {
    const client = makeClient()
    expect(() => client.disconnect()).not.toThrow()
    expect(client.status).toBe('idle')
  })
})
