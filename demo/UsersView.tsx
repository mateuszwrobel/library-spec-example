import { actions } from "@paker/actions";
import { rxjs } from "@paker/adapters/rxjs";
import type { EventStage } from "@paker/adapters/rxjs";
import { store } from "@paker/store";
import { from } from "rxjs";
import { switchMap, tap } from "rxjs/operators";
import { fetchUsers } from "./api";
import type { User, UserState } from "./types";

/**
 * D3 — the spec's RxJS example, as written (workplan_rxjs.md R2 witness is the
 * same shape). The event factory uses `forward`/`skipOn`, so it pins the event
 * map with a return annotation (parent ruling 2026-10-15). The skipOn leg is
 * present but inert in this witness: OTHER_ACTION never fires, so the FETCH
 * run flows through to `forward.RECEIVE_USERS` and data$ holds the stub's two
 * users ("2 users").
 */

type UserEvents = {
  FETCH: (amount: number) => EventStage[];
  RECEIVE_USERS: (users: User[]) => EventStage[];
  OTHER_ACTION: () => EventStage[];
};

export const userStore$ = rxjs(
  actions(store<UserState>(() => ({ data: [], counter: 0 })), (cells$) => ({
    incrementBy: (amount: number) => {
      cells$.counter$.set(cells$.counter$.get() + amount);
    },
  })),
  ({ data$, incrementBy }, { forward, skipOn }): UserEvents => ({
    FETCH: (amount: number) => [
      tap(() => incrementBy(amount)),
      switchMap(() => from(fetchUsers())),
      skipOn("OTHER_ACTION"),
      forward.RECEIVE_USERS((users) => users),
    ],
    RECEIVE_USERS: (users: User[]) => [tap(() => data$.set(users))],
    OTHER_ACTION: () => [tap(() => undefined)],
  }),
);

export function Users() {
  const data = userStore$.data$();
  return <span>{`${data.length} users`}</span>;
}

export function UsersPage() {
  return (
    <div>
      <h2>/users</h2>
      <button type="button" onClick={() => userStore$.FETCH(5)}>
        FETCH(5)
      </button>
      <Users />
    </div>
  );
}
