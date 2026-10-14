import { describe, expect, it, vi } from "vitest";
import { store } from "@paker/store";

type Profile = { city: string };
type User = { id: number; profile: Profile };
type UserState = { data: User[]; counter: number };

const makeUser = (id: number, city: string): User => ({ id, profile: { city } });

describe("S1 — property cells are full value primitives", () => {
  it("a property-cell write notifies that cell's subscribers and the store view; sibling cells stay silent; get() reflects it", () => {
    // S1's given uses the initializer form.
    const userStore$ = store<UserState>(() => ({ data: [], counter: 0 }));
    const counterSpy = vi.fn();
    const dataSpy = vi.fn();
    const storeSpy = vi.fn();
    userStore$.counter$.subscribe(counterSpy);
    userStore$.data$.subscribe(dataSpy);
    userStore$.subscribe(storeSpy);

    userStore$.counter$.set(1);

    expect(counterSpy).toHaveBeenCalledTimes(1);
    expect(counterSpy).toHaveBeenCalledWith(1, 0);
    expect(dataSpy).not.toHaveBeenCalled();
    expect(storeSpy).toHaveBeenCalledTimes(1);
    expect(storeSpy).toHaveBeenCalledWith({ data: [], counter: 1 }, { data: [], counter: 0 });
    expect(userStore$.get()).toEqual({ data: [], counter: 1 });
  });

  it("cells expose the full value contract — get, set with updater, reset, key ops, subscribe", () => {
    const userStore$ = store<UserState>(() => ({ data: [makeUser(1, "KRK")], counter: 0 }));
    const counterSpy = vi.fn();
    userStore$.counter$.subscribe(counterSpy);

    expect(userStore$.counter$.get()).toBe(0);
    userStore$.counter$.set((current) => current + 1);
    expect(userStore$.counter$.get()).toBe(1);
    expect(userStore$.counter$.getInitial()).toBe(0);
    userStore$.counter$.reset();
    expect(userStore$.counter$.get()).toBe(0);
    expect(counterSpy).toHaveBeenCalledWith(0, 1);

    // data$ is an array cell — key ops work through the value contract.
    expect(userStore$.data$.getKey(0)).toEqual(makeUser(1, "KRK"));
    userStore$.data$.setKey(0, makeUser(2, "WAW"));
    expect(userStore$.data$.getKey(0)).toEqual(makeUser(2, "WAW"));
    expect(userStore$.get()).toEqual({ data: [makeUser(2, "WAW")], counter: 0 });
  });

  it("initializer form isolates per-instance state; plain-object form gives independent instances too", () => {
    const initializer = () => ({ data: [makeUser(1, "KRK")], counter: 0 });
    const storeA$ = store<UserState>(initializer);
    const storeB$ = store<UserState>(initializer);

    storeA$.counter$.set(1);
    storeA$.data$.setKey("0.profile.city", "WAW");

    expect(storeB$.get()).toEqual({ data: [makeUser(1, "KRK")], counter: 0 });
    expect(storeA$.getInitial()).not.toBe(storeB$.getInitial());

    const objectStoreA$ = store<UserState>({ data: [], counter: 0 });
    const objectStoreB$ = store<UserState>({ data: [], counter: 0 });
    objectStoreA$.counter$.set(5);
    expect(objectStoreB$.get()).toEqual({ data: [], counter: 0 });
  });
});

