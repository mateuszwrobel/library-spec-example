import { createHookCall, createNotificationCore, createReadSurface } from "./core";
import { sameValueZero } from "./equality";
import { toSegments, writePath } from "./paths";
import type { PathOrKey, ValueCell } from "./types";

/**
 * Creates a mutable value cell (V1–V5, V9–V15). `initial` is the state
 * captured at creation — for initializer-form cells the factory was already
 * invoked once by the entry point, so each instance owns its value (V1).
 */
export function createValueCell<T>(initial: T): ValueCell<T> {
  let state = initial;
  const core = createNotificationCore<T>(() => state);

  const commit = (next: T): void => {
    if (sameValueZero(next, state)) {
      return;
    }
    const previous = state;
    state = next;
    core.notify(previous, next);
  };

  const set = (nextOrUpdater: T | ((current: T) => T)): void => {
    commit(typeof nextOrUpdater === "function" ? (nextOrUpdater as (current: T) => T)(state) : nextOrUpdater);
  };

  const setKey = (pathOrKey: PathOrKey, next: unknown): void => {
    const write = writePath(state, toSegments(pathOrKey), next);
    if (write.changed) {
      commit(write.value as T);
    }
  };

  const reset = (): void => {
    commit(initial);
  };

  return Object.assign(createHookCall<T>(() => state, core), createReadSurface(() => state, () => initial, core), {
    set,
    setKey,
    reset,
  }) as ValueCell<T>;
}
