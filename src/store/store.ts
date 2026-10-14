import { value } from "@paker/value";
import type { Cleanup, Listener, ValueCell } from "@paker/value";
import { useSyncExternalStore } from "react";
import type { Store } from "./types";

/**
 * The decomposition/aggregation mechanism (workplan_store.md).
 *
 * State lives exclusively in the per-key value cells; the whole-state view is
 * a maintained snapshot cache — rebuilt and replaced (never mutated) on each
 * key change — so `get()` identities stay stable between changes for the hook
 * bridge and subscribers observe whole (current, previous) pairs.
 *
 * Store-level listeners are a fan-in of one whole-value subscription per
 * cell. That is what pins the exactly-once rules: the cell contract delivers
 * one whole-value notification per actual change (deep-path fan-out included,
 * V13–V15), so an external property write notifies the store exactly once
 * (S3, S6), and `set`/`reset` wrap the multi-cell write in a batch so the
 * store view fires once for the whole operation (S2, S4).
 */
export function createStore<T extends object>(initialState: T): Store<T> {
  const keys = Object.keys(initialState) as (keyof T & string)[];
  const cells: Record<string, ValueCell<unknown>> = {};

  let snapshot: T = initialState;
  let batching = false;
  const listeners = new Set<Listener<T>>();

  const notify = (current: T, previous: T): void => {
    for (const listener of [...listeners]) listener(current, previous);
  };

  const changeKey = (key: string, current: unknown): void => {
    const previous = snapshot;
    snapshot = { ...snapshot, [key]: current } as T;
    if (!batching) notify(snapshot, previous);
  };

  const batched = (operation: () => void): void => {
    const previous = snapshot;
    batching = true;
    try {
      operation();
    } finally {
      batching = false;
    }
    if (snapshot !== previous) notify(snapshot, previous);
  };

  for (const key of keys) {
    const cell = value<unknown>(initialState[key]);
    cell.subscribe((current) => changeKey(key, current));
    cells[key] = cell;
  }

  const get = (): T => snapshot;

  const getInitial = (): T => initialState;

  const set = (next: T): void => {
    batched(() => {
      for (const key of keys) {
        if (Object.hasOwn(next, key)) cells[key].set(next[key]);
      }
    });
  };

  const reset = (): void => {
    batched(() => {
      for (const key of keys) cells[key].reset();
    });
  };

  const subscribe = (listener: Listener<T>): Cleanup => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  // The store instance IS the hook: calling it inside a component subscribes
  // through the whole-state fan-in and reads the stable snapshot cache (S5).
  const useStoreState = (): T =>
    useSyncExternalStore(
      (onStoreChange) =>
        subscribe(() => {
          onStoreChange();
        }),
      get,
      get,
    );

  const surface: Record<string, unknown> = { get, getInitial, set, reset, subscribe };
  for (const key of keys) {
    surface[`${key}$`] = cells[key];
  }
  // Phantom brand never exists at runtime — instance types are produced by
  // casts inside each module's factory (ADR-0003).
  return Object.assign(useStoreState, surface) as unknown as Store<T>;
}
