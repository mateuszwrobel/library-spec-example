import { actions } from "@paker/actions";
import { store } from "@paker/store";
import type { UserState } from "./types";

/**
 * D2 — the spec's store example: one decorated store, the spec's two
 * components plus the demo's scoping witness. WholeStoreComponent uses the
 * whole-store hook; AtomicStoreComponent is spec-verbatim — atomic means
 * per-property subscriptions (counter$ and data$ both as hooks), not the
 * absence of them. CounterOnlyComponent is the S5 scoping leg: a single
 * property-cell subscriber. The factory never calls `forward`, so it infers
 * with no annotation (parent ruling 2026-10-15).
 */

export const userStore$ = actions(store<UserState>(() => ({ data: [], counter: 0 })), (cells$) => ({
  incrementCounter: () => {
    cells$.counter$.set(cells$.counter$.get() + 1);
  },
}));

export function WholeStoreComponent() {
  const state = userStore$();
  return <p>{`Whole: ${state.counter} (${state.data.length} users)`}</p>;
}

export function AtomicStoreComponent() {
  const counter = userStore$.counter$();
  const users = userStore$.data$();
  return <p>{`Atomic: ${counter} (${users.length} users)`}</p>;
}

/** counter-only subscriber — S5 scoping leg (demo witness, one property hook). */
export function CounterOnlyComponent() {
  const counter = userStore$.counter$();
  return <p>{`Counter only: ${counter}`}</p>;
}

export function StorePage() {
  return (
    <div>
      <h2>/store</h2>
      <button type="button" onClick={() => userStore$.incrementCounter()}>
        incrementCounter
      </button>
      <WholeStoreComponent />
      <AtomicStoreComponent />
      <CounterOnlyComponent />
    </div>
  );
}
