import type { ActionsBrand } from "@paker/utils";
import type { Store } from "@paker/store";
import type { ValueCell } from "@paker/value";

/**
 * Any function an action-map member may be. `any[]` in this constraint is
 * the deliberate fallback shape for the factory's generic inference: the
 * fallback must never silently widen a real signature. Paired with the
 * homomorphic constraint `{ [K in keyof A]: AnyAction }` on `actions`, an
 * action map that references `forward` inside a member body without pinning
 * its own type makes `A` fall back to `{}` — a loud compile failure at the
 * forward call, never a silently loosened surface. Pin with a factory return
 * type annotation (or a declared map type) when composing through forward.
 */
export type AnyAction = (...args: any[]) => any;

/**
 * The method surface added by decoration — shared by the decorated instance's
 * action methods and the factory's `forward` argument. Call signatures keep
 * the declared parameter tuple (labels and optionality survive through
 * `infer P`), while the result is the apply-protocol return: void for sync
 * actions, `Promise<void>` resolving after the commit for async ones (A6,
 * A7). Forwarded actions report void/`Promise<void>` for the same reason — a
 * composed action receives nothing extra and commits nothing extra;
 * composition runs through the inner action's own apply (A5).
 */
export type ActionsSurface<A> = {
  [K in keyof A]: A[K] extends (...args: infer P) => infer R
    ? (...args: P) => R extends Promise<unknown> ? Promise<void> : void
    : never;
};

/**
 * The action factory contract: receives the wrapped primitive — the value
 * cell itself, or the store whose state properties arrive as `$`-suffixed
 * cells — plus `forward`, and declares the action map (A1, A5). Factories
 * that call `forward` inside a member body pin the map type with a return
 * annotation; see AnyAction for why.
 */
export type ActionFactory<P, A extends { [K in keyof A]: AnyAction }> = (
  primitive: P,
  forward: ActionsSurface<A>,
) => A;

/**
 * A value cell decorated with actions: the full ValueCell API unchanged (A1),
 * Brand<T> passed through (ADR-0003), plus the typed action surface — and the
 * action-map brand (`ActionsBrand`, ADR-0003) so `InferActions` reads this
 * surface wrapper-transparently at any further wrapper depth.
 */
export type DecoratedValue<T, A> = ValueCell<T> & ActionsSurface<A> & ActionsBrand<ActionsSurface<A>>;

/**
 * A store decorated with actions: the full Store API unchanged — whole-state
 * ops and property cells (A1), Brand<S> passed through (ADR-0003), plus the
 * typed action surface and the action-map brand (as in DecoratedValue).
 */
export type DecoratedStore<S extends object, A> = Store<S> &
  ActionsSurface<A> &
  ActionsBrand<ActionsSurface<A>>;
