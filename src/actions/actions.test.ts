import { afterEach, describe, expect, it, vi } from "vitest";
import { actions } from "@paker/actions";
import { store } from "@paker/store";
import { value } from "@paker/value";

afterEach(() => {
  vi.unstubAllGlobals();
});

type Profile = { city: string };
type User = { id: number; profile: Profile };
type UserState = { data: User[]; counter: number };

const makeUser = (id: number, city: string): User => ({ id, profile: { city } });

describe("A1 — decorated primitives keep their full API", () => {
  it("decorated value exposes get/set/reset/getInitial/subscribe and key ops exactly as undecorated", () => {
    const initial = { theme: "dark", locale: "en" };
    const inner$ = value(initial);
    const settings$ = actions(inner$, (settingsCell$) => ({
      setTheme: (theme: string) => {
        settingsCell$.setKey("theme", theme);
      },
    }));

    const spy = vi.fn();
    const cleanup = settings$.subscribe(spy);
    expect(spy).not.toHaveBeenCalled(); // attach never fires (V4)

    settings$.set((current) => ({ ...current, locale: "pl" })); // updater form intact (V2)
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith({ theme: "dark", locale: "pl" }, initial);

    settings$.setTheme("dark"); // action path writes the CURRENT value → silent (V3 skip intact)
    expect(spy).toHaveBeenCalledTimes(1);
    expect(settings$.getKey("theme")).toBe("dark");

    settings$.setTheme("solar"); // action drives a real key-op write
    expect(settings$.getKey("theme")).toBe("solar");
    expect(spy).toHaveBeenCalledTimes(2);

    settings$.setKey("missing", 1); // key add + key-targeted subscription intact (V11)
    expect(settings$.getKey("missing")).toBe(1);
    const keySpy = vi.fn();
    const cleanupKey = settings$.subscribeKey("missing", keySpy);
    settings$.setKey("missing", 2);
    expect(keySpy).toHaveBeenCalledWith(2, 1);
    cleanupKey();

    const replacement = { theme: "light", locale: "en" };
    settings$.set(replacement);
    settings$.set(replacement); // same reference → equal → never notifies (V3)

    expect(settings$.getInitial()).toBe(initial);
    settings$.reset();
    expect(settings$.get()).toBe(initial); // reset restores the initial reference (V5)

    expect(spy).toHaveBeenCalledTimes(6);
    cleanup();
    settings$.set({ theme: "x", locale: "y" });
    expect(spy).toHaveBeenCalledTimes(6); // cleanup detached the listener (V4)

    // The wrapped primitive keeps its identity and gains nothing (A1: decoration
    // does not change the wrapped primitive's API surface).
    expect(inner$).not.toBe(settings$);
    expect("setTheme" in inner$).toBe(false);
    expect(inner$.get()).toBe(settings$.get()); // one state owner: the cell
  });

  it("decorated store keeps whole-state ops and $-suffixed property cells exactly as undecorated", () => {
    const userStore$ = actions(
      store<UserState>(() => ({ data: [makeUser(1, "KRK")], counter: 0 })),
      (userCells$) => ({
        setCounter: (counter: number) => {
          userCells$.counter$.set(counter);
        },
      }),
    );

    const counterSpy = vi.fn();
    const dataSpy = vi.fn();
    userStore$.counter$.subscribe(counterSpy);
    userStore$.data$.subscribe(dataSpy);

    userStore$.setCounter(1);
    expect(counterSpy).toHaveBeenCalledWith(1, 0);
    expect(dataSpy).not.toHaveBeenCalled();
    expect(userStore$.get()).toEqual({ data: [makeUser(1, "KRK")], counter: 1 });

    // Property cells remain full value primitives — key ops included (S1).
    userStore$.data$.setKey("0.profile.city", "WAW");
    expect(userStore$.data$.getKey("0.profile.city")).toBe("WAW");

    const wholeSpy = vi.fn();
    userStore$.subscribe(wholeSpy);
    userStore$.reset(); // reset restores every property (S4)
    expect(userStore$.getInitial()).toEqual({ data: [makeUser(1, "KRK")], counter: 0 });
    expect(userStore$.get()).toEqual({ data: [makeUser(1, "KRK")], counter: 0 });
    expect(wholeSpy).toHaveBeenCalledTimes(1);
  });
});

