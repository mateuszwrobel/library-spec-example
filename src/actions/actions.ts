import type { Store } from "@paker/store";
import type { ValueCell } from "@paker/value";
import type { AnyAction } from "./types";

/** The two wrappable primitive contracts (workplan_actions.md, API). */
type Wrappable = ValueCell<unknown> | Store<object>;

/** Loose action-map view used by the implementation body; public precision lives in ./types. */
type ActionRecord = Record<string, AnyAction>;

/**
 * The apply protocol and forward binding (workplan_actions.md).
 *
 * One behavior: translating an action's result into a state transition. A
 * returned defined value applies ONCE — next value for a value-wrapped
 * primitive (A3: `set`'s own updater form consumes updater results, so the
 * updater's return wins as next value with no re-entry), partial patch merged
 * onto the CURRENT snapshot for a store-wrapped one, applied through whole-
 * state `set` semantics so per-key firing and the once-per-operation
 * store-level notification come from the store contract (A4, S2/S6). A
 * returned nothing NEVER applies — direct writes are the mutation path and
 * exactly one notification results (A2). Thenable results apply after
 * resolution, and the method's `Promise<void>` settles only after the commit
 * (A6); a sync throw or an async rejection propagates with nothing applied
 * (lane decision). `forward` is the same bound surface: void/`Promise<void>`
 * results mean a composed action receives nothing extra, so composition runs
 * through the inner action's own apply (A5).
 */
export function createActions(primitive: Wrappable, factory: (primitive: Wrappable, forward: ActionRecord) => ActionRecord): object {
  // forward === bound: the factory captures this reference, the bound methods
  // land in it after the factory returns, and every forwarded call happens
  // post-decoration — no lazy proxy needed.
  const bound: ActionRecord = {};
  const map = factory(primitive, bound); // a throwing factory propagates; nothing is bound yet

  // Apply strategy is fixed once at decoration from the published contracts:
  // only the value cell carries key operations (Store surfaces state keys as
  // `$`-suffixed cells and has no setKey — the suffix keeps the namespaces
  // disjoint), so `setKey` presence is a contract-capability discriminator,
  // not shape guessing. Computed cells are out of the decorator's contract.
  const store$ = "setKey" in primitive ? null : (primitive as Store<object>);

  const commit = (next: unknown): void => {
    if (next === undefined) {
      return; // returning nothing never applies (A2); also the undefined-resolved async leg
    }
    if (store$ === null) {
      (primitive as ValueCell<unknown>).set(next); // next value — plain or updater form (A3)
    } else {
      store$.set({ ...store$.get(), ...(next as object) }); // patch onto the CURRENT snapshot (A4)
    }
  };

  for (const name of Object.keys(map)) {
    const action = map[name];
    bound[name] = (...args: unknown[]): unknown => {
      const result = action(...args); // a sync throw propagates from the call — nothing applied
      if (result === undefined) {
        return undefined; // void-returning actions never apply (A2)
      }
      if (result instanceof Promise) {
        // async applies after resolve; the returned promise settles AFTER the
        // commit, and a rejection propagates through it applying nothing (A6).
        return result.then(commit);
      }
      commit(result);
      return undefined; // action methods return void (A6/A7)
    };
  }

  // The decorated instance is callable — its hook call delegates to the
  // primitive's hook call — and carries the wrapped API (cells included, same
  // cell objects) plus own action methods. The wrapped primitive is never
  // mutated; the cell stays the single owner of state lifecycle (A1).
  const hookCall = (): unknown => (primitive as () => unknown)();
  return Object.assign(hookCall, primitive, bound);
}
