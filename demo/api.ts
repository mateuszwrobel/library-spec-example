import type { User } from "./types";

/**
 * The demo's single network edge (workplan_demo.md, Decisions): every fetch of
 * users goes through this one function. Tests stub the global `fetch`
 * (vi.stubGlobal per testing-guide); the dev server answers /api/users
 * statically from demo/public/api/users — the same two-user witness — so the
 * live demo runs offline.
 */
export async function fetchUsers(): Promise<User[]> {
  const response = await fetch("/api/users");
  return (await response.json()) as User[];
}
