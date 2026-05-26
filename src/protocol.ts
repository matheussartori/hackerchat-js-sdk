import type { WireFrame } from './types'

/**
 * Hackerchat frames are newline-delimited JSON. A single socket message may
 * contain multiple frames; split before parsing.
 */
export function parseFrames(raw: string): WireFrame[] {
  const frames: WireFrame[] = []
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    try {
      const parsed = JSON.parse(trimmed) as WireFrame
      if (parsed && typeof parsed.event === 'string') {
        frames.push(parsed)
      }
    } catch {
      // Ignore malformed frames rather than tearing down the socket.
    }
  }
  return frames
}

export function encodeFrame<T>(event: string, message: T): string {
  return JSON.stringify({ event, message })
}
