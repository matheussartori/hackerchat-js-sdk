<h1 align="center">Hackerchat JS SDK</h1>

<p align="center">
  JavaScript / TypeScript SDK for Hackerchat Server — framework-agnostic WebSocket client with optional React bindings.
</p>

<p align="center">
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D24-brightgreen?logo=node.js&logoColor=white" alt="Node.js version" /></a>
  <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-6-blue?logo=typescript&logoColor=white" alt="TypeScript" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="License" /></a>
</p>

<p align="center">
  <a href="#overview">Overview</a> ·
  <a href="#install">Install</a> ·
  <a href="#quick-start-vanilla">Quick Start</a> ·
  <a href="#api">API</a> ·
  <a href="#example-app">Example App</a> ·
  <a href="#related-projects">Related Projects</a>
</p>

---

## Overview

Hackerchat JS SDK is a lightweight client library for connecting to a [Hackerchat Server](https://github.com/matheussartori/hackerchat-server) instance. It ships a framework-agnostic WebSocket client plus optional React bindings, so you can wire any existing UI to a Hackerchat server in a few lines.

## Install

```bash
npm install @matheussartori/hackerchat-js-sdk
```

React is an optional peer dependency — only needed if you import `@matheussartori/hackerchat-js-sdk/react`.

## Quick start (vanilla)

```ts
import { HackerchatClient } from '@matheussartori/hackerchat-js-sdk'

const client = new HackerchatClient({ url: 'wss://hackerchatserver.mattsartori.com.br' })

client.on('message', ({ userName, message }) => {
  console.log(`${userName}: ${message}`)
})
client.on('updateUsers', (users) => console.log('users in room:', users))

await client.connect()
client.joinRoom('alice', 'general')
client.sendMessage('Hello, world!')
```

## React

```tsx
import { useHackerchat } from '@matheussartori/hackerchat-js-sdk/react'

export function Chat() {
  const { status, users, messages, sendMessage } = useHackerchat({
    url: 'wss://hackerchatserver.mattsartori.com.br',
    userName: 'alice',
    roomId: 'general',
  })

  // render however you want — the SDK does not impose any UI.
}
```

---

## API

### `new HackerchatClient(options)`

Creates a new client instance. Does **not** open the connection — call `connect()` separately.

```ts
const client = new HackerchatClient({
  url: 'wss://hackerchatserver.mattsartori.com.br',
})
```

**Options**

| Option | Type | Required | Description |
| --- | --- | --- | --- |
| `url` | `string` | Yes | Full WebSocket URL of the Hackerchat server (`ws://` or `wss://`). |
| `webSocketImpl` | `typeof WebSocket` | No | Custom WebSocket constructor. Useful in Node.js (pass the `ws` package) or in tests. Defaults to `globalThis.WebSocket` in browsers. |

---

### `client.connect(): Promise<void>`

Opens the WebSocket connection. Resolves when the connection is established (`open`), rejects if the socket errors or closes before it could open.

Calling `connect()` while already connected or connecting is a no-op — the existing promise resolves immediately.

```ts
await client.connect()
// socket is open, safe to send messages
```

---

### `client.joinRoom(userName, roomId): void`

Registers the user in a chat room. Sends a `joinRoom` frame to the server.

- `userName` — the display name that other participants will see.
- `roomId` — the room identifier. If the room does not exist on the server, it is created automatically.

Safe to call **before** `connect()` — the SDK queues the join payload and sends it as soon as the socket opens. Calling again replaces the queued payload; you can switch rooms by calling `joinRoom` followed by `connect()` on a new instance.

```ts
client.joinRoom('alice', 'general')
```

---

### `client.sendMessage(text): void`

Broadcasts a chat message to the currently joined room. Throws if the socket is not open.

```ts
client.sendMessage('Hello, everyone!')
```

**Throws** `Error` — if the socket status is not `'open'` at the time of the call.

---

### `client.on(event, listener): Unsubscribe`

Subscribes to a server or lifecycle event. Returns a zero-argument function that removes the listener when called.

```ts
const unsub = client.on('message', ({ userName, message }) => {
  appendToLog(`${userName}: ${message}`)
})

// later:
unsub()
```

**Server events**

| Event | Payload | When it fires |
| --- | --- | --- |
| `message` | `{ userName: string; message: string }` | Another user (or you) sends a chat message. |
| `updateUsers` | `User[]` | The server sends the full, up-to-date list of users in the room. Fires on join and whenever someone connects or disconnects. |
| `newUserConnected` | `User` | A new participant joins the room. |
| `disconnectUser` | `User` | A participant leaves or disconnects from the room. |

**Lifecycle events**

| Event | Payload | When it fires |
| --- | --- | --- |
| `open` | `void` | The WebSocket connection opened successfully. |
| `close` | `{ code: number; reason: string }` | The connection closed (clean or unclean). `code` is the [WebSocket close code](https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent/code). |
| `error` | `Event` | A WebSocket error occurred. Typically followed by a `close` event. |
| `status` | `ConnectionStatus` | The internal status changed. Useful for driving UI indicators without subscribing to every individual event. |

**`User` shape**

```ts
interface User {
  id: string       // server-assigned unique ID
  userName: string // display name passed to joinRoom()
}
```

---

### `client.off(event, listener): void`

Removes a previously registered listener. Prefer the unsubscribe function returned by `on()` — `off()` is provided for cases where you stored the listener separately.

```ts
function handleMessage(payload: ChatMessage) { /* … */ }

client.on('message', handleMessage)
// …
client.off('message', handleMessage)
```

---

### `client.disconnect(): void`

Closes the socket and drops **all** registered listeners. Use this for cleanup on page unload or when tearing down a component manually.

```ts
window.addEventListener('beforeunload', () => client.disconnect())
```

---

### `client.status: ConnectionStatus`

Read-only getter. Current state of the connection.

| Value | Meaning |
| --- | --- |
| `'idle'` | `connect()` has not been called yet. |
| `'connecting'` | Socket is being established. |
| `'open'` | Connected and ready to send/receive. |
| `'closing'` | `disconnect()` was called; waiting for the socket to close. |
| `'closed'` | Connection closed (either cleanly or after an error). |

```ts
if (client.status === 'open') {
  client.sendMessage('still here!')
}
```

---

### `useHackerchat(options): UseHackerchatResult`

React hook that manages a `HackerchatClient` for you. The client is created once on mount and torn down (disconnected) on unmount. Re-renders happen only when `status`, `users`, or `messages` change.

**Options**

| Option | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `url` | `string` | Yes | — | WebSocket URL of the server. |
| `userName` | `string` | Yes | — | Display name for the local user. |
| `roomId` | `string` | Yes | — | Room to join on connect. |
| `autoConnect` | `boolean` | No | `true` | Whether to call `connect()` + `joinRoom()` automatically on mount. Set to `false` if you want to trigger the connection yourself via the returned `connect` function. |

**Return value**

| Field | Type | Description |
| --- | --- | --- |
| `status` | `ConnectionStatus` | Current connection state. Mirrors `client.status` but drives re-renders. |
| `users` | `User[]` | Live list of users in the room, kept in sync with `updateUsers` events. |
| `messages` | `ChatMessage[]` | Append-only log of chat messages received since mount. |
| `sendMessage` | `(message: string) => void` | Stable function reference. Calls `client.sendMessage` internally. |
| `connect` | `() => Promise<void>` | Manually open the connection. Only needed when `autoConnect` is `false`. |
| `disconnect` | `() => void` | Manually close the connection. |
| `client` | `HackerchatClient` | The underlying client instance. Use this to subscribe to raw events or for advanced use cases. |

```tsx
import { useHackerchat } from '@matheussartori/hackerchat-js-sdk/react'

export function Chat() {
  const { status, users, messages, sendMessage } = useHackerchat({
    url: 'wss://hackerchatserver.mattsartori.com.br',
    userName: 'alice',
    roomId: 'general',
  })

  return (
    <div>
      <p>Status: {status}</p>
      <ul>
        {messages.map((m, i) => (
          <li key={i}><strong>{m.userName}</strong>: {m.message}</li>
        ))}
      </ul>
      <button onClick={() => sendMessage('Hey!')}>Send</button>
    </div>
  )
}
```

**Deferred connect example** — useful when you want the user to choose a name before connecting:

```tsx
const { status, connect, sendMessage } = useHackerchat({
  url: 'wss://hackerchatserver.mattsartori.com.br',
  userName: inputName,
  roomId: 'lobby',
  autoConnect: false,
})

// connect only after the user submits the form
<button onClick={connect}>Join</button>
```

---

## Example app

A runnable Vite + React demo lives in [`example/`](./example).

```bash
npm install
npm --prefix example install
npm run example
```

Then open <http://localhost:5173>.

## Related Projects

- [hackerchat-server](https://github.com/matheussartori/hackerchat-server) — The WebSocket server this SDK connects to
- [hackerchat-terminal-client](https://github.com/matheussartori/hackerchat-terminal-client) — A terminal-based client for Hackerchat Server

## License

[MIT](./LICENSE) © [Matheus Sartori](https://github.com/matheussartori)
