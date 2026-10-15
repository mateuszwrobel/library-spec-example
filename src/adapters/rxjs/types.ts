import type { OperatorFunction } from "rxjs";
import type { EventsBrand } from "@paker/utils";

/**
 * One stage of an event pipeline — an RxJS operator function, untyped across
 * the heterogeneous chain because the author's operators carry their own in/
 * out types inside the array while the adapter only guarantees declared-order
 * composition (workplan_rxjs.md, R1). This alias is the adapter's single
 * RxJS-typed surface item; `InferEvents`/`InferEventPayload` projections
 * (utils lane) read event payload types from method signatures only and
 * never mention it (ADR-0002 neutral consequence).
 */
export type EventStage = OperatorFunction<any, any>;

/**
 * Any function an event-map member may be. `any[]` in this constraint is the
 * deliberate fallback shape for the factory's generic inference — the
 * homomorphic constraint `{ [K in keyof E]: AnyEvent }` makes an unpinned
 * factory that references the kit fall back `E` to `{}`: a loud compile
 * failure at the `forward`/`skipOn` call, never a silently widened surface.
 * The inference cycle (kit ← event map ← factory return ← factory body ← kit)
 * is intrinsic — the parent ruling of 2026-10-15 applies to event factories
 * exactly as to actions factories: factories using forward/skipOn pin the map
 * with a return annotation; factories that never touch the kit infer with
 * zero annotations (workplan_rxjs.md, Decisions).
 */
export type AnyEvent = (...payload: any[]) => readonly EventStage[];

/**
 * The method surface added by decoration: declared parameter tuples are
 * preserved verbatim (labels and optionality survive through `infer P`),
 * the result is always `void` — observation happens through the wrapped
 * primitive's subscriptions, no selector, no result handle (workplan_rxjs.md,
 * Decisions; R1).
 */
export type EventSurface<E> = {
  [K in keyof E]: E[K] extends (...payload: infer P) => unknown ? (...payload: P) => void : never;
};

/** First payload parameter of an event declaration. */
type EventPayload<F> = F extends (payload: infer P, ...rest: any[]) => unknown ? P : never;

/**
 * The same-factory-only trigger surface: `forward.EVENT(mapper)` is a
 * pipeline stage that maps the current stream value — checked at compile
 * time against EVENT's payload type — and runs EVENT's own pipeline with it
 * (R2). `forward` exposes only event names declared by the same factory, and
 * the stage itself leaks nothing observable (workplan_rxjs.md, Decisions).
 */
export type ForwardSurface<E> = {
  [K in keyof E]: (mapper: (streamValue: any) => EventPayload<E[K]>) => EventStage;
};

/**
 * The kit received by every event factory. `skipOn` is typed against the
 * same pinned event map: an unknown event name is a compile-time failure
 * (`Fails` segment of the parent contract); at runtime it returns the
 * stream-local terminator stage described in `events.ts`.
 */
export type EventKit<E> = {
  forward: ForwardSurface<E>;
  skipOn: (event: Extract<keyof E, string>) => EventStage;
};

/**
 * The event factory contract: receives the wrapped primitive — the value
 * cell itself, the store with its `$`-suffixed cells, or either decorated
 * with actions (their methods are members of the same surface) — plus the
 * kit, and declares the event map (workplan_rxjs.md, API).
 */
export type EventFactory<P, E extends { [K in keyof E]: AnyEvent }> = (
  primitive: P,
  kit: EventKit<E>,
) => E;

/**
 * An instance decorated with typed event pipelines: the wrapped API in full
 * — cells, actions, subscriptions, hook calls (R5) — with `Brand<TData>`
 * passed through structurally (ADR-0003), plus one `void` event method per
 * declared event and the event-map brand (`EventsBrand`, ADR-0003) so
 * `InferEvents` reads the surface wrapper-transparently. The brand carries
 * only the pure `void` method surface — no RxJS type is reachable through it
 * (ADR-0002).
 */
export type DecoratedEvents<P, E> = P & EventSurface<E> & EventsBrand<EventSurface<E>>;
