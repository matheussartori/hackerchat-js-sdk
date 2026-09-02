import { Emitter, type Unsubscribe } from './emitter'
import { encodeFrame, parseFrames } from './protocol'
import type {
  ChatMessage,
  ConnectionStatus,
  ServerEventMap,
  User,
} from './types'

export interface HackerchatClientOptions {
  /** Full WebSocket URL, e.g. `ws://localhost:9898`. */
  url: string
  /** Optional custom WebSocket constructor (useful for tests or Node). */
  webSocketImpl?: typeof WebSocket
}

interface LifecycleEventMap {
  open: void
  close: { code: number; reason: string }
  error: Event
  status: ConnectionStatus
}

type AllEvents = ServerEventMap & LifecycleEventMap

/**
 * Framework-agnostic Hackerchat client. Wraps a WebSocket connection and
 * exposes a typed pub/sub API for both server events and connection lifecycle.
 */
export class HackerchatClient {
  private readonly url: string
  private readonly WebSocketCtor: typeof WebSocket
  private readonly emitter = new Emitter<AllEvents>()
  private socket: WebSocket | null = null
  private _status: ConnectionStatus = 'idle'
  private joinPayload: { userName: string; roomId: string } | null = null

  constructor(options: HackerchatClientOptions) {
    this.url = options.url
    const impl = options.webSocketImpl ?? (globalThis as { WebSocket?: typeof WebSocket }).WebSocket
    if (!impl) {
      throw new Error(
        'No WebSocket implementation available. Pass `webSocketImpl` (e.g. the `ws` package) in non-browser environments.',
      )
    }
    this.WebSocketCtor = impl
  }

  get status(): ConnectionStatus {
    return this._status
  }

  /**
   * Open the socket. Resolves when the connection is open, rejects on error
   * or close before open.
   */
  connect(): Promise<void> {
    if (this.socket && (this._status === 'open' || this._status === 'connecting')) {
      return Promise.resolve()
    }
    this.setStatus('connecting')
    const socket = new this.WebSocketCtor(this.url)
    this.socket = socket

    return new Promise((resolve, reject) => {
      const onOpen = () => {
        socket.removeEventListener('error', onErrorOnce)
        this.setStatus('open')
        this.emitter.emit('open', undefined)
        if (this.joinPayload) {
          this.sendRaw('joinRoom', this.joinPayload)
        }
        resolve()
      }
      const onErrorOnce = (event: Event) => {
        socket.removeEventListener('open', onOpen)
        reject(event)
      }
      socket.addEventListener('open', onOpen, { once: true })
      socket.addEventListener('error', onErrorOnce, { once: true })

      socket.addEventListener('message', (event) => {
        if (this.socket !== socket) return
        this.handleMessage(event)
      })
      socket.addEventListener('error', (event) => {
        if (this.socket !== socket) return
        this.emitter.emit('error', event)
      })
      socket.addEventListener('close', (event) => {
        if (this.socket !== socket) return
        this.setStatus('closed')
        this.socket = null
        this.emitter.emit('close', {
          code: (event as CloseEvent).code ?? 0,
          reason: (event as CloseEvent).reason ?? '',
        })
      })
    })
  }

  /** Join (or create) a room. Safe to call before or after `connect()`. */
  joinRoom(userName: string, roomId: string): void {
    this.joinPayload = { userName, roomId }
    if (this._status === 'open') {
      this.sendRaw('joinRoom', this.joinPayload)
    }
  }

  /** Broadcast a chat message to the currently joined room. */
  sendMessage(message: string): void {
    if (this._status !== 'open') {
      throw new Error('Cannot send message: socket is not open.')
    }
    this.sendRaw('message', message)
  }

  /** Subscribe to a server event. Returns an unsubscribe function. */
  on<K extends keyof ServerEventMap>(
    event: K,
    listener: (payload: ServerEventMap[K]) => void,
  ): Unsubscribe
  /** Subscribe to a lifecycle event. Returns an unsubscribe function. */
  on<K extends keyof LifecycleEventMap>(
    event: K,
    listener: (payload: LifecycleEventMap[K]) => void,
  ): Unsubscribe
  on<K extends keyof AllEvents>(event: K, listener: (payload: AllEvents[K]) => void): Unsubscribe {
    return this.emitter.on(event, listener)
  }

  off<K extends keyof AllEvents>(event: K, listener: (payload: AllEvents[K]) => void): void {
    this.emitter.off(event, listener)
  }

  /** Close the socket and drop all listeners. */
  disconnect(): void {
    if (this.socket && (this._status === 'open' || this._status === 'connecting')) {
      this.setStatus('closing')
      this.socket.close()
    }
    this.emitter.clear()
    this.joinPayload = null
  }

  private handleMessage(event: MessageEvent): void {
    const raw = typeof event.data === 'string' ? event.data : String(event.data)
    for (const frame of parseFrames(raw)) {
      switch (frame.event) {
        case 'updateUsers':
          this.emitter.emit('updateUsers', frame.message as User[])
          break
        case 'newUserConnected':
          this.emitter.emit('newUserConnected', frame.message as User)
          break
        case 'message':
          this.emitter.emit('message', frame.message as ChatMessage)
          break
        case 'disconnectUser':
          this.emitter.emit('disconnectUser', frame.message as User)
          break
      }
    }
  }

  private sendRaw<T>(event: string, message: T): void {
    this.socket?.send(encodeFrame(event, message))
  }

  private setStatus(next: ConnectionStatus): void {
    if (this._status === next) return
    this._status = next
    this.emitter.emit('status', next)
  }
}
