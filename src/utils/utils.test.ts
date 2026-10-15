import { describe, expect, it } from "vitest";
import { actions } from "@paker/actions";
import type { InferActionParameters, InferActions, InferActionResult } from "@paker/actions";
import { rxjs } from "@paker/adapters/rxjs";
import type { EventStage, InferEventPayload, InferEvents } from "@paker/adapters/rxjs";
import { store } from "@paker/store";
import type { InferState } from "@paker/store";
import { value } from "@paker/value";
import type { InferValue } from "@paker/value";
import type {
  InferActionParameters as InferActionParametersUtils,
  InferActions as InferActionsUtils,
  InferActionResult as InferActionResultUtils,
  InferEventPayload as InferEventPayloadUtils,
  InferEvents as InferEventsUtils,
  InferState as InferStateUtils,
  InferValue as InferValueUtils,
} from "@paker/utils";

// Spec witnesses (workplan_utils.md U1–U6): real composed instances through
// the whole wrapper stack, projected with the utils-owned helpers imported
// from the spec's own import strings (ADR-0003). Every assertion here is
// compile-time — the helpers emit nothing; the `it` blocks only prove the
// witness instances are real and that expected resolutions never widen to
// `any` at the observable level. Wrong usages fail compilation via the
// `@ts-expect-error` directives in the U5 describe — tsc keeps those
// directives live, so a regression that stopped failing turns the gate red.
type Equals<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? true : false;
type Expect<T extends true> = T;

type Profile = { city: string };
type User = { id: number; profile: Profile };
type UserState = { data: User[]; counter: number };

const makeUser = (id: number, city: string): User => ({ id, profile: { city } });

// The adapter's stage type is annotated, not imported-from-rxjs: the utils
// test may not reach RxJS directly (ADR-0002, `rxjs-confined` guard).
const passthroughStage: EventStage = (source) => source;

// ── Spec action map (U2) — pinned return annotation: the factory uses
// `forward` (parent ruling, 2026-10-15). Raw map signatures carry the
// apply-protocol returns; the decorated surface reads void/Promise<void>.
type SpecActionMap = {
  setCounter: (nextCounter: number) => void;
  increment: () => void;
  incrementBy: (amount: number) => void;
  loadUsers: () => Promise<{ data: User[] }>;
};

// ── Spec event map (U4) — pinned return annotation: the factory uses
// `forward`.
type SpecEventMap = {
  FETCH: (amount: number) => EventStage[];
  RECEIVE_USERS: (users: User[]) => EventStage[];
};

// U1 instances — plain value, computed value, bare store.
const counter$ = value(0);
const users$ = value<User[]>([]);
const total$ = value([counter$, users$], (counter, currentUsers) => counter + currentUsers.length);
const plainStore$ = store<UserState>(() => ({ data: [], counter: 0 }));

// U2/U3 instance — the spec's store action map exactly.
const actionsStore$ = actions(
  store<UserState>(() => ({ data: [], counter: 0 })),
  (userCells$, forward): SpecActionMap => ({
    setCounter: (nextCounter: number) => {
      userCells$.counter$.set(nextCounter);
    },
    increment: () => {
      userCells$.counter$.set(userCells$.counter$.get() + 1);
    },
    incrementBy: (amount: number) => forward.setCounter(userCells$.counter$.get() + amount),
    loadUsers: async () => ({ data: [] as User[] }),
  }),
);

// U4 instance — the spec's RxJS store stack: store + actions + events, built
// on the SAME actions-decorated store so U6 can compare the actions
// projection across depths. Event methods are never invoked here — the
// factories' returned stage arrays are inert placeholders (this file may not
// import RxJS operators; ADR-0002 confines them to the adapter).
const stackedStore$ = rxjs(
  actionsStore$,
  (_decorated$, { forward }): SpecEventMap => ({
    FETCH: (amount: number) => [
      forward.RECEIVE_USERS((streamValue) => [makeUser(streamValue as number, "KRK")]),
      passthroughStage,
    ],
    RECEIVE_USERS: (users: User[]) => [passthroughStage],
  }),
);

