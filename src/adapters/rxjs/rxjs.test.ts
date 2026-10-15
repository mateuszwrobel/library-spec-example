import { afterEach, describe, expect, it, vi } from "vitest";
import { rxjs } from "@paker/adapters/rxjs";
import type { EventStage } from "@paker/adapters/rxjs";
import { actions } from "@paker/actions";
import { store } from "@paker/store";
import { value } from "@paker/value";
import { from, timer } from "rxjs";
import { filter, map, mapTo, switchMap, take, tap } from "rxjs/operators";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

type Profile = { city: string };
type User = { id: number; profile: Profile };
type UserState = { data: User[]; counter: number };

const makeUser = (id: number, city: string): User => ({ id, profile: { city } });

describe("R1 — event method runs its operator array", () => {
  it("operators run in declared order over a stream carrying the payload; the method returns void; repeat calls run fresh streams", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => ({
        json: async () => ({ doubled: Number(url.split("/").pop()) * 2 }),
      })),
    );
    const ledger: string[] = [];
    // Bare value leg (lane contract: accepts value). Factory never touches the
    // kit, so it infers with zero annotations (workplan_rxjs.md, Decisions).
    const counter$ = rxjs(value(0), (value$) => ({
      FETCH: (amount: number) => [
        tap((n: number) => {
          ledger.push(`first:${n}`);
          value$.set(n);
        }),
        switchMap((n: number) => from(fetch(`/api/${n}`).then((r) => r.json()))),
        tap((body: any) => {
          ledger.push(`second:${JSON.stringify(body)}`);
          value$.set(body.doubled as number);
        }),
      ],
    }));

    expect(counter$.FETCH(5)).toBeUndefined(); // event methods return void

    await vi.waitFor(() => expect(counter$.get()).toBe(10));
    expect(ledger).toEqual(["first:5", 'second:{"doubled":10}']); // declared order, payload carried

    counter$.FETCH(7); // same event again — a fresh stream, full sequence re-runs
    await vi.waitFor(() => expect(counter$.get()).toBe(14));
    expect(ledger).toEqual([
      "first:5",
      'second:{"doubled":10}',
      "first:7",
      'second:{"doubled":14}',
    ]);
  });
});

describe("R2 — forward maps the stream value into another declared event", () => {
  // Factories using forward/skipOn pin the event map with a return annotation
  // (parent decision 2026-10-15 — same inference cycle as actions).
  type UserEvents = {
    FETCH: (amount: number) => EventStage[];
    RECEIVE_USERS: (users: User[]) => EventStage[];
    OTHER_ACTION: () => EventStage[];
  };

  it("spec example runs as written: FETCH → tap(incrementBy) → switchMap(fetch) → skipOn → forward → RECEIVE_USERS → data$.set", async () => {
    const users = [makeUser(1, "KRK"), makeUser(2, "WAW")];
    vi.stubGlobal("fetch", vi.fn(async () => ({ json: async () => users })));
    const otherSpy = vi.fn();

    const userStore$ = rxjs(
      actions(store<UserState>(() => ({ data: [], counter: 0 })), (userCells$) => ({
        incrementBy: (amount: number) => {
          userCells$.counter$.set(userCells$.counter$.get() + amount);
        },
      })),
      // Spec first-arg destructuring: store cells and action methods are
      // members of the wrapped primitive surface handed to the factory.
      ({ data$, incrementBy }, { forward, skipOn }): UserEvents => ({
        FETCH: (amount: number) => [
          tap(() => incrementBy(amount)),
          switchMap(() => from(fetch("/api/users").then((r) => r.json()) as Promise<User[]>)),
          skipOn("OTHER_ACTION"),
          forward.RECEIVE_USERS((users) => users),
        ],
        RECEIVE_USERS: (users: User[]) => [tap(() => data$.set(users))],
        OTHER_ACTION: () => [tap(otherSpy)],
      }),
    );

    const dataSpy = vi.fn();
    userStore$.data$.subscribe(dataSpy);

    expect(userStore$.FETCH(2)).toBeUndefined();

    await vi.waitFor(() => expect(dataSpy).toHaveBeenCalledTimes(1));
    expect(dataSpy).toHaveBeenCalledWith(users, []); // RECEIVE_USERS ran with the mapped users
    expect(userStore$.data$.get()).toBe(users); // data$ holds the users
    expect(userStore$.counter$.get()).toBe(2); // incrementBy applied mid-run (A's apply rule)
    expect(otherSpy).not.toHaveBeenCalled(); // skipOn untouched — OTHER_ACTION never emitted
  });

  it("unknown names, wrong mapper returns, wrong event payloads and unpinned kit factories fail at compile time", () => {
    // Never invoked — each @ts-expect-error pins exactly one failing
    // statement; the typecheck gate fails if any line stops erroring.
    const attempts = (): void => {
      const store$ = store<UserState>(() => ({ data: [], counter: 0 }));
      rxjs(store$, (cells$, { forward, skipOn }): UserEvents => {
        // @ts-expect-error — forward reaches only events declared by the same factory
        forward.NOT_DECLARED((value) => value);
        // @ts-expect-error — mapper return must match RECEIVE_USERS's User[] payload
        forward.RECEIVE_USERS(() => 42);
        // @ts-expect-error — skipOn is typed against the same pinned event map
        skipOn("NOT_DECLARED");
        return {
          FETCH: (amount: number) => [tap(() => cells$.counter$.set(amount))],
          RECEIVE_USERS: (users: User[]) => [tap(() => cells$.data$.set(users))],
          OTHER_ACTION: () => [tap(() => cells$.counter$.set(1))],
        };
      });
      const userStore$ = rxjs(store$, (cells$) => ({
        FETCH: (amount: number) => [tap(() => cells$.counter$.set(amount))],
      }));
      // @ts-expect-error — undeclared event names are not on the decorated surface
      userStore$.NOT_DECLARED(1);
      // @ts-expect-error — wrong payload type on a declared event
      userStore$.FETCH("five");
      rxjs(store$, (cells$, { forward }) => ({
        // Unpinned factory that references forward: E falls back to its
        // homomorphic constraint, so the call fails LOUDLY, never widened
        // (AnyAction precedent from the actions lane, same cycle).
        // @ts-expect-error — forward resolves against {} when the map is unpinned
        LOAD: () => [forward.FETCH(() => 1)],
      }));
    };
    expect(typeof attempts).toBe("function");
  });
});

