import type { Brand } from "@paker/utils";
import type { EventRecord, LooseKit } from "./events";
import { createEvents } from "./events";
import type { AnyEvent, DecoratedEvents, EventFactory } from "./types";

export type {
  AnyEvent,
  DecoratedEvents,
  EventFactory,
  EventKit,
  EventStage,
  EventSurface,
  ForwardSurface,
} from "./types";

/**
 * The RxJS event decorator (workplan_rxjs.md). Accepts a value cell, a store,
 * or either wrapped in actions — any `Brand`-carrying Paker instance — plus an
 * event factory receiving the primitive's cells/action methods and a
 * `{ forward, skipOn }` kit; each event declaration maps a payload signature
 * to an operator array.
 *
 * Every event method call constructs a fresh stream starting from the payload
 * and pipes the declared operators in order; the method returns `void` —
 * observation happens through the wrapped primitive's subscriptions (R1).
 * Concurrent calls are independent runs (R4). `forward.EVENT(mapper)` is a
 * stage that maps the current stream value — the mapper's return is checked
 * against EVENT's payload type at compile time, and `forward` exposes only
 * same-factory event names — then triggers a fresh run of that event's own
 * pipeline (R2). `skipOn(NAME)` is a stream-local terminator: it arms when a
 * value reaches its array position and, from there downstream, any emission
 * of NAME unsubscribes this run — operators later in the array never execute,
 * effects already committed upstream are not reverted, and other runs plus
 * NAME's own handlers proceed (R3, R4). Unknown event names in calls, in
 * `forward`, or in `skipOn` are compile-time failures.
 *
 * The decorated instance keeps the wrapped API in full — state, action,
 * subscription, and hook-call behavior unchanged (R5) — passes the inner
 * `Brand` through (ADR-0003), and adds one `void` event method per declared
 * event. This module is the sole importer of RxJS (ADR-0002, guard rule
 * `rxjs-confined`). Factories that touch `forward`/`skipOn` pin the event map
 * with a return annotation (parent ruling, 2026-10-15 — the same inference
 * cycle as actions factories); factories that never touch the kit infer
 * without annotations. `InferEvents` and `InferEventPayload` re-exports land
 * here from utils once the helper projections exist (ADR-0003) — no RxJS
 * types may appear in their resolutions.
 */
export function rxjs<P extends Brand<unknown>, E extends { [K in keyof E]: AnyEvent }>(
  primitive: P,
  factory: EventFactory<P, E>,
): DecoratedEvents<P, E>;
export function rxjs(primitive: object, factory: unknown): object {
  return createEvents(primitive, factory as (primitive: object, kit: LooseKit) => EventRecord);
}