describe("A2 — direct writes are the mutation path for void-returning actions", () => {
  it("a setCounter calling value$.set and returning nothing notifies exactly once per call", () => {
    const counter$ = actions(value(0), (value$) => ({
      setCounter: (next: number) => {
        value$.set(next);
      },
    }));
    const spy = vi.fn();
    counter$.subscribe(spy);

    const result = counter$.setCounter(7);

    expect(counter$.get()).toBe(7);
    expect(spy).toHaveBeenCalledTimes(1); // no double-commit
    expect(spy).toHaveBeenCalledWith(7, 0);
    expect(result).toBeUndefined(); // the method itself returns void
  });
});

describe("A3 — returning a value applies it as the next value", () => {
  it("increment returning value$.get() + 1 with no direct set applies once", () => {
    const counter$ = actions(value(10), (value$) => ({
      increment: () => value$.get() + 1,
    }));
    const spy = vi.fn();
    counter$.subscribe(spy);

    counter$.increment();
    expect(counter$.get()).toBe(11);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(11, 10);
  });

  it("an action returning an updater applies through the cell's updater set — the updater's return wins as next value, no recursion", () => {
    const counter$ = actions(value(10), () => ({
      bumpBy: (amount: number) => (current: number) => current + amount,
    }));
    const spy = vi.fn();
    counter$.subscribe(spy);

    counter$.bumpBy(5);
    expect(counter$.get()).toBe(15);
    expect(typeof counter$.get()).toBe("number"); // the function itself never lands in state
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(15, 10);
  });
});

describe("A4 — returning a patch applies partial store state", () => {
  it("loadUsers returning { data } merges onto the CURRENT snapshot — data$ fires once, counter$ stays silent, store-level fires once", async () => {
    const users = [makeUser(1, "KRK"), makeUser(2, "WAW")];
    vi.stubGlobal("fetch", vi.fn(async () => ({ json: async () => users })));

    const userStore$ = actions(
      store<UserState>(() => ({ data: [], counter: 0 })),
      () => ({
        loadUsers: async () => {
          const response = await fetch("/api/users");
          return { data: (await response.json()) as User[] };
        },
      }),
    );

    // Move counter away from initial BEFORE the patch — the merge must read the
    // current snapshot, not getInitial().
    userStore$.counter$.set(5);

    const dataSpy = vi.fn();
    const counterSpy = vi.fn();
    const wholeSpy = vi.fn();
    userStore$.data$.subscribe(dataSpy);
    userStore$.counter$.subscribe(counterSpy);
    userStore$.subscribe(wholeSpy);

    await userStore$.loadUsers();

    expect(userStore$.get()).toEqual({ data: users, counter: 5 }); // counter untouched
    expect(dataSpy).toHaveBeenCalledTimes(1);
    expect(dataSpy).toHaveBeenCalledWith(users, []);
    expect(counterSpy).not.toHaveBeenCalled();
    expect(wholeSpy).toHaveBeenCalledTimes(1); // one operation, one store-level notification (S2)
    expect(wholeSpy).toHaveBeenCalledWith({ data: users, counter: 5 }, { data: [], counter: 5 });

    // Equal merge → total silence, snapshot identity stable.
    const before = userStore$.get();
    await userStore$.loadUsers();
    expect(userStore$.get()).toBe(before);
    expect(dataSpy).toHaveBeenCalledTimes(1);
    expect(counterSpy).not.toHaveBeenCalled();
    expect(wholeSpy).toHaveBeenCalledTimes(1);
  });

  it("a sync action returning a partial patch applies per changed key", () => {
    const userStore$ = actions(
      store<UserState>(() => ({ data: [], counter: 0 })),
      () => ({
        seedCounter: (counter: number) => ({ counter }),
      }),
    );
    const dataSpy = vi.fn();
    const counterSpy = vi.fn();
    const wholeSpy = vi.fn();
    userStore$.data$.subscribe(dataSpy);
    userStore$.counter$.subscribe(counterSpy);
    userStore$.subscribe(wholeSpy);

    userStore$.seedCounter(3);
    expect(userStore$.get()).toEqual({ data: [], counter: 3 });
    expect(counterSpy).toHaveBeenCalledWith(3, 0);
    expect(dataSpy).not.toHaveBeenCalled();
    expect(wholeSpy).toHaveBeenCalledTimes(1);
  });
});

