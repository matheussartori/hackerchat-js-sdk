import { describe, expect, it, vi } from 'vitest'
import { Emitter } from './emitter'

interface TestEvents {
  ping: string
  pong: number
}

describe('Emitter', () => {
  it('delivers a payload to a subscribed listener', () => {
    const emitter = new Emitter<TestEvents>()
    const listener = vi.fn()

    emitter.on('ping', listener)
    emitter.emit('ping', 'hello')

    expect(listener).toHaveBeenCalledExactlyOnceWith('hello')
  })

  it('delivers to every listener of the same event', () => {
    const emitter = new Emitter<TestEvents>()
    const first = vi.fn()
    const second = vi.fn()

    emitter.on('ping', first)
    emitter.on('ping', second)
    emitter.emit('ping', 'hello')

    expect(first).toHaveBeenCalledOnce()
    expect(second).toHaveBeenCalledOnce()
  })

  it('does not cross the streams between events', () => {
    const emitter = new Emitter<TestEvents>()
    const onPing = vi.fn()

    emitter.on('ping', onPing)
    emitter.emit('pong', 1)

    expect(onPing).not.toHaveBeenCalled()
  })

  it('is a no-op when emitting an event nobody listens to', () => {
    const emitter = new Emitter<TestEvents>()
    expect(() => emitter.emit('ping', 'nobody home')).not.toThrow()
  })

  it('registers a given listener only once', () => {
    const emitter = new Emitter<TestEvents>()
    const listener = vi.fn()

    emitter.on('ping', listener)
    emitter.on('ping', listener)
    emitter.emit('ping', 'hello')

    expect(listener).toHaveBeenCalledOnce()
  })

  it('stops delivery after the returned unsubscribe is called', () => {
    const emitter = new Emitter<TestEvents>()
    const listener = vi.fn()

    const unsubscribe = emitter.on('ping', listener)
    unsubscribe()
    emitter.emit('ping', 'hello')

    expect(listener).not.toHaveBeenCalled()
  })

  it('is idempotent when unsubscribing twice', () => {
    const emitter = new Emitter<TestEvents>()
    const listener = vi.fn()

    const unsubscribe = emitter.on('ping', listener)
    unsubscribe()

    expect(() => unsubscribe()).not.toThrow()
  })

  it('stops delivery after off()', () => {
    const emitter = new Emitter<TestEvents>()
    const listener = vi.fn()

    emitter.on('ping', listener)
    emitter.off('ping', listener)
    emitter.emit('ping', 'hello')

    expect(listener).not.toHaveBeenCalled()
  })

  it('ignores off() for a listener that was never registered', () => {
    const emitter = new Emitter<TestEvents>()
    expect(() => emitter.off('ping', vi.fn())).not.toThrow()
  })

  it('drops every listener on clear()', () => {
    const emitter = new Emitter<TestEvents>()
    const onPing = vi.fn()
    const onPong = vi.fn()

    emitter.on('ping', onPing)
    emitter.on('pong', onPong)
    emitter.clear()
    emitter.emit('ping', 'hello')
    emitter.emit('pong', 1)

    expect(onPing).not.toHaveBeenCalled()
    expect(onPong).not.toHaveBeenCalled()
  })

  it('lets a listener unsubscribe itself mid-emit without skipping siblings', () => {
    const emitter = new Emitter<TestEvents>()
    const second = vi.fn()

    const unsubscribe = emitter.on('ping', () => unsubscribe())
    emitter.on('ping', second)
    emitter.emit('ping', 'hello')

    expect(second).toHaveBeenCalledOnce()
  })
})
