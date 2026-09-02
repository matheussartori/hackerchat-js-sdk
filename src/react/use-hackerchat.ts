import { useCallback, useEffect, useMemo, useState } from 'react'
import { HackerchatClient } from '../client'
import type { ChatMessage, ConnectionStatus, User } from '../types'

export interface UseHackerchatOptions {
  url: string
  userName: string
  roomId: string
  /** Auto-connect on mount. Defaults to `true`. */
  autoConnect?: boolean
}

export interface UseHackerchatResult {
  status: ConnectionStatus
  users: User[]
  messages: ChatMessage[]
  sendMessage: (message: string) => void
  connect: () => Promise<void>
  disconnect: () => void
  client: HackerchatClient
}

/**
 * React hook that wraps a {@link HackerchatClient}, exposing the room's
 * user list, message log, and an imperative `sendMessage`.
 *
 * Re-renders when status, users, or messages change. The underlying client
 * is created once and torn down on unmount.
 */
export function useHackerchat(options: UseHackerchatOptions): UseHackerchatResult {
  const { url, userName, roomId, autoConnect = true } = options

  // Lazy state initializer so the client is constructed exactly once per
  // component instance. Changing `url` afterwards does not recreate it.
  const [client] = useState(() => new HackerchatClient({ url }))

  const [status, setStatus] = useState<ConnectionStatus>(client.status)
  const [users, setUsers] = useState<User[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])

  useEffect(() => {
    const unsubStatus = client.on('status', setStatus)
    const unsubUsers = client.on('updateUsers', setUsers)
    const unsubJoin = client.on('newUserConnected', (user) => {
      setUsers((prev) => (prev.some((u) => u.id === user.id) ? prev : [...prev, user]))
    })
    const unsubLeave = client.on('disconnectUser', (user) => {
      setUsers((prev) => prev.filter((u) => u.id !== user.id))
    })
    const unsubMessage = client.on('message', (msg) => {
      setMessages((prev) => [...prev, msg])
    })
    return () => {
      unsubStatus()
      unsubUsers()
      unsubJoin()
      unsubLeave()
      unsubMessage()
    }
  }, [client])

  useEffect(() => {
    client.joinRoom(userName, roomId)
  }, [client, userName, roomId])

  useEffect(() => {
    if (!autoConnect) return
    void client.connect().catch(() => {
      // Errors surface via the `error` and `status` events.
    })
    return () => {
      client.disconnect()
    }
  }, [client, autoConnect])

  const sendMessage = useCallback(
    (message: string) => {
      client.sendMessage(message)
    },
    [client],
  )

  const connect = useCallback(() => client.connect(), [client])
  const disconnect = useCallback(() => client.disconnect(), [client])

  return useMemo(
    () => ({ status, users, messages, sendMessage, connect, disconnect, client }),
    [status, users, messages, sendMessage, connect, disconnect, client],
  )
}