// U2 label/optionality witness — an extra action with an optional parameter.
type OptionalMap = {
  nudge: (delta?: number) => void;
};
const optionalValue$ = actions(value(0), (value$): OptionalMap => ({
  nudge: (delta?: number) => {
    value$.set(value$.get() + (delta ?? 1));
  },
}));

// U6 value depths — one primitive chain through every wrapper.
const plainValue$ = value(0);
const actionsValue$ = actions(plainValue$, (value$) => ({
  nudge: () => value$.get() + 1,
}));
const rxValue$ = rxjs(actionsValue$, () => ({
  TOUCH: () => [passthroughStage],
}));

describe("U1 — InferValue and InferState", () => {
  type _CounterValue = Expect<Equals<InferValue<typeof counter$>, number>>;
  type _TotalValue = Expect<Equals<InferValue<typeof total$>, number>>; // computed infers its derived data type
  type _PlainState = Expect<Equals<InferState<typeof plainStore$>, { data: User[]; counter: number }>>;
  type _StackedState = Expect<Equals<InferState<typeof stackedStore$>, { data: User[]; counter: number }>>;

  it("value cells and stores are branded at every wrapper depth", () => {
    expect(counter$.get()).toBe(0);
    expect(total$.get()).toBe(0);
    expect(plainStore$.get()).toEqual({ data: [], counter: 0 });
  });
});

describe("U2 — InferActions preserves call signatures", () => {
  type _ActionsMap = Expect<
    Equals<
      InferActions<typeof actionsStore$>,
      {
        setCounter(nextCounter: number): void;
        increment(): void;
        incrementBy(amount: number): void;
        loadUsers(): Promise<void>;
      }
    >
  >;
  // Parameter labels and optional parameters are preserved (extra action).
  type _OptionalSurface = Expect<
    Equals<InferActions<typeof optionalValue$>, { nudge(delta?: number): void }>
  >;
  type _OptionalParams = Expect<
    Equals<InferActionParameters<typeof optionalValue$, "nudge">, [delta?: number]>
  >;

  it("the spec action map decorates a real store", () => {
    actionsStore$.increment();
    expect(actionsStore$.counter$.get()).toBe(1); // apply protocol ran through the projection's instance
  });
});

describe("U3 — InferActionParameters and InferActionResult", () => {
  type _IncrementByParams = Expect<
    Equals<InferActionParameters<typeof actionsStore$, "incrementBy">, [amount: number]>
  >;
  type _LoadUsersResult = Expect<
    Equals<InferActionResult<typeof actionsStore$, "loadUsers">, Promise<void>>
  >;

  it("the projected result shape matches runtime behavior", async () => {
    expect(typeof actionsStore$.incrementBy).toBe("function");
    await expect(actionsStore$.loadUsers()).resolves.toBeUndefined(); // Promise<void> settles after commit (A6)
  });
});

describe("U4 — InferEvents and InferEventPayload", () => {
  type _EventsMap = Expect<
    Equals<
      InferEvents<typeof stackedStore$>,
      {
        FETCH(amount: number): void;
        RECEIVE_USERS(users: User[]): void;
      }
    >
  >;
  type _FetchPayload = Expect<Equals<InferEventPayload<typeof stackedStore$, "FETCH">, number>>;
  type _ReceivePayload = Expect<
    Equals<InferEventPayload<typeof stackedStore$, "RECEIVE_USERS">, User[]>
  >;

  it("event methods decorate the stacked instance beside the action surface", () => {
    expect(typeof stackedStore$.FETCH).toBe("function");
    expect(typeof stackedStore$.RECEIVE_USERS).toBe("function");
    expect(typeof stackedStore$.incrementBy).toBe("function"); // actions survive the adapter
  });
});

