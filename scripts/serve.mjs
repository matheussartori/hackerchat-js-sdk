/**
 * Tiny zero-dependency static server for `test-page.html`.
 *
 * The page loads the SDK as a real ES module from `dist/`, which the browser
 * will only do over http(s) — opening the file directly does not work.
 *
 *   node scripts/serve.mjs [port]
 */
import { createServer } from 'node:http'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { extname, join, normalize, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const PORT = Number(process.argv[2] ?? process.env.PORT ?? 4173)

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
}

const server = createServer(async (req, res) => {
  const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0])
  const relative = normalize(urlPath === '/' ? '/test-page.html' : urlPath)
  const filePath = join(ROOT, relative)

  // Never serve outside the package root.
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403).end('Forbidden')
    return
  }

  try {
    const info = await stat(filePath)
    if (!info.isFile()) throw new Error('not a file')
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end(`Not found: ${relative}\n\nDid you run \`npm run build\` first?`)
    return
  }

  res.writeHead(200, {
    'Content-Type': TYPES[extname(filePath)] ?? 'application/octet-stream',
    'Cache-Control': 'no-store',
  })
  createReadStream(filePath).pipe(res)
})

server.listen(PORT, () => {
  console.log(`hackerchat SDK test page: http://localhost:${PORT}/`)
})
