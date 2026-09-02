/**
 * Minimal in-memory WebSocket double. Enough of the DOM `WebSocket` surface
 * for `HackerchatClient` to drive: event listeners, `send`, `close`, plus
 * test-only helpers to script the server side of the conversation.
 */
export class FakeWebSocket implements EventTarget {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSING = 2
  static readonly CLOSED = 3

  /** Every instance created since the last `reset()`, in construction order. */
  static instances: FakeWebSocket[] = []

  static reset(): void {
    FakeWebSocket.instances = []
  }

  static get last(): FakeWebSocket {
    const socket = FakeWebSocket.instances[FakeWebSocket.instances.length - 1]
    if (!socket) throw new Error('No FakeWebSocket has been constructed yet.')
    return socket
  }

  readonly url: string
  readyState: number = FakeWebSocket.CONNECTING
  /** Raw payloads passed to `send()`, in order. */
  readonly sent: string[] = []
  closeCalls = 0

  private readonly listeners = new Map<string, Set<{ fn: EventListener; once: boolean }>>()

  constructor(url: string) {
    this.url = url
    FakeWebSocket.instances.push(this)
  }

  addEventListener(type: string, fn: EventListener, options?: { once?: boolean }): void {
    let set = this.listeners.get(type)
    if (!set) {
      set = new Set()
      this.listeners.set(type, set)
    }
    set.add({ fn, once: options?.once ?? false })
  }

  removeEventListener(type: string, fn: EventListener): void {
    const set = this.listeners.get(type)
    if (!set) return
    for (const entry of set) {
      if (entry.fn === fn) set.delete(entry)
    }
  }

  dispatchEvent(event: Event): boolean {
    const set = this.listeners.get(event.type)
    if (!set) return true
    for (const entry of [...set]) {
      if (entry.once) set.delete(entry)
      entry.fn.call(this, event)
    }
    return true
  }

  send(data: string): void {
    this.sent.push(data)
  }

  close(): void {
    this.closeCalls += 1
    this.readyState = FakeWebSocket.CLOSING
  }

  // --- test-only drivers -------------------------------------------------

  /** Complete the handshake. */
  emitOpen(): void {
    this.readyState = FakeWebSocket.OPEN
    this.dispatchEvent(new Event('open'))
  }

  /** Deliver a raw socket payload (may hold several newline-delimited frames). */
  emitMessage(raw: string): void {
    this.dispatchEvent(Object.assign(new Event('message'), { data: raw }))
  }

  /** Deliver a single already-encoded Hackerchat frame. */
  emitFrame(event: string, message: unknown): void {
    this.emitMessage(JSON.stringify({ event, message }))
  }

  emitError(): void {
    this.dispatchEvent(new Event('error'))
  }

  emitClose(code = 1000, reason = ''): void {
    this.readyState = FakeWebSocket.CLOSED
    this.dispatchEvent(Object.assign(new Event('close'), { code, reason }))
  }

  /** Parsed view of everything the client has sent. */
  get sentFrames(): { event: string; message: unknown }[] {
    return this.sent.map(raw => JSON.parse(raw) as { event: string; message: unknown })
  }
}

/** `FakeWebSocket` typed as a drop-in for the `WebSocket` constructor. */
export const FakeWebSocketCtor = FakeWebSocket as unknown as typeof WebSocket