describe("R3 — skipOn terminates the current stream", () => {
  type Events = {
    FETCH: (amount: number) => EventStage[];
    PING: () => EventStage[];
    OTHER_ACTION: () => EventStage[];
  };

  it("an emission after skipOn's position terminates the run: downstream never runs, upstream effects are not reverted, OTHER_ACTION's own handlers run", async () => {
    vi.useFakeTimers();
    // Bare store leg (lane contract: accepts store) — no actions wrapper here.
    const ledger: string[] = [];
    const userStore$ = rxjs(
      store<UserState>(() => ({ data: [], counter: 0 })),
      (cells$, { skipOn }): Events => ({
        FETCH: (amount: number) => [
          tap(() => {
            ledger.push("upstream");
            cells$.counter$.set(amount);
          }),
          skipOn("OTHER_ACTION"), // mid-array
          switchMap((n) => timer(100).pipe(map(() => `resolved:${n}`))), // async window after the position
          tap((v) => ledger.push(`downstream:${v}`)),
        ],
        PING: () => [
          filter(() => false), // stream never reaches skipOn's position
          skipOn("OTHER_ACTION"),
          tap(() => ledger.push("ping-downstream")),
        ],
        OTHER_ACTION: () => [tap(() => ledger.push("other-handler"))],
      }),
    );

    userStore$.FETCH(3); // payload passes skipOn synchronously — armed; run enters the timer window
    expect(ledger).toEqual(["upstream"]);
    expect(userStore$.counter$.get()).toBe(3);

    userStore$.OTHER_ACTION(); // emits while the run is past skipOn's position
    expect(ledger).toEqual(["upstream", "other-handler"]); // its own handlers run

    await vi.advanceTimersByTimeAsync(1000);
    expect(ledger).toEqual(["upstream", "other-handler"]); // downstream never ran…
    expect(userStore$.counter$.get()).toBe(3); // …and the upstream effect stays committed (not reverted)

    userStore$.PING(); // completes before skipOn's position — listener never armed
    userStore$.OTHER_ACTION();
    await vi.advanceTimersByTimeAsync(1000);
    expect(ledger).toEqual(["upstream", "other-handler", "other-handler"]); // terminated/done runs leave nothing dangling
  });

  it("values past the armed position keep flowing; natural completion detaches the listener", () => {
    const ledger: string[] = [];
    const userStore$ = rxjs(
      store<UserState>(() => ({ data: [], counter: 0 })),
      (cells$, { skipOn }): Events => ({
        FETCH: (amount: number) => [
          switchMap(() => from([`${amount}-a`, `${amount}-b`])), // two values pass skipOn
          skipOn("OTHER_ACTION"),
          tap((v) => ledger.push(`seen:${v}`)),
        ],
        PING: () => [take(0), skipOn("OTHER_ACTION")], // completes with no value — detach-before-arm leg
        OTHER_ACTION: () => [tap(() => ledger.push("other-handler"))],
      }),
    );

    userStore$.FETCH(1); // fully synchronous run
    expect(ledger).toEqual(["seen:1-a", "seen:1-b"]); // second value passed the armed position untouched

    userStore$.PING(); // arms nothing; completes cleanly
    userStore$.FETCH(2); // second FETCH re-arms through the still-registered name slot
    expect(ledger).toEqual(["seen:1-a", "seen:1-b", "seen:2-a", "seen:2-b"]);

    userStore$.OTHER_ACTION(); // all FETCH runs already completed — no termination, no throw
    expect(ledger).toEqual([
      "seen:1-a",
      "seen:1-b",
      "seen:2-a",
      "seen:2-b",
      "other-handler",
    ]);
  });
});

