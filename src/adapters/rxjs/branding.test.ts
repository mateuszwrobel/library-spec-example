import { describe, expect, it } from "vitest";
import { rxjs } from "@paker/adapters/rxjs";
import type { EventStage } from "@paker/adapters/rxjs";
import { actions } from "@paker/actions";
import { store } from "@paker/store";
import { value } from "@paker/value";
import type { Brand } from "@paker/utils";
import { tap } from "rxjs/operators";

// Local conditional-type readers standing in for the future utils `Infer*`
// helpers — prove the adapter passes the wrapped primitive's brand through
// unchanged (ADR-0003) while adding the event-method surface. `InferEvents`
// and `InferEventPayload` re-exports land here from utils once the helper
// projections exist (workplans/workplan_utils.md), mirroring the value,
// store, and actions precedent — until then these readers are the witness.
// The projections must resolve from method signatures only: no RxJS type
// may appear in what utils reads (ADR-0002).
type BrandOf<T> = T extends Brand<infer D> ? D : never;
type Equals<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? true : false;
type Expect<T extends true> = T;

describe("branding contract — adapter passes the inner brand through, adds the event surface", () => {
  type Profile = { city: string };
  type User = { id: number; profile: Profile };
  type UserState = { data: User[]; counter: number };
  type UserEvents = {
    FETCH: (amount: number) => EventStage[];
    LOAD: (users: User[]) => EventStage[];
  };

  const counter$ = rxjs(value(0), (value$) => ({
    TOUCH: () => [tap(() => value$.set(1))],
  }));
  const userStore$ = rxjs(
    actions(store<UserState>(() => ({ data: [], counter: 0 })), (userCells$) => ({
      incrementBy: (amount: number) => {
        userCells$.counter$.set(userCells$.counter$.get() + amount);
      },
    })),
    (userCells$, { forward }): UserEvents => ({
      FETCH: (amount: number) => [forward.LOAD(() => [makeUser(amount, "KRK")])],
      LOAD: (users: User[]) => [tap(() => userCells$.data$.set(users))],
    }),
  );

  const makeUser = (id: number, city: string): User => ({ id, profile: { city } });

  // Value-wrapped: Brand<number> survives the event layer untouched.
  type _ValueBrandPreserved = Expect<Equals<BrandOf<typeof counter$>, number>>;
  // Actions+events stack: Brand<UserState> passes through both wrappers.
  type _StoreBrandPreserved = Expect<Equals<BrandOf<typeof userStore$>, UserState>>;
  // Property cells keep their per-key brands through the decorated type.
  type _DataCellBrand = Expect<Equals<BrandOf<(typeof userStore$)["data$"]>, User[]>>;
  type _CounterCellBrand = Expect<Equals<BrandOf<(typeof userStore$)["counter$"]>, number>>;
  // The hook-call signature stays reachable through the intersection.
  type _HookCallPreserved = Expect<Equals<ReturnType<typeof counter$>, number>>;
  type _StoreHookPreserved = Expect<Equals<ReturnType<typeof userStore$>, UserState>>;
  // Event methods land with payload-preserving void signatures (the material
  // InferEvents/InferEventPayload projections read from).
  type _FetchSurface = Expect<Equals<(typeof userStore$)["FETCH"], (amount: number) => void>>;
  type _LoadSurface = Expect<Equals<(typeof userStore$)["LOAD"], (users: User[]) => void>>;
  type _TouchSurface = Expect<Equals<(typeof counter$)["TOUCH"], () => void>>;
  // Wrapped action methods stay reachable beside the event surface.
  type _ActionSurfaceIntact = Expect<Equals<(typeof userStore$)["incrementBy"], (amount: number) => void>>;

  it("decoration adds own event members without mutating the wrapped primitive", () => {
    const inner$ = value(5);
    const decorated$ = rxjs(inner$, (value$) => ({
      nudge: () => [tap(() => value$.set(6))],
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
