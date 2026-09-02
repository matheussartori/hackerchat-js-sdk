<h1 align="center">Hackerchat JS SDK</h1>

<p align="center">
  JavaScript and TypeScript SDK for Hackerchat Server: a framework-agnostic WebSocket client with optional React bindings.
</p>

<p align="center">
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D18-brightgreen?logo=node.js&logoColor=white" alt="Node.js version" /></a>
  <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-6-blue?logo=typescript&logoColor=white" alt="TypeScript" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="License" /></a>
</p>

<p align="center">
  <a href="#overview">Overview</a> ·
  <a href="#features">Features</a> ·
  <a href="#install">Install</a> ·
  <a href="#quick-start">Quick Start</a> ·
  <a href="#api">API</a> ·
  <a href="#example-app">Example App</a> ·
  <a href="#development">Development</a> ·
  <a href="#related-projects">Related Projects</a>
</p>

---

## Overview

Hackerchat JS SDK is a client library for [Hackerchat Server](https://github.com/matheussartori/hackerchat-server). It handles the WebSocket connection, the wire protocol and the event plumbing, and leaves the interface entirely up to you.

There are two entry points. The default one exports `HackerchatClient`, which works anywhere a `WebSocket` is available and carries no dependencies. The `/react` entry point adds a `useHackerchat` hook that keeps the roster and the message log in component state for you.

## Features

- Framework-agnostic client with no runtime dependencies
- React bindings behind a separate entry point, so nothing React-related is pulled in unless you ask for it
- Typed events for both the chat protocol and the connection lifecycle
- Room joins queued before the socket opens and replayed on connect, including after a reconnect
- ESM build with type declarations and source maps
- Written in TypeScript

## Install

```bash
npm install @matheussartori/hackerchat-js-sdk
```

React is an optional peer dependency. You only need it if you import `@matheussartori/hackerchat-js-sdk/react`.

The SDK uses whatever `WebSocket` the environment provides: the browser one, or the global that Node exposes on recent versions. Where there is none, pass your own through the `webSocketImpl` option, for example the [`ws`](https://github.com/websockets/ws) package.

## Quick start

```ts
import { HackerchatClient } from '@matheussartori/hackerchat-js-sdk'

const client = new HackerchatClient({ url: 'ws://localhost:9898' })

client.on('message', ({ userName, message }) => {
  console.log(`${userName}: ${message}`)
})
client.on('updateUsers', (users) => console.log('users in room:', users))

await client.connect()
client.joinRoom('alice', 'general')
client.sendMessage('Hello, world!')
```

### React

```tsx
import { useHackerchat } from '@matheussartori/hackerchat-js-sdk/react'

export function Chat() {
  const { status, users, messages, sendMessage } = useHackerchat({
    url: 'ws://localhost:9898',
    userName: 'alice',
    roomId: 'general',
  })

  // Render it however you like. The SDK imposes no UI of its own.
}
```

---

## API

### `new HackerchatClient(options)`

Creates a client. It does **not** open the connection; call `connect()` for that.

```ts
const client = new HackerchatClient({
  url: 'ws://localhost:9898',
})
```

**Options**

| Option | Type | Required | Description |
| --- | --- | --- | --- |
| `url` | `string` | Yes | WebSocket URL of the Hackerchat server (`ws://` or `wss://`). |
| `webSocketImpl` | `typeof WebSocket` | No | WebSocket constructor to use instead of `globalThis.WebSocket`. Handy in Node or in tests. |

**Throws** `Error` if no WebSocket implementation is available and none was passed.

---

### `client.connect(): Promise<void>`

Opens the WebSocket connection. The promise resolves once the socket is open, and rejects with the socket's error `Event` if the handshake fails.

Calling it while the client is already open or still connecting does nothing and resolves right away. Calling it after a close opens a fresh socket and replays the last `joinRoom`, which makes it the way to reconnect.

```ts
await client.connect()
// the socket is open, messages can be sent
```

---

### `client.joinRoom(userName, roomId): void`

Registers the user in a room, sending a `joinRoom` frame to the server.

- `userName` is the display name other participants will see.
- `roomId` is the room to join. The server creates it if it does not exist yet.

It is safe to call before `connect()`: the payload is held and sent as soon as the socket opens. Only the latest call is kept, so calling it twice before connecting joins the room named in the second one.

Calling it again on an open connection moves the user to another room. The server takes care of the departure from the previous one. Note that the client keeps no per-room state, so a UI built on top of it has to clear its own message log when switching.

```ts
client.joinRoom('alice', 'general')
```

---

### `client.sendMessage(text): void`

Sends a chat message to the room the client is currently in.

```ts
client.sendMessage('Hello, everyone!')
```

**Throws** `Error` if the connection is not open at the time of the call.

---

### `client.on(event, listener): Unsubscribe`

Subscribes to a chat or lifecycle event. Returns a function that removes the listener when called.

```ts
const unsubscribe = client.on('message', ({ userName, message }) => {
  appendToLog(`${userName}: ${message}`)
})

// later
unsubscribe()
```

**Chat events**

| Event | Payload | When it fires |
| --- | --- | --- |
| `updateUsers` | `User[]` | Right after joining a room, carrying everyone who is already in it. The server does not send it again, so keep the list up to date with the two events below. |
| `newUserConnected` | `User` | Someone joins the room. The server also sends it to the user who just joined. |
| `disconnectUser` | `User` | Someone leaves the room or drops the connection. |
| `message` | `{ userName: string; message: string }` | A chat message arrives. The server echoes your own messages back, so there is no need to add them to the log yourself. |

**Lifecycle events**

| Event | Payload | When it fires |
| --- | --- | --- |
| `open` | `void` | The connection is established. |
| `close` | `{ code: number; reason: string }` | The connection closed, cleanly or not. `code` is the [WebSocket close code](https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent/code). |
| `error` | `Event` | The socket reported an error. A `close` event usually follows. |
| `status` | `ConnectionStatus` | The connection state changed. Useful for driving an indicator without subscribing to each event separately. |

**The `User` shape**

```ts
interface User {
  id: string       // assigned by the server
  userName: string // the name passed to joinRoom()
}
```

---

### `client.off(event, listener): void`

Removes a listener registered earlier. The unsubscribe function returned by `on()` is usually more convenient; `off()` is there for when you already keep a reference to the listener.

```ts
function handleMessage(payload: ChatMessage) { /* … */ }

client.on('message', handleMessage)
client.off('message', handleMessage)
```

---

### `client.disconnect(): void`

Closes the socket and drops every registered listener, along with the queued room. Use it to tear a client down for good.

```ts
window.addEventListener('beforeunload', () => client.disconnect())
```

---

### `client.status: ConnectionStatus`

Read-only. The current state of the connection.

| Value | Meaning |
| --- | --- |
| `'idle'` | `connect()` has not been called yet. |
| `'connecting'` | The socket is being established. |
| `'open'` | Connected, ready to send and receive. |
| `'closing'` | `disconnect()` was called and the socket has not finished closing. |
| `'closed'` | The connection is closed, cleanly or after an error. |

```ts
if (client.status === 'open') {
  client.sendMessage('still here!')
}
```

---

### `useHackerchat(options): UseHackerchatResult`

React hook wrapping a `HackerchatClient`. The client is created once on mount and disconnected on unmount. The component re-renders when `status`, `users` or `messages` change.

The hook keeps the roster in sync on its own: it seeds the list from `updateUsers` on join, then adds and removes entries as `newUserConnected` and `disconnectUser` arrive.

**Options**

| Option | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `url` | `string` | Yes | — | WebSocket URL of the server. Read once, when the client is created. |
| `userName` | `string` | Yes | — | Display name for the local user. |
| `roomId` | `string` | Yes | — | Room to join. Changing it joins the new room on the same connection. |
| `autoConnect` | `boolean` | No | `true` | Whether to connect on mount. Set it to `false` to trigger the connection yourself with the returned `connect`. |

**Return value**

| Field | Type | Description |
| --- | --- | --- |
| `status` | `ConnectionStatus` | Current connection state. Mirrors `client.status` and drives re-renders. |
| `users` | `User[]` | Who is in the room right now. |
| `messages` | `ChatMessage[]` | Messages received since mount, in arrival order. |
| `sendMessage` | `(message: string) => void` | Stable reference. Calls `client.sendMessage`. |
| `connect` | `() => Promise<void>` | Opens the connection. Only needed when `autoConnect` is `false`. |
| `disconnect` | `() => void` | Closes the connection. |
| `client` | `HackerchatClient` | The underlying client, for raw event subscriptions and anything the hook does not cover. |

```tsx
import { useHackerchat } from '@matheussartori/hackerchat-js-sdk/react'

export function Chat() {
  const { status, users, messages, sendMessage } = useHackerchat({
    url: 'ws://localhost:9898',
    userName: 'alice',
    roomId: 'general',
  })

  return (
    <div>
      <p>Status: {status}</p>
      <p>{users.length} online</p>
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

To let the user pick a name before anything is opened, turn `autoConnect` off and connect on submit:

```tsx
const { status, connect, sendMessage } = useHackerchat({
  url: 'ws://localhost:9898',
  userName: inputName,
  roomId: 'lobby',
  autoConnect: false,
})

<button onClick={connect}>Join</button>
```

---

## Example app

A Vite and React demo lives in [`example/`](./example). It asks for a server URL, a name and a room, then opens a chat with a roster and a message log.

```bash
npm install
npm --prefix example install
npm run example
```

Then open <http://localhost:5173>. The demo aliases the package to the sources, so edits to `src/` show up without a rebuild. It defaults to `ws://localhost:9898`, so start a server before joining.

## Development

| Command | Description |
| --- | --- |
| `npm run dev` | Build to `dist/` and rebuild on change |
| `npm run build` | Build once with `tsup` |
| `npm run typecheck` | Type-check without emitting |
| `npm run lint` | Lint `src` with ESLint |
| `npm run lint:fix` | Lint and apply the fixes it can |
| `npm run test:ci` | Run the test suite once |
| `npm run test:watch` | Run the tests in watch mode |
| `npm run test:coverage` | Run the tests and write a coverage report |
| `npm run check:pack` | Check that the npm tarball contains only what it should |
| `npm run example` | Start the demo app |
| `npm run test:page` | Build, then serve `test-page.html` on <http://localhost:4173> for manual checks against a real server |

CI runs lint, typecheck, tests with coverage, the build, the packaging check and `npm audit` on Node 22 and 24.

## Related Projects

- [hackerchat-server](https://github.com/matheussartori/hackerchat-server) — The WebSocket server this SDK connects to
- [hackerchat-terminal-client](https://github.com/matheussartori/hackerchat-terminal-client) — Terminal client for Hackerchat Server

## License

[MIT](./LICENSE) © [Matheus Sartori](https://github.com/matheussartori)
