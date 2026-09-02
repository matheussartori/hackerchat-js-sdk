/**
 * Fail the build if anything that belongs only in the repo would be published
 * to npm — the WebSocket test page, its static server, sources, tests, the
 * example app, coverage reports, tooling config.
 *
 * `npm pack` is the source of truth here, so this catches a bad `files` entry
 * or a new build artifact just as well as a forgotten ignore rule.
 */
import { execFileSync } from 'node:child_process'

/** Only these may ship. Anything else is a leak. */
const ALLOWED = [
  /^dist\//,
  /^README\.md$/,
  /^LICENSE$/,
  /^package\.json$/,
]

const output = execFileSync('npm', ['pack', '--dry-run', '--json'], {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'ignore'],
})

const [result] = JSON.parse(output)
const files = (result?.files ?? []).map(f => f.path)

if (files.length === 0) {
  console.error('check-pack: npm pack reported no files — did the build run?')
  process.exit(1)
}

const leaked = files.filter(path => !ALLOWED.some(rule => rule.test(path)))

if (leaked.length > 0) {
  console.error('check-pack: these files would be published but should not be:\n')
  for (const path of leaked) console.error(`  ${path}`)
  console.error('\nAdd them to .npmignore, or narrow the "files" field in package.json.')
  process.exit(1)
}

console.log(`check-pack: OK — ${files.length} files, nothing unexpected.`)
