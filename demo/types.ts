/**
 * Domain types for the demo witnesses only — the library is generic and holds
 * no domain models (parent Assumptions). Shapes mirror the lane test fixtures.
 */

export type Profile = { city: string };

export type User = { id: number; profile: Profile };

export type UserState = { data: User[]; counter: number };
