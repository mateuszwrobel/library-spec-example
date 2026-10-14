import { describe, expect, it } from "vitest";
import { value } from "@paker/value";
import type { Brand } from "@paker/utils";

// Local conditional-type reader standing in for the future utils `InferValue`
// helper — proves value/computed instances carry the branding contract
// structurally (ADR-0003), wrapper-transparently readable through the brand.
type BrandOf<T> = T extends Brand<infer D> ? D : never;
type Equals<X, Y> = (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? true : false;
type Expect<T extends true> = T;

describe("branding contract — value instances carry their inner data type", () => {
  type User = { name: string };

  const counter$ = value(0);
  const users$ = value<User[]>([]);
  const total$ = value([counter$, users$], (counter, users) => counter + users.length);

  type _CounterIsNumber = Expect<Equals<BrandOf<typeof counter$>, number>>;
  type _UsersIsArray = Expect<Equals<BrandOf<typeof users$>, User[]>>;
  type _ComputedIsNumber = Expect<Equals<BrandOf<typeof total$>, number>>;

  it("plain and computed cells satisfy the brand reader at runtime identity", () => {
    expect(counter$.get()).toBe(0);
    expect(total$.get()).toBe(0);
    counter$.set(3);
    expect(total$.get()).toBe(3);
  });
});
