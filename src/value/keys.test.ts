import { describe, expect, it, vi } from "vitest";
import { value } from "@paker/value";

type Item = { name: string };

describe("V9 — array key operations are immutable", () => {
  it("setKey produces a new array leaving the previously-read one untouched", () => {
    const a: Item = { name: "a" };
    const b: Item = { name: "b" };
    const c: Item = { name: "c" };
    const d: Item = { name: "d" };
    const users$ = value([a, b, c]);
    const wholeSpy = vi.fn();
    users$.subscribe(wholeSpy);

    const before = users$.get();
    users$.setKey(1, d);
    const after = users$.get();

    expect(users$.getKey(1)).toBe(d);
    expect(after).toEqual([a, d, c]);
    expect(after).not.toBe(before);
    expect(before).toEqual([a, b, c]);
    expect(wholeSpy).toHaveBeenCalledWith(after, before);
  });
});

describe("V10 — subscribeKey fires only for its key", () => {
  it("key-targeted subscribers see only their key's (current, previous)", () => {
    const a: Item = { name: "a" };
    const b: Item = { name: "b" };
    const y: Item = { name: "y" };
    const z: Item = { name: "z" };
    const n: Item = { name: "n" };
    const users$ = value([a, b]);

    const key1Spy = vi.fn();
    const unsubscribeKey1 = users$.subscribeKey(1, key1Spy);
    const key5Spy = vi.fn();
    users$.subscribeKey(5, key5Spy);

    users$.setKey(0, z);
    expect(key1Spy).not.toHaveBeenCalled();

    users$.setKey(1, y);
    expect(key1Spy).toHaveBeenCalledWith(y, b);

    expect(users$.getKey(5)).toBeUndefined();
    users$.setKey(5, n);
    expect(key5Spy).toHaveBeenCalledWith(n, undefined);
    expect(users$.getKey(5)).toBe(n);

    unsubscribeKey1();
    users$.setKey(1, z);
    expect(key1Spy).toHaveBeenCalledTimes(1);
  });
});

describe("V11 — object key operations", () => {
  it("setKey updates one key, leaves others untouched, and notifies key subscribers on add", () => {
    const settings$ = value({ theme: "dark", locale: "en" });

    settings$.setKey("theme", "light");

    expect(settings$.getKey("theme")).toBe("light");
    expect(settings$.get()).toEqual({ theme: "light", locale: "en" });

    const missingSpy = vi.fn();
    settings$.subscribeKey("missing", missingSpy);

    settings$.setKey("missing", 1);

    expect(settings$.getKey("missing")).toBe(1);
    expect(missingSpy).toHaveBeenCalledWith(1, undefined);
  });
});
