import type { InferActionParameters, InferActions, InferActionResult } from "@paker/utils";
import type { Store } from "@paker/store";
import type { ValueCell } from "@paker/value";
import { createActions } from "./actions";
import type { ActionFactory, AnyAction, DecoratedStore, DecoratedValue } from "./types";

export type { ActionFactory, ActionsSurface, AnyAction, DecoratedStore, DecoratedValue } from "./types";

/**
 * Spec-faithful import strings (ADR-0003): the action projections are owned
 * by utils and re-exported here.
 */
export type { InferActionParameters, InferActions, InferActionResult };

/**
 * The actions decorator (workplan_actions.md). Two primitive forms, resolved
 * by the wrapped contract:
 *
 * - `actions(valueCell, factory)` — a value cell decorated with typed action
 *   methods; a returned defined value applies as the next value (A3), a
 *   returned nothing never applies so direct writes stay the mutation path
 *   (A2).
 * - `actions(storeCell, factory)` — a store decorated with typed action
 *   methods; a returned partial patch merges onto the current snapshot and
 *   applies through whole-state `set` semantics — per changed key firing,
 *   untouched keys silent, one store-level notification per operation (A4).
 *
 * The factory receives the wrapped primitive (state properties arrive as
 * `$`-suffixed cells for stores) plus `forward`, a same-factory-only call
 * surface with original parameter types; composition runs through the inner
 * action's own apply (A5). A factory that calls `forward` inside a member
 * body declares its map type as the return annotation — the inference that
 * pins `forward`'s signatures cannot also read signatures from bodies that
 * use `forward` (see AnyAction). The decorated instance keeps the wrapped
 * API in full — get/set/reset/getInitial/subscribe, key ops, hook calls,
 * property cells (A1) — adds one method per declared action returning void
 * (or `Promise<void>` resolving after the commit for async actions, A6),
 * passes the inner brand through (ADR-0003), and rejects unknown names or
 * wrong parameter types at compile time (A7). `InferActions`,
 * `InferActionParameters` and `InferActionResult` are re-exported from this
 * entry, owned by utils (ADR-0003).
 */
export function actions<T, A extends { [K in keyof A]: AnyAction }>(
  primitive: ValueCell<T>,
  factory: ActionFactory<ValueCell<T>, A>,
): DecoratedValue<T, A>;
export function actions<S extends object, A extends { [K in keyof A]: AnyAction }>(
  primitive: Store<S>,
  factory: ActionFactory<Store<S>, A>,
): DecoratedStore<S, A>;
export function actions(primitive: unknown, factory: unknown): object {
  return createActions(
    primitive as ValueCell<unknown> | Store<object>,
    factory as (primitive: ValueCell<unknown> | Store<object>, forward: Record<string, AnyAction>) => Record<string, AnyAction>,
  );
}
