import { describe, expect, it, vi } from "vitest";
import { value } from "@paker/value";

type User = { name?: string };

describe("V6 — computed reacts to every dependency", () => {
  it("recomputes and notifies on each dependency change", () => {
    const counter$ = value(0);
    const users$ = value<User[]>([]);
    const total$ = value([counter$, users$], (counter, users) => counter + users.length);

    const seen: Array<[number, number]> = [];
    total$.subscribe((current, previous) => seen.push([current, previous]));

    counter$.set(2);
    expect(total$.get()).toBe(2);
    expect(seen).toEqual([[2, 0]]);

    users$.set([{}, {}, {}] as User[]);
    expect(total$.get()).toBe(5);
    expect(seen).toEqual([
      [2, 0],
      [5, 2],
    ]);
  });

  it("an equal recomputation stays silent", () => {
    const counter$ = value(1);
    const squared$ = value([counter$], (counter) => counter * counter);
    const spy = vi.fn();
    squared$.subscribe(spy);

    counter$.set(-1); // dependency changes; recomputation yields the equal value

    expect(squared$.get()).toBe(1);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("V7 — computed exposes read APIs only", () => {
  const counter$ = value(0);
  const users$ = value<User[]>([]);
  const total$ = value([counter$, users$], (counter, users) => counter + users.length);

  it("reads like a value: get, getInitial, subscribe, and key-targeted reads", () => {
    const spy = vi.fn();
    const unsubscribe = total$.subscribe(spy);
    expect(total$.get()).toBe(0);
    expect(total$.getInitial()).toBe(0);

    // key-targeted reads over derived data that supports them
    const settings$ = value({ nested: { deep: "a" } });
    const mirrored$ = value([settings$], (settings) => ({ ...settings }));
    const keySpy = vi.fn();
    mirrored$.subscribeKey("nested.deep", keySpy);
    expect(mirrored$.getKey("nested.deep")).toBe("a");

    counter$.set(1);
    expect(spy).toHaveBeenCalledWith(1, 0);
    settings$.setKey("nested.deep", "b");
    expect(mirrored$.get()).toEqual({ nested: { deep: "b" } });
    expect(keySpy).toHaveBeenCalledWith("b", "a");

    unsubscribe();
  });

  it("exposes no set, setKey, or reset — at runtime and at compile time", () => {
    const members = total$ as unknown as Record<string, unknown>;
    expect(members["set"]).toBeUndefined();
    expect(members["setKey"]).toBeUndefined();
    expect(members["reset"]).toBeUndefined();
  });

  it("write-API attempts are compile-time failures (pinned by typecheck gate)", () => {
    // Never invoked — each @ts-expect-error pins exactly one failing
    // statement; the typecheck gate fails if any line stops erroring.
    const attempts = (): void => {
      // @ts-expect-error — computed cells expose no set
      total$.set(1);
      // @ts-expect-error — computed cells expose no setKey
      total$.setKey("x", 1);
      // @ts-expect-error — computed cells expose no reset
      total$.reset();
    };
    expect(typeof attempts).toBe("function");
  });
});
