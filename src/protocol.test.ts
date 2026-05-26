import { describe, expect, it } from 'vitest'
import { encodeFrame, parseFrames } from './protocol'

describe('parseFrames', () => {
  it('parses a single frame', () => {
    const frames = parseFrames('{"event":"message","message":"hi"}')
    expect(frames).toEqual([{ event: 'message', message: 'hi' }])
  })

  it('parses multiple newline-delimited frames', () => {
    const frames = parseFrames(
      '{"event":"a","message":1}\n{"event":"b","message":2}\n',
    )
    expect(frames).toHaveLength(2)
    expect(frames[0]?.event).toBe('a')
    expect(frames[1]?.event).toBe('b')
  })

  it('skips malformed lines without throwing', () => {
    const frames = parseFrames('not-json\n{"event":"ok","message":null}')
    expect(frames).toEqual([{ event: 'ok', message: null }])
  })

  it('skips frames missing an event name', () => {
    expect(parseFrames('{"message":"orphan"}')).toEqual([])
  })
})

describe('encodeFrame', () => {
  it('serializes event + message', () => {
    expect(encodeFrame('message', 'hello')).toBe(
      '{"event":"message","message":"hello"}',
    )
  })
})
