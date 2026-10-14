import { createHookCall, createNotificationCore, createReadSurface } from "./core";
import { sameValueZero } from "./equality";
import type { Cleanup, ComputedCell, Listener } from "./types";

/**
 * The read contract a computed cell observes — dependency cells are consumed
 * through their published read surface only (workplan boundaries), never
 * through concrete module internals.
 */
export interface DepCell {
  get(): unknown;
  subscribe(listener: Listener<unknown>): Cleanup;
}

/**
 * Creates a derived cell over dependency cells (V6, V7): recomputes when any
 * dependency changes, notifies with the standard (current, previous) pair and
 * SameValueZero skip, and exposes the read surface without write APIs.
 */
export function createComputedCell<R>(
  dependencies: readonly DepCell[],
  derive: (...values: unknown[]) => R,
): ComputedCell<R> {
  const compute = (): R => derive(...dependencies.map((dependency) => dependency.get()));

  let state = compute();
  const initial = state;
  const core = createNotificationCore<R>(() => state);

  const onDependencyChange = (): void => {
    const next = compute();
    if (sameValueZero(next, state)) {
      return;
    }
    const previous = state;
    state = next;
    core.notify(previous, next);
  };

  for (const dependency of dependencies) {
    dependency.subscribe(onDependencyChange);
  }

  return Object.assign(
    createHookCall<R>(() => state, core),
    createReadSurface(() => state, () => initial, core),
  ) as ComputedCell<R>;
}
