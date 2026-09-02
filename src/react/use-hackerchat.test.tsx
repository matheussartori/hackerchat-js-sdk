// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FakeWebSocket, FakeWebSocketCtor } from '../test-support/fake-websocket'
import { useHackerchat, type UseHackerchatOptions } from './use-hackerchat'

const URL = 'wss://chat.example.test'

const baseOptions: UseHackerchatOptions = {
  url: URL,
  userName: 'neo',
  roomId: 'matrix',
}

let originalWebSocket: PropertyDescriptor | undefined

beforeEach(() => {
  FakeWebSocket.reset()
  originalWebSocket = Object.getOwnPropertyDescriptor(globalThis, 'WebSocket')
  Object.defineProperty(globalThis, 'WebSocket', {
    value: FakeWebSocketCtor,
    configurable: true,
    writable: true,
  })
})

afterEach(() => {
  cleanup()
  if (originalWebSocket) Object.defineProperty(globalThis, 'WebSocket', originalWebSocket)
  else Reflect.deleteProperty(globalThis, 'WebSocket')
})

/** Render the hook and settle the handshake. */
async function renderConnected(options: Partial<UseHackerchatOptions> = {}) {
  const view = renderHook(props => useHackerchat(props), {
    initialProps: { ...baseOptions, ...options },
  })
  await waitFor(() => expect(FakeWebSocket.instances.length).toBeGreaterThan(0))
  await act(async () => {
    FakeWebSocket.last.emitOpen()
  })
  return { ...view, socket: FakeWebSocket.last }
}

describe('useHackerchat', () => {
  it('starts with empty state', () => {
    const { result } = renderHook(() => useHackerchat({ ...baseOptions, autoConnect: false }))

    expect(result.current.users).toEqual([])
    expect(result.current.messages).toEqual([])
    expect(result.current.status).toBe('idle')
  })

  it('auto-connects on mount by default', async () => {
    const { result } = await renderConnected()

    expect(result.current.status).toBe('open')
  })

  it('does not connect when autoConnect is false', () => {
    renderHook(() => useHackerchat({ ...baseOptions, autoConnect: false }))

    expect(FakeWebSocket.instances).toHaveLength(0)
  })

  it('joins the configured room once open', async () => {
    const { socket } = await renderConnected()

    expect(socket.sentFrames).toContainEqual({
      event: 'joinRoom',
      message: { userName: 'neo', roomId: 'matrix' },
    })
  })

  it('re-joins when the room changes', async () => {
    const { rerender, socket } = await renderConnected()

    await act(async () => {
      rerender({ ...baseOptions, roomId: 'zion' })
    })

    expect(socket.sentFrames).toContainEqual({
      event: 'joinRoom',
      message: { userName: 'neo', roomId: 'zion' },
    })
  })

  it('keeps the same client instance across re-renders', async () => {
    const { result, rerender } = await renderConnected()
    const first = result.current.client

    await act(async () => {
      rerender({ ...baseOptions, roomId: 'zion' })
    })

    expect(result.current.client).toBe(first)
  })

  it('replaces the roster on updateUsers', async () => {
    const { result, socket } = await renderConnected()

    await act(async () => {
      socket.emitFrame('updateUsers', [
        { id: '1', userName: 'neo' },
        { id: '2', userName: 'trinity' },
      ])
    })

    expect(result.current.users).toEqual([
      { id: '1', userName: 'neo' },
      { id: '2', userName: 'trinity' },
    ])
  })

  it('appends a joining user to the roster', async () => {
    const { result, socket } = await renderConnected()

    await act(async () => {
      socket.emitFrame('updateUsers', [{ id: '1', userName: 'neo' }])
      socket.emitFrame('newUserConnected', { id: '2', userName: 'trinity' })
    })

    expect(result.current.users).toHaveLength(2)
  })

  it('ignores a join for a user already in the roster', async () => {
    const { result, socket } = await renderConnected()

    await act(async () => {
      socket.emitFrame('updateUsers', [{ id: '1', userName: 'neo' }])
      socket.emitFrame('newUserConnected', { id: '1', userName: 'neo' })
    })

    expect(result.current.users).toHaveLength(1)
  })

  it('removes a user on disconnectUser', async () => {
    const { result, socket } = await renderConnected()

    await act(async () => {
      socket.emitFrame('updateUsers', [
        { id: '1', userName: 'neo' },
        { id: '2', userName: 'trinity' },
      ])
      socket.emitFrame('disconnectUser', { id: '2', userName: 'trinity' })
    })

    expect(result.current.users).toEqual([{ id: '1', userName: 'neo' }])
  })

  it('accumulates messages in arrival order', async () => {
    const { result, socket } = await renderConnected()

    await act(async () => {
      socket.emitFrame('message', { userName: 'neo', message: 'first' })
      socket.emitFrame('message', { userName: 'trinity', message: 'second' })
    })

    expect(result.current.messages).toEqual([
      { userName: 'neo', message: 'first' },
      { userName: 'trinity', message: 'second' },
    ])
  })

  it('sends a chat message through the socket', async () => {
    const { result, socket } = await renderConnected()

    act(() => {
      result.current.sendMessage('wake up')
    })

    expect(socket.sentFrames).toContainEqual({ event: 'message', message: 'wake up' })
  })

  it('tracks the connection status through a close', async () => {
    const { result, socket } = await renderConnected()

    await act(async () => {
      socket.emitClose()
    })

    expect(result.current.status).toBe('closed')
  })

  it('exposes an imperative connect for manual mode', async () => {
    const { result } = renderHook(() => useHackerchat({ ...baseOptions, autoConnect: false }))

    const pending = act(async () => {
      const promise = result.current.connect()
      await waitFor(() => expect(FakeWebSocket.instances.length).toBeGreaterThan(0))
      FakeWebSocket.last.emitOpen()
      await promise
    })
    await pending

    expect(result.current.status).toBe('open')
  })

  it('closes the socket on unmount', async () => {
    const { unmount, socket } = await renderConnected()

    unmount()

    expect(socket.closeCalls).toBe(1)
  })

  it('stops updating state after unmount', async () => {
    const { result, unmount, socket } = await renderConnected()
    const before = result.current.messages

    unmount()
    socket.emitFrame('message', { userName: 'ghost', message: 'too late' })

    expect(result.current.messages).toBe(before)
  })
})
