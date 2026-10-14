import { describe, expect, it, vi } from "vitest";
import { value } from "@paker/value";
import type { ValueCell } from "@paker/value";

type Address = { city?: string; zip?: string };
type User = { address?: Address; tag?: string };
type Settings = { user?: User; tag?: string };

function makeSettings$(): ValueCell<Settings> {
  return value<Settings>({ user: { address: { city: "KRK" }, tag: "a" } });
}

describe("V12 — deep-path reads", () => {
  it("dot-delimited paths read nested leaves", () => {
    const settings$ = makeSettings$();
    expect(settings$.getKey("user.address.city")).toBe("KRK");
  });

  it("missing-path reads return undefined without throwing", () => {
    const settings$ = makeSettings$();
    expect(settings$.getKey("user.missing.deep.path")).toBeUndefined();
    expect(settings$.getKey("user.tag.deeper")).toBeUndefined();
    expect(() => settings$.getKey("user.missing.deep.path")).not.toThrow();
  });

  it("direct one-level keys still address top-level members", () => {
    const settings$ = makeSettings$();
    expect(settings$.getKey("user")).toEqual({ address: { city: "KRK" }, tag: "a" });
    expect(settings$.getKey("nope")).toBeUndefined();
  });
});

describe("V13 — deep-path write fires leaf and ancestors, siblings stay silent", () => {
  it("leaf + every ancestor path subscriber fires; siblings stay silent", () => {
    const settings$ = makeSettings$();
    const citySpy = vi.fn();
    const zipSpy = vi.fn();
    const tagSpy = vi.fn();
    const userSpy = vi.fn();
    const addressSpy = vi.fn();
    const wholeSpy = vi.fn();

    settings$.subscribeKey("user.address.city", citySpy);
    settings$.subscribeKey("user.address.zip", zipSpy);
    settings$.subscribeKey("user.tag", tagSpy);
    settings$.subscribeKey("user", userSpy);
    settings$.subscribeKey("user.address", addressSpy);
    settings$.subscribe(wholeSpy);

    const before = settings$.get();
    settings$.setKey("user.address.city", "WAW");
    const after = settings$.get();

    expect(citySpy).toHaveBeenCalledWith("WAW", "KRK");
    expect(wholeSpy).toHaveBeenCalledWith(after, before);
    expect(userSpy).toHaveBeenCalledWith(after.user, before.user);
    expect(addressSpy).toHaveBeenCalledWith(after.user?.address, before.user?.address);
    expect(tagSpy).not.toHaveBeenCalled();
    expect(zipSpy).not.toHaveBeenCalled();
    expect(before).toEqual({ user: { address: { city: "KRK" }, tag: "a" } });
  });

  it("equal-value leaf write is a silent no-op — no new references", () => {
    const settings$ = makeSettings$();
    const wholeSpy = vi.fn();
    const citySpy = vi.fn();
    const userSpy = vi.fn();
    settings$.subscribe(wholeSpy);
    settings$.subscribeKey("user.address.city", citySpy);
    settings$.subscribeKey("user", userSpy);

    const original = settings$.get();
    settings$.setKey("user.address.city", "KRK");
    settings$.setKey("user.address.zip", undefined);

    expect(wholeSpy).not.toHaveBeenCalled();
    expect(citySpy).not.toHaveBeenCalled();
    expect(userSpy).not.toHaveBeenCalled();
    expect(settings$.get()).toBe(original);
  });
});

describe("V14 — deep-path write creates missing intermediates and traverses primitives", () => {
  it("creates the intermediate container and notifies the whole value exactly once", () => {
    const settings$ = value<Settings>({ user: {}, tag: "a" });
    const wholeSpy = vi.fn();
    settings$.subscribe(wholeSpy);

    settings$.setKey("user.address.city", "WAW");

    expect(settings$.getKey("user.address.city")).toBe("WAW");
    expect(settings$.getKey("user.address")).toEqual({ city: "WAW" });
    expect(wholeSpy).toHaveBeenCalledTimes(1);
  });

  it("replaces a primitive met mid-path with a container along the write path", () => {
    const settings$ = value<Settings>({ user: {}, tag: "a" });

    settings$.setKey("tag.deep", 1);

    expect(settings$.getKey("tag.deep")).toBe(1);
    expect(settings$.getKey("tag")).toEqual({ deep: 1 });
    expect(settings$.get()).toEqual({ user: {}, tag: { deep: 1 } });
  });
});

describe("V15 — index segments in paths address array items", () => {
  it("numeric segments walk arrays immutably", () => {
    const orders$ = value([{ items: [{ sku: "A" }] }]);
    const wholeSpy = vi.fn();
    orders$.subscribe(wholeSpy);

    const before = orders$.get();
    orders$.setKey("0.items.0.sku", "B");
    const after = orders$.get();

    expect(orders$.getKey("0.items.0.sku")).toBe("B");
    expect(wholeSpy).toHaveBeenCalledTimes(1);
    expect(after[0]?.items[0]?.sku).toBe("B");
    expect(before[0]?.items[0]?.sku).toBe("A");
  });
});
