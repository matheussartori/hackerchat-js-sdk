import { useEffect, useRef, useState } from 'react'
import { useHackerchat } from 'hackerchat-js-sdk/react'

interface ChatProps {
  url: string
  userName: string
  roomId: string
  onLeave: () => void
}

export function Chat({ url, userName, roomId, onLeave }: ChatProps) {
  const { status, users, messages, sendMessage } = useHackerchat({ url, userName, roomId })
  const [draft, setDraft] = useState('')
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight })
  }, [messages])

  return (
    <section>
      <header style={styles.header}>
        <div>
          <strong>#{roomId}</strong> as <em>{userName}</em>
        </div>
        <div style={styles.status} data-status={status}>
          {status}
          <button style={styles.leave} onClick={onLeave}>
            leave
          </button>
        </div>
      </header>

      <div style={styles.layout}>
        <aside style={styles.sidebar}>
          <h3 style={styles.sidebarTitle}>Users ({users.length})</h3>
          <ul style={styles.userList}>
            {users.map((u) => (
              <li key={u.id} style={styles.userItem}>
                {u.userName}
              </li>
            ))}
          </ul>
        </aside>

        <div style={styles.chatColumn}>
          <div ref={logRef} style={styles.log}>
            {messages.length === 0 ? (
              <p style={styles.empty}>No messages yet. Say hi!</p>
            ) : (
              messages.map((m, i) => (
                <div key={i} style={styles.message}>
                  <strong>{m.userName}:</strong> {m.message}
                </div>
              ))
            )}
          </div>

          <form
            style={styles.composer}
            onSubmit={(e) => {
              e.preventDefault()
              const value = draft.trim()
              if (!value || status !== 'open') return
              sendMessage(value)
              setDraft('')
            }}
          >
            <input
              style={styles.input}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={status === 'open' ? 'Type a message…' : 'Connecting…'}
              disabled={status !== 'open'}
            />
            <button style={styles.send} type="submit" disabled={status !== 'open'}>
              Send
            </button>
          </form>
        </div>
      </div>
    </section>
  )
}

const styles: Record<string, React.CSSProperties> = {
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 12px',
    border: '1px solid #ddd',
    borderRadius: 8,
    marginBottom: 12,
  },
  status: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#555' },
  leave: {
    background: 'transparent',
    border: '1px solid #bbb',
    borderRadius: 4,
    padding: '2px 8px',
    cursor: 'pointer',
  },
  layout: { display: 'grid', gridTemplateColumns: '180px 1fr', gap: 12, height: 480 },
  sidebar: { border: '1px solid #ddd', borderRadius: 8, padding: 12, overflow: 'auto' },
  sidebarTitle: { margin: '0 0 8px', fontSize: 13, textTransform: 'uppercase', color: '#666' },
  userList: { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 4 },
  userItem: { fontSize: 14 },
  chatColumn: { display: 'flex', flexDirection: 'column', border: '1px solid #ddd', borderRadius: 8 },
  log: { flex: 1, overflow: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 6 },
  empty: { color: '#888', fontStyle: 'italic' },
  message: { fontSize: 14, lineHeight: 1.4 },
  composer: { display: 'flex', gap: 8, padding: 8, borderTop: '1px solid #eee' },
  input: { flex: 1, padding: '8px 10px', fontSize: 14, border: '1px solid #ccc', borderRadius: 4 },
  send: {
    padding: '8px 14px',
    fontSize: 14,
    background: '#0a0a0a',
    color: 'white',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
  },
}
