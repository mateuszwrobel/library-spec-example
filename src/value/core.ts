import { useSyncExternalStore } from "react";
import { sameValueZero } from "./equality";
import { readPath, toSegments } from "./paths";
import type { Cleanup, KeyListener, Listener, PathOrKey } from "./types";

/**
 * Notification mechanics of a cell (workplan_value.md, Decisions):
 * listeners fire on change only, never on attach; equality skip is
 * SameValueZero; key-targeted subscribers fire when the value AT their path
 * changes — a deep immutable write churns the leaf and every ancestor
 * identity while siblings stay silent (V10, V13).
 */

interface KeySubscription {
  readonly segments: string[];
  last: unknown;
  readonly listener: KeyListener;
}

export interface NotificationCore<T> {
  subscribe(listener: Listener<T>): Cleanup;
  subscribeKey(pathOrKey: PathOrKey, listener: KeyListener): Cleanup;
  notify(previous: T, next: T): void;
}

export function createNotificationCore<T>(getState: () => T): NotificationCore<T> {
  const listeners = new Set<Listener<T>>();
  const keySubscriptions = new Set<KeySubscription>();

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    subscribeKey(pathOrKey, listener) {
      const segments = toSegments(pathOrKey);
      const subscription: KeySubscription = {
        segments,
        last: readPath(getState(), segments),
        listener,
      };
      keySubscriptions.add(subscription);
      return () => {
        keySubscriptions.delete(subscription);
      };
    },
    notify(previous, next) {
      for (const listener of listeners) {
        listener(next, previous);
      }
      for (const subscription of keySubscriptions) {
        const current = readPath(next, subscription.segments);
        if (!sameValueZero(current, subscription.last)) {
          const last = subscription.last;
          subscription.last = current;
          subscription.listener(current, last);
        }
      }
    },
  };
}

/** The whole read surface of a cell, shared by value and computed cells. */
export interface ReadSurface<T> {
  get: () => T;
  getInitial: () => T;
  subscribe: (listener: Listener<T>) => Cleanup;
  getKey: (pathOrKey: PathOrKey) => unknown;
  subscribeKey: (pathOrKey: PathOrKey, listener: KeyListener) => Cleanup;
}

export function createReadSurface<T>(
  getState: () => T,
  getInitialState: () => T,
  core: NotificationCore<T>,
): ReadSurface<T> {
  return {
    get: getState,
    getInitial: getInitialState,
    subscribe: core.subscribe,
    getKey: (pathOrKey: PathOrKey) => readPath(getState(), toSegments(pathOrKey)),
    subscribeKey: core.subscribeKey,
  };
}

/**
 * The hook-call form (V8): calling the cell inside a component subscribes
 * for the component lifetime via useSyncExternalStore; unmount cleans the
 * subscription up automatically.
 */
export function createHookCall<T>(getState: () => T, core: NotificationCore<T>): () => T {
  return () => useSyncExternalStore(core.subscribe, getState, getState);
}
