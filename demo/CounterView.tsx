import { value } from "@paker/value";
import type { User } from "./types";

/**
 * D1 — the spec's Counter example, as written. Two source cells plus the V6
 * computed; the button copy is the contractual witness
 * ("0 (0 users, 0 total)" → "1 (0 users, 1 total)").
 */

export const counter$ = value(0);

export const users$ = value<User[]>([]);

export const total$ = value([counter$, users$], (counter, users) => counter + users.length);

export function Component() {
  const counter = counter$();
  const users = users$();
  const total = total$();
  return (
    <button type="button" onClick={() => counter$.set((current) => current + 1)}>
      {`${counter} (${users.length} users, ${total} total)`}
    </button>
  );
}
