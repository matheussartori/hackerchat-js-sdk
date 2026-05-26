export type Listener<T> = (payload: T) => void
export type Unsubscribe = () => void

/**
 * Tiny typed pub/sub. Returns an unsubscribe handle from `on` so callers do
 * not need to keep a reference to the original listener function.
 */
export class Emitter<EventMap> {
  private readonly listeners = new Map<keyof EventMap, Set<Listener<unknown>>>()

  on<K extends keyof EventMap>(event: K, listener: Listener<EventMap[K]>): Unsubscribe {
    let set = this.listeners.get(event)
    if (!set) {
      set = new Set()
      this.listeners.set(event, set)
    }
    set.add(listener as Listener<unknown>)
    return () => this.off(event, listener)
  }

  off<K extends keyof EventMap>(event: K, listener: Listener<EventMap[K]>): void {
    this.listeners.get(event)?.delete(listener as Listener<unknown>)
  }

  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
    const set = this.listeners.get(event)
    if (!set) return
    for (const listener of set) {
      (listener as Listener<EventMap[K]>)(payload)
    }
  }

  clear(): void {
    this.listeners.clear()
  }
}
