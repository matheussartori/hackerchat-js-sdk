import { useState } from 'react'
import { Chat } from './Chat'

const DEFAULT_URL = 'wss://hackerchatserver.mattsartori.com.br'

export function App() {
  const [config, setConfig] = useState<{
    url: string
    userName: string
    roomId: string
  } | null>(null)

  if (config) {
    return (
      <main style={styles.main}>
        <Chat {...config} onLeave={() => setConfig(null)} />
      </main>
    )
  }

  return (
    <main style={styles.main}>
      <JoinForm
        defaultUrl={DEFAULT_URL}
        onSubmit={(values) => setConfig(values)}
      />
    </main>
  )
}

function JoinForm(props: {
  defaultUrl: string
  onSubmit: (values: { url: string; userName: string; roomId: string }) => void
}) {
  const [url, setUrl] = useState(props.defaultUrl)
  const [userName, setUserName] = useState('')
  const [roomId, setRoomId] = useState('general')

  return (
    <form
      style={styles.form}
      onSubmit={(e) => {
        e.preventDefault()
        if (!userName.trim() || !roomId.trim()) return
        props.onSubmit({ url, userName: userName.trim(), roomId: roomId.trim() })
      }}
    >
      <h1 style={{ marginTop: 0 }}>Hackerchat SDK Demo</h1>
      <label style={styles.label}>
        Server URL
        <input style={styles.input} value={url} onChange={(e) => setUrl(e.target.value)} />
      </label>
      <label style={styles.label}>
        Username
        <input
          style={styles.input}
          value={userName}
          onChange={(e) => setUserName(e.target.value)}
          placeholder="alice"
          autoFocus
        />
      </label>
      <label style={styles.label}>
        Room
        <input style={styles.input} value={roomId} onChange={(e) => setRoomId(e.target.value)} />
      </label>
      <button style={styles.button} type="submit">
        Join
      </button>
    </form>
  )
}

const styles: Record<string, React.CSSProperties> = {
  main: {
    fontFamily: 'system-ui, sans-serif',
    maxWidth: 720,
    margin: '40px auto',
    padding: '0 16px',
    color: '#0a0a0a',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    padding: 24,
    border: '1px solid #ddd',
    borderRadius: 8,
  },
  label: { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 14 },
  input: {
    padding: '8px 10px',
    fontSize: 14,
    border: '1px solid #ccc',
    borderRadius: 4,
  },
  button: {
    padding: '10px 14px',
    fontSize: 14,
    background: '#0a0a0a',
    color: 'white',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
  },
}
