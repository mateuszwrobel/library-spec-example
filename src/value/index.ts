import type { Brand, InferValue } from "@paker/utils";
import { createValueCell } from "./cell";
import type { DepCell } from "./computed";
import { createComputedCell } from "./computed";
import type { ComputedCell, ValueCell } from "./types";

export type {
  Cleanup,
  ComputedCell,
  KeyListener,
  Listener,
  PathOrKey,
  ReadApi,
  ValueCell,
  WriteApi,
} from "./types";

/** Spec-faithful import string (ADR-0003): `InferValue` is owned by utils. */
export type { InferValue };

/** Inner data types of a dependency-cell tuple, read through the brand. */
type DerivedValues<D extends readonly Brand<unknown>[]> = {
  [K in keyof D]: D[K] extends Brand<infer T> ? T : never;
};

/**
 * The reactive cell factory (workplan_value.md). Three forms:
 *
 * - `value(initial)` — holds the given state (V2–V5).
 * - `value(() => initial)` — initializer invoked once at creation, so
 *   instances built from the same function stay isolated (V1).
 * - `value([dep, ...], (...values) => derived)` — computed cell reacting to
 *   every dependency, read APIs only (V6, V7).
 *
 * Cells are callable as React hooks inside components (V8).
 */
export function value<T>(stateOrInitializer: T | (() => T)): ValueCell<T>;
export function value<const D extends readonly Brand<unknown>[], R>(
  dependencies: D,
  derive: (...values: DerivedValues<D>) => R,
): ComputedCell<R>;
export function value(a: unknown, b?: unknown): ValueCell<unknown> | ComputedCell<unknown> {
  if (b !== undefined) {
    return createComputedCell(
      a as readonly DepCell[],
      b as (...values: unknown[]) => unknown,
    );
  }
  return createValueCell<unknown>(typeof a === "function" ? (a as () => unknown)() : a);
}