describe("U5 — Unknown names fail at compile time", () => {
  // Each directive pins exactly one failing statement; tsc proves they stay
  // live (a statement that stopped failing makes its directive unused — a
  // compile error). The helpers never widen to any: the exact-map Equals
  // witnesses in U2–U4 would be false for an `any` projection, and reading
  // an undeclared name off a projection fails like these.
  // @ts-expect-error — "nope" is not a declared action name (constraint failure at the helper call)
  type _NoActionParam = InferActionParameters<typeof actionsStore$, "nope">;
  // @ts-expect-error — same constraint on the result helper
  type _NoActionResult = InferActionResult<typeof actionsStore$, "nope">;
  // @ts-expect-error — same constraint on the payload helper
  type _NoEventPayload = InferEventPayload<typeof stackedStore$, "nope">;
  // @ts-expect-error — undeclared name read off the action projection, never any
  type _NoActionMember = InferActions<typeof actionsStore$>["nope"];
  // @ts-expect-error — undeclared name read off the event projection, never any
  type _NoEventMember = InferEvents<typeof stackedStore$>["nope"];

  it("undeclared names are absent from the instances the projections read", () => {
    expect("nope" in actionsStore$).toBe(false);
    expect("nope" in stackedStore$).toBe(false);
  });
});

describe("U6 — Utilities work through wrappers", () => {
  // Identical projections at every wrapper depth (the branding contract's
  // observable promise). The stacked legs also prove all three phantoms
  // (data, actions, events) read side by side on one instance.
  type _ValueThroughActions = Expect<
    Equals<InferValue<typeof plainValue$>, InferValue<typeof actionsValue$>>
  >;
  type _ValueThroughEvents = Expect<
    Equals<InferValue<typeof actionsValue$>, InferValue<typeof rxValue$>>
  >;
  type _StateThroughWrappers = Expect<
    Equals<InferState<typeof plainStore$>, InferState<typeof stackedStore$>>
  >;
  type _ActionsThroughStack = Expect<
    Equals<InferActions<typeof actionsStore$>, InferActions<typeof stackedStore$>>
  >;
  type _ParamsThroughStack = Expect<
    Equals<InferActionParameters<typeof stackedStore$, "incrementBy">, [amount: number]>
  >;
  type _ResultThroughStack = Expect<
    Equals<InferActionResult<typeof stackedStore$, "loadUsers">, Promise<void>>
  >;

  // Single-owner wiring (ADR-0003): each entry re-export IS the utils helper.
  type _ValueEntryIsOwner = Expect<
    Equals<InferValue<typeof counter$>, InferValueUtils<typeof counter$>>
  >;
  type _StateEntryIsOwner = Expect<
    Equals<InferState<typeof plainStore$>, InferStateUtils<typeof plainStore$>>
  >;
  type _ActionsEntryIsOwner = Expect<
    Equals<InferActions<typeof actionsStore$>, InferActionsUtils<typeof actionsStore$>>
  >;
  type _ParamsEntryIsOwner = Expect<
    Equals<
      InferActionParameters<typeof actionsStore$, "incrementBy">,
      InferActionParametersUtils<typeof actionsStore$, "incrementBy">
    >
  >;
  type _ResultEntryIsOwner = Expect<
    Equals<
      InferActionResult<typeof actionsStore$, "loadUsers">,
      InferActionResultUtils<typeof actionsStore$, "loadUsers">
    >
  >;
  type _EventsEntryIsOwner = Expect<
    Equals<InferEvents<typeof stackedStore$>, InferEventsUtils<typeof stackedStore$>>
  >;
  type _PayloadEntryIsOwner = Expect<
    Equals<
      InferEventPayload<typeof stackedStore$, "FETCH">,
      InferEventPayloadUtils<typeof stackedStore$, "FETCH">
    >
  >;

  it("wrapper depths share one runtime state owner", () => {
    actionsValue$.nudge();
    expect(plainValue$.get()).toBe(1); // one cell owns the state (A1)
    expect(rxValue$.get()).toBe(1); // the event layer reads through the same chain
    expect(typeof rxValue$.TOUCH).toBe("function");
  });
});
