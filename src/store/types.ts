import type { Brand } from "@paker/utils";
import type { Cleanup, Listener, ValueCell } from "@paker/value";

/**
 * An object state decomposed into per-key value cells with a coherent
 * whole-state view (workplan_store.md).
 *
 * Every state property `k` is exposed as a `$`-suffixed member `k$` carrying
 * the full value contract (S1); the whole-state surface keeps
 * `get`/`getInitial`/`set`/`reset`/`subscribe` and the React hook call. The
 * `$` suffix keeps cell names disjoint from whole-state method names, so a
 * state key like `get` never collides with `get()` (risk: name collisions).
 *
 * Branded with the whole state shape (ADR-0003) so `InferState` reads it
 * wrapper-transparently; property cells carry their own per-key brand through
 * the value contract.
 */
export type Store<T extends object> = Brand<T> & {
  /** React hook call — re-renders on any property change (S5). */
  (): T;
  /** Whole-state snapshot; identity stays stable between changes. */
  get(): T;
  /** The complete initial state object, pristine after any mutation (S4). */
  getInitial(): T;
  /**
   * Applies per changed key (S2): keys absent from the patch or holding a
   * SameValueZero-equal value stay silent at every level; store-level
   * subscribers fire exactly once for the whole operation.
   */
  set(patch: Partial<T>): void;
  /** Restores every property to initial, one store-level notification (S4). */
  reset(): void;
  /**
   * Whole-state listener: fires once per property change or once per
   * whole-store operation with (current, previous) snapshots (S2, S3);
   * silent on attach; the returned cleanup detaches.
   */
  subscribe(listener: Listener<T>): Cleanup;
} & {
  [K in keyof T & string as `${K}$`]: ValueCell<T[K]>;
};