describe("A5 — forward reaches only declared actions", () => {
  it("incrementBy delegating through forward runs one write chain — composed value applied, exactly one notification", () => {
    // Factories composing through forward pin their map type (return
    // annotation) — the inference that types forward cannot also read
    // signatures from bodies that call forward (types.ts, AnyAction).
    const counter$ = actions(value(0), (value$, forward): {
      setCounter: (next: number) => void;
      incrementBy: (amount: number) => void;
    } => ({
      setCounter: (next: number) => {
        value$.set(next);
      },
      incrementBy: (amount: number) => forward.setCounter(value$.get() + amount),
    }));
    const spy = vi.fn();
    counter$.subscribe(spy);

    counter$.incrementBy(5);

    expect(counter$.get()).toBe(5); // setCounter executed with the composed value
    expect(spy).toHaveBeenCalledTimes(1); // the outer action commits nothing extra
    expect(spy).toHaveBeenCalledWith(5, 0);
  });

  it("forwarding an async action awaits the inner commit as one chain", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ json: async () => 9 })));
    const counter$ = actions(value(0), (value$, forward): {
      loadCounter: () => Promise<number>;
      reload: () => Promise<void>;
    } => ({
      loadCounter: async () => {
        const response = await fetch("/api/counter");
        return (await response.json()) as number;
      },
      reload: () => forward.loadCounter(),
    }));
    const spy = vi.fn();
    counter$.subscribe(spy);

    await counter$.reload();
    expect(counter$.get()).toBe(9);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("names not declared by the factory and wrong parameter types fail at compile time", () => {
    // Never invoked — each @ts-expect-error pins exactly one failing
    // statement; the typecheck gate fails if any line stops erroring.
    // The witness factory pins its map so `forward` is typed at all
    // (an unpinned forward-referencing factory fails to compile loudly —
    // A resolves to {} — the rule proven by the two directives below
    // holding on the pinned form).
    const attempts = (): void => {
      actions(value(0), (value$, forward): { setCounter: (next: number) => void } => {
        // @ts-expect-error — forward reaches only names declared by the same factory
        forward.notDeclared(1);
        // @ts-expect-error — setCounter's parameter is a number
        forward.setCounter("seven");
        return {
          setCounter: (next: number) => {
            value$.set(next);
          },
        };
      });
      const counter$ = actions(value(0), (value$) => ({
        setCounter: (next: number) => {
          value$.set(next);
        },
      }));
      // @ts-expect-error — undeclared action names are not on the decorated surface
      counter$.notDeclared(1);
      // @ts-expect-error — wrong parameter type on a declared action
      counter$.setCounter("seven");
    };
    expect(typeof attempts).toBe("function");
  });
});

describe("A6 — async actions apply after the promise resolves", () => {
  it("pre-resolution state untouched and subscribers silent; awaited result applies — Promise<void> resolves AFTER commit", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ json: async () => 7 })));

    const counter$ = actions(value(0), () => ({
      loadCounter: async () => {
        const response = await fetch("/api/counter");
        return (await response.json()) as number;
      },
    }));
    const spy = vi.fn();
    counter$.subscribe(spy);

    const pending = counter$.loadCounter(); // called without awaiting

    expect(counter$.get()).toBe(0); // pre-resolution state untouched
    expect(spy).not.toHaveBeenCalled(); // subscribers silent pre-resolution

    await expect(pending).resolves.toBeUndefined(); // the method is Promise<void>

    expect(counter$.get()).toBe(7); // immediate get() after await shows the new value
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(7, 0);
  });

  it("an async action writing directly and resolving undefined commits nothing extra", async () => {
    const counter$ = actions(value(0), (value$) => ({
      refresh: async () => {
        await Promise.resolve();
        value$.set(3);
      },
    }));
    const spy = vi.fn();
    counter$.subscribe(spy);

    await counter$.refresh();
    expect(counter$.get()).toBe(3);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(3, 0);
  });

  it("sync action methods return void synchronously, even when the action returns a value", () => {
    const counter$ = actions(value(0), (value$) => ({
      increment: () => value$.get() + 1,
    }));
    expect(counter$.increment()).toBeUndefined();
    expect(counter$.get()).toBe(1);
  });
});

