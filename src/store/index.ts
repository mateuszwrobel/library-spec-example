import type { InferState } from "@paker/utils";
import type { Store } from "./types";
import { createStore } from "./store";

export type { Store } from "./types";

/** Spec-faithful import string (ADR-0003): `InferState` is owned by utils. */
export type { InferState };

/**
 * The object-state store factory (workplan_store.md). Two forms, mirroring
 * `value`:
 *
 * - `store(state)` — holds the given object state; per-key cells decompose it
 *   while whole-state ops stay available (S1–S6).
 * - `store(() => state)` — initializer invoked once at creation, so instances
 *   built from the same function keep per-instance isolation for SSR/tests.
 *
 * Each state property `k` is exposed as `k$`, a full value cell (S1). The
 * store itself is callable as a React hook re-rendering on any property
 * change, while property hooks stay scoped to their key (S5). Whole-store
 * `set` replaces the entire state, applied per changed key — equal-valued
 * keys stay silent at every level (S2); patch semantics belong to the
 * actions lane's apply protocol, not here. `InferState` is re-exported from
 * this entry, owned by utils (ADR-0003).
 */
export function store<T extends object>(stateOrInitializer: T | (() => T)): Store<T> {
  return createStore<T>(
    typeof stateOrInitializer === "function"
      ? (stateOrInitializer as () => T)()
      : stateOrInitializer,
  );
}