describe("S2 — whole-store set applies per changed key", () => {
  it("changed key cells each fire once with (new, old); untouched keys stay silent; the store view fires exactly once per store-level operation", () => {
    const userStore$ = store<UserState>(() => ({ data: [], counter: 0 }));
    const dataSpy = vi.fn();
    const counterSpy = vi.fn();
    const storeSpy = vi.fn();
    userStore$.data$.subscribe(dataSpy);
    userStore$.counter$.subscribe(counterSpy);
    userStore$.subscribe(storeSpy);

    const u1 = makeUser(1, "KRK");
    const u2 = makeUser(2, "LDN");
    userStore$.set({ data: [u1, u2], counter: 3 });

    expect(userStore$.get()).toEqual({ data: [u1, u2], counter: 3 });
    expect(dataSpy).toHaveBeenCalledTimes(1);
    expect(dataSpy).toHaveBeenCalledWith([u1, u2], []);
    expect(counterSpy).toHaveBeenCalledTimes(1);
    expect(counterSpy).toHaveBeenCalledWith(3, 0);
    expect(storeSpy).toHaveBeenCalledTimes(1);
    expect(storeSpy).toHaveBeenCalledWith({ data: [u1, u2], counter: 3 }, { data: [], counter: 0 });

    dataSpy.mockClear();
    counterSpy.mockClear();
    storeSpy.mockClear();

    // Partial patch — only the named key fires; SameValueZero-equal writes stay silent.
    userStore$.set({ counter: 3 });
    expect(dataSpy).not.toHaveBeenCalled();
    expect(counterSpy).not.toHaveBeenCalled();
    expect(storeSpy).not.toHaveBeenCalled();
    expect(userStore$.get()).toEqual({ data: [u1, u2], counter: 3 });

    userStore$.set({ counter: 4 });
    expect(storeSpy).toHaveBeenCalledTimes(1);
    expect(storeSpy).toHaveBeenCalledWith({ data: [u1, u2], counter: 4 }, { data: [u1, u2], counter: 3 });
  });
});

describe("S3 — whole-store subscribe fires for any property", () => {
  it("delivers (current, previous) whole-state snapshots on a property write, never on attach, and cleanup detaches", () => {
    const userStore$ = store<UserState>(() => ({ data: [], counter: 0 }));
    const storeSpy = vi.fn();

    const unsubscribe = userStore$.subscribe(storeSpy);
    expect(storeSpy).not.toHaveBeenCalled();

    userStore$.counter$.set(2);
    expect(storeSpy).toHaveBeenCalledTimes(1);
    expect(storeSpy).toHaveBeenCalledWith({ data: [], counter: 2 }, { data: [], counter: 0 });

    unsubscribe();
    userStore$.counter$.set(3);
    expect(storeSpy).toHaveBeenCalledTimes(1);
  });

  it("fires exactly once per store-level operation — a multi-key set is one notification, not one per key", () => {
    const userStore$ = store<UserState>(() => ({ data: [], counter: 0 }));
    const storeSpy = vi.fn();
    userStore$.subscribe(storeSpy);

    userStore$.set({ data: [makeUser(1, "KRK")], counter: 3 });
    expect(storeSpy).toHaveBeenCalledTimes(1);
    expect(storeSpy.mock.calls[0]?.[0]).toEqual({ data: [makeUser(1, "KRK")], counter: 3 });
  });
});

describe("S4 — store reset restores every property", () => {
  it("restores every property to initial with exactly one store-level notification", () => {
    const initialData = [makeUser(1, "KRK")];
    const userStore$ = store<UserState>(() => ({ data: initialData, counter: 0 }));
    const dataSpy = vi.fn();
    const counterSpy = vi.fn();
    const storeSpy = vi.fn();
    userStore$.data$.subscribe(dataSpy);
    userStore$.counter$.subscribe(counterSpy);
    userStore$.subscribe(storeSpy);

    userStore$.data$.set([makeUser(2, "WAW")]);
    userStore$.counter$.set(7);
    dataSpy.mockClear();
    counterSpy.mockClear();
    storeSpy.mockClear();

    userStore$.reset();

    expect(userStore$.get()).toEqual({ data: [{ id: 1, profile: { city: "KRK" } }], counter: 0 });
    expect(dataSpy).toHaveBeenCalledTimes(1);
    expect(dataSpy).toHaveBeenCalledWith(initialData, [{ id: 2, profile: { city: "WAW" } }]);
    expect(counterSpy).toHaveBeenCalledTimes(1);
    expect(counterSpy).toHaveBeenCalledWith(0, 7);
    expect(storeSpy).toHaveBeenCalledTimes(1);
    expect(storeSpy).toHaveBeenCalledWith(
      { data: [{ id: 1, profile: { city: "KRK" } }], counter: 0 },
      { data: [{ id: 2, profile: { city: "WAW" } }], counter: 7 },
    );
  });

  it("reset over already-initial state notifies nobody", () => {
    const userStore$ = store<UserState>(() => ({ data: [], counter: 0 }));
    const storeSpy = vi.fn();
    userStore$.subscribe(storeSpy);

    userStore$.reset();
    expect(storeSpy).not.toHaveBeenCalled();
  });

  it("getInitial returns the complete initial state object even after mutations", () => {
    const userStore$ = store<UserState>(() => ({ data: [], counter: 0 }));
    userStore$.counter$.set(42);
    userStore$.data$.set([makeUser(1, "KRK")]);

    expect(userStore$.getInitial()).toEqual({ data: [], counter: 0 });
  });
});

