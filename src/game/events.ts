// The event plumbing every system shares. A system owns an Emitter for its
// own events (City for the town, Taxes for the books, …); others subscribe to
// the systems they care about. Each channel is typed, so inside
// `switch (event.kind)` TypeScript knows exactly what an event carries, and a
// subscriber's imports show which systems it depends on.
//
// The table of every event, who sends it and who listens, is in
// docs/ARCHITECTURE.md ("Events").

export class Emitter<E> {
  private listeners: ((event: E) => void)[] = []

  on(listener: (event: E) => void) {
    this.listeners.push(listener)
  }

  emit(event: E) {
    for (const listener of this.listeners) listener(event)
  }
}
