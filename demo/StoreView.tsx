import { actions } from "@paker/actions";
import { store } from "@paker/store";
import type { UserState } from "./types";

/**
 * D2 — the spec's store example: one decorated store, two components.
 * WholeStoreComponent uses the whole-store hook; AtomicStoreComponent uses
 * only the counter property hook (S5 scoping). The atomic component's user
 * count is a non-reactive `data$.get()` read — it renders what the data says
 * at render time but never subscribes, which is exactly what makes its
 * re-renders counter-scoped (see the store test's render-commit witness).
 * The factory never calls `forward`, so it infers with no annotation
 * (parent ruling 2026-10-15).
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
  return <p>{`Atomic: ${counter} (${userStore$.data$.get().length} users)`}</p>;
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
    </div>
  );
}
