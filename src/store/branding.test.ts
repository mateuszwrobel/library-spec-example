import { describe, expect, it } from "vitest";
import { store } from "@paker/store";
import type { Brand } from "@paker/utils";

// Local conditional-type readers standing in for the future utils `InferState`
// helper — prove store instances carry the branding contract structurally
// (ADR-0003): the whole state shape readable through the store brand, per-key
// data types readable through the property-cell brands.
type BrandOf<T> = T extends Brand<infer D> ? D : never;
type Equals<X, Y> = (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? true : false;
type Expect<T extends true> = T;

describe("branding contract — store instances carry the whole state shape", () => {
  type Profile = { city: string };
  type User = { id: number; profile: Profile };
  type UserState = { data: User[]; counter: number };

  const userStore$ = store<UserState>(() => ({ data: [], counter: 0 }));

  // The store brand reads the complete state shape (stands in for InferState).
  type _StoreIsWholeState = Expect<Equals<BrandOf<typeof userStore$>, UserState>>;
  // Property cells are branded value primitives over their key's data type.
  type _DataCellIsUsers = Expect<Equals<BrandOf<typeof userStore$["data$"]>, User[]>>;
  type _CounterCellIsNumber = Expect<Equals<BrandOf<typeof userStore$["counter$"]>, number>>;

  // Generic inference: plain-object form and initializer form both yield the shape.
  const objectStore$ = store({ theme: "dark", count: 3 });
  type _ObjectFormInferred = Expect<
    Equals<BrandOf<typeof objectStore$>, { theme: string; count: number }>
  >;
  const initializerStore$ = store(() => ({ list: [1, 2, 3], flag: false }));
  type _InitializerFormInferred = Expect<
    Equals<BrandOf<typeof initializerStore$>, { list: number[]; flag: boolean }>
  >;

  it("branded store and cells deliver the same state at runtime identity", () => {
    expect(userStore$.get()).toEqual({ data: [], counter: 0 });
    userStore$.counter$.set(2);
    expect(userStore$.get()).toEqual({ data: [], counter: 2 });
    expect(userStore$.counter$.get()).toBe(2);
    expect(objectStore$.get()).toEqual({ theme: "dark", count: 3 });
    expect(initializerStore$.get()).toEqual({ list: [1, 2, 3], flag: false });
  });
});
