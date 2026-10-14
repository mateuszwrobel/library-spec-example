/**
 * SameValueZero — the notification-skip rule (parent decision, V3):
 * `===` covers primitives, reference identity, and ±0; the self-inequality
 * check covers NaN.
 */
export function sameValueZero(a: unknown, b: unknown): boolean {
  return a === b || (a !== a && b !== b);
}
