/**
 * Paker branding contract (ADR-0003) — type-only, zero runtime code.
 *
 * Every Paker instance type carries the inner primitive's data type as a
 * structural phantom brand (`Brand<TData>`). Wrapper modules (value, store,
 * actions, rxjs adapter) add their own layers while keeping the inner data
 * type readable through this single brand, so `Infer*` helpers are
 * conditional-type readers unwrapping any wrapper order.
 *
 * This file exports types only — it emits nothing at runtime. The `Infer*`
 * helper projections are extended from here by the utils lane
 * (workplans/workplan_utils.md); the convention itself is pinned here first
 * because every other module's public type surface depends on it.
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
