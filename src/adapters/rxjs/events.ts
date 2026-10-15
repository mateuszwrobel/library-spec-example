import { map, of, Subscription, tap } from "rxjs";
import type { Observable } from "rxjs";
import type { AnyEvent, EventStage } from "./types";

/** Loose event-map view used by the implementation body; public precision lives in ./types. */
export type EventRecord = Record<string, AnyEvent>;

/** Loose kit surface; the typed `EventKit<E>` in ./types is its public counterpart. */
export interface LooseKit {
  forward: Record<string, (mapper: (streamValue: any) => unknown) => EventStage>;
  skipOn: (event: string) => EventStage;
}

/**
 * The run whose stages are currently being constructed.
 *
 * An event run is constructed synchronously: the declaration is invoked, the
 * operator array is applied stage by stage, and the chain is subscribed — all
 * in one stack (RxJS subscription runs synchronously through the whole chain
 * until an async boundary). `skipOn` stages capture their run here at
 * application time, inside that window. Nested runs — a `forward` triggering
 * a fresh run from inside the outer run's value delivery — save and restore,
 * so every stage captures its own run, never one from an unrelated nesting.
 */
let constructing: Subscription | null = null;

/**
 * The stream lifecycle decorator (workplan_rxjs.md).
 *
 * One behavior: turning an event declaration into an independent RxJS run.
 * Each event method call constructs a fresh stream starting from the payload
 * and applies the declared operator array in order (R1); the method itself
 * returns void — observation happens through the wrapped primitive's
 * subscriptions, never through a result handle.
 *
 * `skipOn(event)` is a stream-local terminator placed as an array entry. Its
 * stage arms the first time a stream value reaches the entry's position;
 * while armed, any emission of the named event unsubscribes THIS run:
 * operators later in the array never execute, effects already committed
 * upstream are irreversible (RxJS semantics respected, R3), and other runs
 * plus the named event's own handlers proceed (R4). Emissions arriving
 * before the run reaches the position never terminate it — the scope is
 * "from its position downstream".
 *
 * An event invocation is an emission: `emit` notifies other runs' armed
 * stages before the invoked run is constructed, so a run can never be killed
 * by its own birth and the named event's own pipeline always runs.
 *
 * Stream lifetime follows the computed-cell precedent (no dispose API): runs
 * end by completing, erroring, or being terminated — every path closes the
 * run's Subscription, which owns both the chain and the armed-listener
 * detachers added while the run was alive. No pending timer or listener
 * outlives a finished run; nothing dangles between calls. Errors terminate
 * the run silently, same as completion — authors compose error handling
 * (e.g. `catchError`) inside the array per the R4 independence decision:
 * a fire-and-forget run has no caller to receive a rethrow.
 */
export function createEvents(
  primitive: object,
  factory: (primitive: object, kit: LooseKit) => EventRecord,
): object {
  // event name -> armed terminators, each closing the run that armed it.
  const armed = new Map<string, Set<() => void>>();

  const listen = (event: string, terminate: () => void): (() => void) => {
    const listeners = armed.get(event) ?? new Set<() => void>();
    armed.set(event, listeners);
    listeners.add(terminate);
    return () => listeners.delete(terminate);
  };

  const emit = (event: string): void => {
    const listeners = armed.get(event);
    if (listeners === undefined) {
      return;
    }
    for (const terminate of [...listeners]) {
      terminate();
    }
  };

  const kit: LooseKit = {
    forward: {},
    skipOn: (event: string): EventStage => (source) => {
      // Applied synchronously inside a run construction window — the captured
      // run is exactly the one this stage can terminate.
      const run = constructing as Subscription;
      let armedHere = false;
      return source.pipe(
        tap(() => {
          if (!armedHere) {
            armedHere = true; // the value reached this position — arm from here
            const terminate = () => run.unsubscribe();
            run.add(listen(event, terminate)); // detaching rides the run's own teardown
          }
        }),
      );
    },
  };

  const eventMap = factory(primitive, kit); // a throwing factory propagates; nothing is bound yet

  const runEvent = (event: string, payload: unknown[]): void => {
    emit(event); // the invocation IS the emission — notify armed runs before constructing this one
    const controller = new Subscription();
    const outer = constructing;
    constructing = controller;
    try {
      const stages = eventMap[event](...payload); // fresh declaration call per event method call (R1)
      const stream$ = stages.reduce<Observable<any>>(
        (stream, stage) => stage(stream),
        // The payload is the stream's starting value (R1); zero-payload
        // events start from undefined.
        of(payload.length > 0 ? payload[0] : undefined),
      );
      controller.add(
        stream$.subscribe({
          // Declared-order application done; fire-and-forget: the method
          // returns void (Decisions). Terminal notifications close the run —
          // chain teardown plus every listener the run armed.
          complete: () => controller.unsubscribe(),
          error: () => controller.unsubscribe(),
        }),
      );
    } finally {
      constructing = outer;
    }
  };

  const runners: Record<string, (...payload: unknown[]) => void> = {};
  for (const event of Object.keys(eventMap)) {
    // forward is literally this bound surface, filled after the factory
    // returns (actions-lane precedent): the mapper transforms the current
    // stream value — compile-time checked against the target payload — and
    // the mapped value starts a FRESH run of the target's own pipeline.
    // It triggers; it does not re-inject (R2, Decisions). The mapped value
    // also flows downstream as the new stream value (forward is a map stage).
    kit.forward[event] = (mapper) => (source) =>
      source.pipe(map(mapper), tap((streamValue) => runEvent(event, [streamValue])));
    runners[event] = (...payload) => runEvent(event, payload);
  }

  // The decorated instance is callable — its hook call delegates to the
  // wrapped primitive's hook call — and carries the wrapped API (same cell
  // and action-method objects) plus own event methods. The wrapped primitive
  // is never mutated; the composition root stays the single owner of state
  // lifecycle (R5). Event names colliding with wrapped members shadow the
  // copied surface exactly like action names do (actions-lane ruling); the
  // wrapped primitive itself keeps its semantics.
  const hookCall = (): unknown => (primitive as () => unknown)();
  return Object.assign(hookCall, primitive, runners);
}