describe("A7 — action name and parameter type checks", () => {
  type Equals<X, Y> =
    (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? true : false;
  type Expect<T extends true> = T;

  it("call signatures keep parameter optionality and types on the decorated surface", () => {
    const counter$ = actions(value(0), (value$) => ({
      setCounter: (nextCounter: number, note?: string) => {
        void note;
        value$.set(nextCounter);
      },
    }));

    type _Params = Expect<
      Equals<Parameters<(typeof counter$)["setCounter"]>, [nextCounter: number, note?: string]>
    >;
    type _ReturnsVoid = Expect<Equals<ReturnType<(typeof counter$)["setCounter"]>, void>>;

    counter$.setCounter(1); // optional parameter omitted at the call site
    expect(counter$.get()).toBe(1);
    counter$.setCounter(2, "from witness"); // and supplied
    expect(counter$.get()).toBe(2);

    // Store-wrapped async actions read as () => Promise<void> per the return rule.
    const userStore$ = actions(
      store<UserState>(() => ({ data: [], counter: 0 })),
      () => ({
        loadUsers: async () => ({ data: [] as User[] }),
      }),
    );
    type _AsyncReturns = Expect<
      Equals<ReturnType<(typeof userStore$)["loadUsers"]>, Promise<void>>
    >;
    expect(userStore$.get()).toEqual({ data: [], counter: 0 });
  });

  it("wrong parameter types and undeclared names on the decorated instance are compile-time failures", () => {
    // Witnessed by the never-invoked attempts block in the A5 describe:
    // each @ts-expect-error there pins one failing call-site shape; the
    // typecheck gate proves the directives stay live.
    expect(true).toBe(true);
  });
});

describe("error behavior — throws propagate, nothing applies (lane decision)", () => {
  it("a synchronous throw inside an action propagates from the method call and applies nothing", () => {
    const counter$ = actions(value(0), () => ({
      fail: () => {
        throw new Error("sync-boom");
      },
    }));
    const spy = vi.fn();
    counter$.subscribe(spy);

    expect(() => counter$.fail()).toThrow("sync-boom");
    expect(counter$.get()).toBe(0);
    expect(spy).not.toHaveBeenCalled();
  });

  it("an async rejection propagates through the returned Promise<void> and applies nothing", async () => {
    const counter$ = actions(value(0), () => ({
      fail: async () => {
        await Promise.resolve();
        throw new Error("async-boom");
      },
    }));
    const spy = vi.fn();
    counter$.subscribe(spy);

    await expect(counter$.fail()).rejects.toThrow("async-boom");
    expect(counter$.get()).toBe(0);
    expect(spy).not.toHaveBeenCalled();
  });

  it("a factory throwing at decoration time propagates and binds nothing", () => {
    const inner$ = value(0);
    const spy = vi.fn();
    inner$.subscribe(spy);

    expect(() =>
      actions(inner$, () => {
        throw new Error("factory-boom");
      }),
    ).toThrow("factory-boom");
    expect(inner$.get()).toBe(0);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("collision decision — action names shadow the copied wrapped surface", () => {
  it("an action named get shadows the wrapped get on the decorated copy while the wrapped primitive's own get stays untouched", () => {
    const inner$ = value(0);
    const decorated$ = actions(inner$, (v$) => ({
      get: () => v$.get() + 100, // reads through the untouched primitive, returns a next value
    }));
    const spy = vi.fn();
    inner$.subscribe(spy);

    // The decorated copy's `get` member is the bound action, not the wrapped read.
    expect(decorated$.get).not.toBe(inner$.get);
    expect(decorated$.get()).toBeUndefined(); // runs the action: apply protocol, method result void
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(100, 0);

    // The wrapped primitive itself is untouched — its own get keeps original read semantics.
    expect(inner$.get()).toBe(100);
    expect(spy).toHaveBeenCalledTimes(1); // reading never notifies — no action ran through it
  });
});