describe("R4 — runs are independent", () => {
  type Events = {
    FETCH: (amount: number) => EventStage[];
    OTHER_ACTION: () => EventStage[];
  };

  const build = (ledger: string[]) =>
    rxjs(
      store<UserState>(() => ({ data: [], counter: 0 })),
      (cells$, { skipOn }): Events => ({
        FETCH: (amount: number) => [
          tap(() => ledger.push(`start:${amount}`)),
          switchMap(() => timer(amount === 1 ? 50 : 100)), // staggered resolution
          skipOn("OTHER_ACTION"), // arms only once this run's value arrives
          switchMap(() => timer(60).pipe(mapTo(`final:${amount}`))), // async tail after the position
          tap((v) => ledger.push(v)),
        ],
        OTHER_ACTION: () => [tap(() => ledger.push("other-handler"))],
      }),
    );

  it("overlapping runs carry their own payloads through their own operators", async () => {
    vi.useFakeTimers();
    const ledger: string[] = [];
    const userStore$ = build(ledger);

    userStore$.FETCH(1);
    userStore$.FETCH(2); // both in flight
    expect(ledger).toEqual(["start:1", "start:2"]);

    await vi.advanceTimersByTimeAsync(200);
    expect(ledger).toEqual(["start:1", "start:2", "final:1", "final:2"]);
  });

  it("an emission during one run terminates only that run", async () => {
    vi.useFakeTimers();
    const ledger: string[] = [];
    const userStore$ = build(ledger);

    userStore$.FETCH(1);
    userStore$.FETCH(2);
    await vi.advanceTimersByTimeAsync(50); // run 1 resolves and passes skipOn (armed); run 2 still fetching
    userStore$.OTHER_ACTION(); // terminates run 1 only — run 2 has not reached its skipOn position

    await vi.advanceTimersByTimeAsync(200);
    expect(ledger).toEqual(["start:1", "start:2", "other-handler", "final:2"]); // run 1's async tail never delivered
  });
});

describe("unsubscribe hygiene — runs need no dispose API (lifetime decision, computed-cell precedent)", () => {
  type Events = {
    FETCH: () => EventStage[];
    OTHER_ACTION: () => EventStage[];
  };

  it("terminated and completed runs leave no pending timers and no armed listeners", async () => {
    vi.useFakeTimers();
    const ledger: string[] = [];
    const userStore$ = rxjs(
      store<UserState>(() => ({ data: [], counter: 0 })),
      (cells$, { skipOn }): Events => ({
        FETCH: () => [
          skipOn("OTHER_ACTION"),
          switchMap(() => timer(50).pipe(mapTo("late"))),
          tap((v) => ledger.push(String(v))),
        ],
        OTHER_ACTION: () => [tap(() => ledger.push("other"))],
      }),
    );

    userStore$.FETCH(); // armed immediately — single synchronous value
    userStore$.OTHER_ACTION(); // terminates the run mid-timer
    await vi.advanceTimersByTimeAsync(500);
    expect(ledger).toEqual(["other"]); // the killed timer never delivered; nothing else woke up

    userStore$.FETCH(); // fresh run completes on its own
    await vi.advanceTimersByTimeAsync(500);
    expect(ledger).toEqual(["other", "late"]); // exactly one delivery — no duplicate, no leak
  });

  it("a run erroring mid-pipeline closes silently and detaches its armed listener — no host noise, later events unaffected", async () => {
    vi.useFakeTimers();
    const ledger: string[] = [];
    const userStore$ = rxjs(
      store<UserState>(() => ({ data: [], counter: 0 })),
      (cells$, { skipOn }): Events => ({
        FETCH: () => [
          skipOn("OTHER_ACTION"),
          switchMap(() =>
            timer(50).pipe(
              map(() => {
                throw new Error("boom-mid-run"); // author-composed error edges stay inside the run
              }),
            ),
          ),
          tap(() => ledger.push("downstream")),
        ],
        OTHER_ACTION: () => [tap(() => ledger.push("other"))],
      }),
    );

    userStore$.FETCH(); // arms at its position, then enters the timer window
    await vi.advanceTimersByTimeAsync(500); // the throw terminates this run only — silently
    expect(ledger).toEqual([]); // downstream stage never executed

    userStore$.OTHER_ACTION(); // the errored run's listener was detached at teardown — nothing left to kill, no throw
    expect(ledger).toEqual(["other"]); // OTHER_ACTION's own pipeline still runs
  });
});