describe("S6 — deep paths through store property cells", () => {
  it("setKey through a property cell follows value's path rules: leaf cell fires, siblings silent, store view fires exactly once", () => {
    const u1 = makeUser(1, "KRK");
    const u2 = makeUser(2, "LDN");
    const initialData = [u1, u2];
    const userStore$ = store<UserState>(() => ({ data: initialData, counter: 0 }));
    const dataSpy = vi.fn();
    const counterSpy = vi.fn();
    const storeSpy = vi.fn();
    userStore$.data$.subscribe(dataSpy);
    userStore$.counter$.subscribe(counterSpy);
    userStore$.subscribe(storeSpy);

    userStore$.data$.setKey("0.profile.city", "WAW");

    expect(dataSpy).toHaveBeenCalledTimes(1);
    const [newData, oldData] = dataSpy.mock.calls[0]!;
    expect(newData).not.toBe(oldData);
    expect((newData as User[])[0]).toEqual({ id: 1, profile: { city: "WAW" } });
    expect(oldData).toBe(initialData);
    // Nothing was mutated in place — the original user still reads KRK.
    expect(u1.profile.city).toBe("KRK");
    expect(counterSpy).not.toHaveBeenCalled();
    // Path fan-out inside the cell does not multiply store-level notifications.
    expect(storeSpy).toHaveBeenCalledTimes(1);
    expect(storeSpy).toHaveBeenCalledWith(
      { data: newData, counter: 0 },
      { data: initialData, counter: 0 },
    );
    expect(userStore$.data$.getKey("0.profile.city")).toBe("WAW");
    expect(userStore$.get()).toEqual({ data: [{ id: 1, profile: { city: "WAW" } }, u2], counter: 0 });
  });

  it("an equal-value deep write is a total no-op at cell and store level", () => {
    const userStore$ = store<UserState>(() => ({ data: [makeUser(1, "KRK")], counter: 0 }));
    const dataSpy = vi.fn();
    const storeSpy = vi.fn();
    userStore$.data$.subscribe(dataSpy);
    userStore$.subscribe(storeSpy);

    userStore$.data$.setKey("0.profile.city", "KRK");
    expect(dataSpy).not.toHaveBeenCalled();
    expect(storeSpy).not.toHaveBeenCalled();
  });
});

describe("type safety — names outside the state shape fail at compile time", () => {
  it("unknown cell names and unknown set keys are compile-time failures (pinned by typecheck gate)", () => {
    const userStore$ = store<UserState>(() => ({ data: [], counter: 0 }));
    // Never invoked — each @ts-expect-error pins exactly one failing
    // statement; the typecheck gate fails if any line stops erroring.
    const attempts = (): void => {
      // @ts-expect-error — nope$ is not a property of the state shape
      void userStore$.nope$;
      // @ts-expect-error — set rejects keys outside the state shape
      userStore$.set({ nope: 1 });
      // @ts-expect-error — counter$ is a ValueCell<number>; strings are rejected
      userStore$.counter$.set("seven");
      // @ts-expect-error — the store generic stays readable as its state shape
      const _wrong: number = userStore$.get();
    };
    expect(typeof attempts).toBe("function");
  });
});
