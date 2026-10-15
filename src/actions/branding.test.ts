import { describe, expect, it } from "vitest";
import { actions } from "@paker/actions";
import { store } from "@paker/store";
import { value } from "@paker/value";
import type { Brand } from "@paker/utils";

// Local conditional-type readers standing in for the future utils `Infer*`
// helpers — prove decorated types pass the inner primitive's brand through
// unchanged (ADR-0003) while adding the action-map surface. `InferActions`,
// `InferActionParameters` and `InferActionResult` re-exports land here from
// utils once the helper projections exist (workplans/workplan_utils.md),
// mirroring the value/store precedent — until then these readers are the
// witness.
type BrandOf<T> = T extends Brand<infer D> ? D : never;
type Equals<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? true : false;
type Expect<T extends true> = T;

describe("branding contract — decorated types pass the inner brand through", () => {
  type Profile = { city: string };
  type User = { id: number; profile: Profile };
  type UserState = { data: User[]; counter: number };

  const counter$ = actions(value(0), (value$) => ({
    increment: () => value$.get() + 1,
  }));
  const userStore$ = actions(
    store<UserState>(() => ({ data: [], counter: 0 })),
    () => ({
      loadUsers: async () => ({ data: [] as User[] }),
    }),
  );

  // Value-wrapped: Brand<number> survives decoration untouched.
  type _ValueBrandPreserved = Expect<Equals<BrandOf<typeof counter$>, number>>;
  // Store-wrapped: Brand<UserState> survives decoration untouched.
  type _StoreBrandPreserved = Expect<Equals<BrandOf<typeof userStore$>, UserState>>;
  // Property cells keep their own per-key brands through the decorated type.
  type _DataCellBrand = Expect<Equals<BrandOf<(typeof userStore$)["data$"]>, User[]>>;
  type _CounterCellBrand = Expect<Equals<BrandOf<(typeof userStore$)["counter$"]>, number>>;
  // The hook-call signature stays reachable through the intersection.
  type _HookCallPreserved = Expect<Equals<ReturnType<typeof counter$>, number>>;
  // The action map joins the surface with void/Promise<void> method results.
  type _IncrementSurface = Expect<Equals<(typeof counter$)["increment"], () => void>>;
  type _AsyncSurface = Expect<Equals<(typeof userStore$)["loadUsers"], () => Promise<void>>>;

  it("decoration adds own action members without mutating the wrapped primitive", () => {
    const inner$ = value(5);
    const decorated$ = actions(inner$, (value$) => ({
      nudge: () => value$.get() + 1,
    }));

    expect(typeof decorated$.nudge).toBe("function");
    expect(Object.hasOwn(decorated$, "nudge")).toBe(true);
    expect(decorated$).not.toBe(inner$);
    expect("nudge" in inner$).toBe(false); // the wrapped primitive is untouched

    decorated$.nudge();
    expect(inner$.get()).toBe(6); // one state owner: the cell (composition root)
    expect(decorated$.get()).toBe(6);
  });
});
