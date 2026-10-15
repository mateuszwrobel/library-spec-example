/**
 * Paker branding contract (ADR-0003) — type-only, zero runtime code.
 *
 * Every Paker instance type carries the inner primitive's data type as a
 * structural phantom brand (`Brand<TData>`). Wrapper modules (value, store,
 * actions, rxjs adapter) add their own layers while keeping the inner data
 * type readable through this single brand, so `Infer*` helpers are
 * conditional-type readers unwrapping any wrapper order.
 *
 * Action and event maps get their own phantoms for the same reason: a purely
 * structural projection (subtracting known contract members) could not tell
 * an action name apart from a shadowed wrapped member (the actions-lane
 * collision ruling), and would drift with every API addition. So the actions
 * wrapper brands its inferred map (`ActionsBrand`), the adapter brands its
 * inferred event map (`EventsBrand`), and `Infer*` reads each brand
 * position — one owner, any wrapper order (workplans/workplan_utils.md).
 *
 * This file exports types only — it emits nothing at runtime.
 */

declare const PAKER_BRAND: unique symbol;

/**
 * Phantom brand: the required property is never present at runtime — instance
 * types are produced by casts inside each module's factory. Readers extract
 * the inner data type with `T extends Brand<infer D> ? D : never`.
 */
export interface Brand<TData> {
  readonly [PAKER_BRAND]: TData;
}

declare const PAKER_ACTIONS_BRAND: unique symbol;

/**
 * Phantom brand carried by action-decorated instances (the actions wrapper's
 * side of the contract, ADR-0003). It holds the instance's method surface —
 * parameter labels, optionality, and the void/`Promise<void>` apply-protocol
 * returns — so `InferActions` reads the projection the call sites actually
 * see, with no second owner of the mapping.
 */
export interface ActionsBrand<TActions> {
  readonly [PAKER_ACTIONS_BRAND]: TActions;
}

declare const PAKER_EVENTS_BRAND: unique symbol;

/**
 * Phantom brand carried by adapter-decorated instances (the rxjs wrapper's
 * side of the contract, ADR-0003). It holds the `void` event-method surface —
 * pure `(payload) => void` signatures, so no RxJS type can ever appear in an
 * `Infer*` resolution (ADR-0002).
 */
export interface EventsBrand<TEvents> {
  readonly [PAKER_EVENTS_BRAND]: TEvents;
}

/**
 * Inner data type of a value cell (plain or computed), readable at any
 * wrapper depth — `Brand` passes through every wrapper structurally (U1, U6).
 */
export type InferValue<T> = T extends Brand<infer D> ? D : never;

/**
 * Whole state shape of a store, readable at any wrapper depth. Stores brand
 * the complete state object through the same single `Brand` position (U1, U6).
 */
export type InferState<T> = T extends Brand<infer D> ? D : never;

/**
 * Action map of a decorated instance: parameter labels, optional parameters,
 * and the apply-protocol returns (void for sync, `Promise<void>` for async)
 * preserved exactly as the call sites see them (U2, U6).
 */
export type InferActions<T> = T extends ActionsBrand<infer A> ? A : never;

/**
 * Parameter tuple of the named action, labels and optionality intact (U3).
 * `K` is constrained to the inferred action names: an unknown name is a
 * compile-time failure at this call site, never `any` (U5).
 */
export type InferActionParameters<T, K extends keyof InferActions<T>> =
  T extends ActionsBrand<infer A>
    ? K extends keyof A
      ? A[K] extends (...args: infer P) => any
        ? P
        : never
    : never
    : never;

/**
 * Return type of the named action — `void` for sync, `Promise<void>` for
 * async (U3). Unknown names fail at compile time via the constraint (U5).
 */
export type InferActionResult<T, K extends keyof InferActions<T>> =
  T extends ActionsBrand<infer A>
    ? K extends keyof A
      ? A[K] extends (...args: any) => infer R
        ? R
        : never
    : never
    : never;

/**
 * Event map of an adapter-decorated instance: `void` methods with the
 * declared payload tuples, labels preserved, no RxJS type anywhere in the
 * resolution (U4, ADR-0002).
 */
export type InferEvents<T> = T extends EventsBrand<infer E> ? E : never;

/**
 * First payload parameter of the named event (U4). Unknown names fail at
 * compile time via the constraint (U5).
 */
export type InferEventPayload<T, K extends keyof InferEvents<T>> =
  T extends EventsBrand<infer E>
    ? K extends keyof E
      ? E[K] extends (...args: infer P) => any
        ? P[0]
        : never
    : never
    : never;
