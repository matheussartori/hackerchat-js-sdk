export interface User {
  id: string
  userName: string
}

export interface ChatMessage {
  userName: string
  message: string
}

export interface ServerEventMap {
  updateUsers: User[]
  newUserConnected: User
  message: ChatMessage
  disconnectUser: User
}

export type ServerEventName = keyof ServerEventMap

export interface WireFrame<T = unknown> {
  event: string
  message: T
}

export type ConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'open'
  | 'closing'
  | 'closed'
