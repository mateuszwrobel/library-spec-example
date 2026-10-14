import { describe, expect, it, vi } from "vitest";
import { value } from "@paker/value";

describe("V1 — initializer factories isolate instances", () => {
  it("same initializer function produces independent per-instance state", () => {
    const produced: number[][] = [];
    const init = () => {
      const arr: number[] = [];
      produced.push(arr);
      return arr;
    };
    const valueA$ = value(init);
    const valueB$ = value(init);

    valueA$.set([1]);

    expect(valueB$.get()).toEqual([]);
    expect(valueA$.getInitial()).toBe(produced[0]);
    expect(valueB$.getInitial()).toBe(produced[1]);
    expect(valueA$.getInitial()).not.toBe(valueB$.getInitial());
  });
});

describe("V2 — read, write, and subscribe reports pair", () => {
  it("set and updater set notify with (current, previous)", () => {
    const counter$ = value(0);
    const seen: Array<[number, number]> = [];
    const unsubscribe = counter$.subscribe((current, previous) => {
      seen.push([current, previous]);
    });

    counter$.set(5);
    expect(counter$.get()).toBe(5);
    expect(seen).toEqual([[5, 0]]);

    counter$.set((current) => current + 1);
    expect(counter$.get()).toBe(6);
    expect(seen).toEqual([
      [5, 0],
      [6, 5],
    ]);

    unsubscribe();
  });
});

describe("V3 — set equal to current does not notify", () => {
  it("equal-value set is silent", () => {
    const counter$ = value(5);
    const spy = vi.fn();
    counter$.subscribe(spy);

    counter$.set(5);

    expect(spy).not.toHaveBeenCalled();
  });

  it("equality skip uses SameValueZero: NaN equals NaN, +0 equals -0", () => {
    const nan$ = value(Number.NaN);
    const seen: number[] = [];
    nan$.subscribe((current) => seen.push(current));

    nan$.set(5);
    nan$.set(Number.NaN);
    nan$.set(Number.NaN);

    expect(seen).toEqual([5, Number.NaN]);

    const zero$ = value(0);
    const spy = vi.fn();
    zero$.subscribe(spy);
    zero$.set(-0);
    expect(spy).not.toHaveBeenCalled();
  });

  it("updater set returning an equal value is also silent", () => {
    const counter$ = value(5);
    const spy = vi.fn();
    counter$.subscribe(spy);

    counter$.set((current) => current);

    expect(spy).not.toHaveBeenCalled();
  });
});

describe("V4 — subscribe does not fire immediately and cleanup works", () => {
  it("attach is silent, change delivers the pair, cleanup detaches", () => {
    const counter$ = value(0);
    const seen: Array<[number, number]> = [];
    const unsubscribe = counter$.subscribe((current, previous) => {
      seen.push([current, previous]);
    });

    expect(seen).toEqual([]);

    counter$.set(1);
    expect(seen).toEqual([[1, 0]]);

    unsubscribe();
    counter$.set(2);
    expect(seen).toEqual([[1, 0]]);
  });
});

describe("V5 — reset and getInitial", () => {
  it("reset restores the initial value and notifies subscribers", () => {
    const counter$ = value(3);
    const spy = vi.fn();
    counter$.subscribe(spy);

    expect(counter$.getInitial()).toBe(3);

    counter$.set(10);
    counter$.reset();

    expect(counter$.get()).toBe(3);
    expect(spy).toHaveBeenLastCalledWith(3, 10);
  });
});
