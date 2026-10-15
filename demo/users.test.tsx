import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UsersPage, userStore$ } from "./UsersView";
import type { User } from "./types";

const twoUsers: User[] = [
  { id: 1, profile: { city: "KRK" } },
  { id: 2, profile: { city: "WAW" } },
];

afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

beforeEach(() => {
  act(() => userStore$.reset());
  // External boundary mocked per testing-guide; two-user witness of D3.
  vi.stubGlobal("fetch", vi.fn(async () => ({ json: async () => twoUsers })));
});

describe("D3 — RxJS example renders fetched users", () => {
  it("FETCH(5) through the spec pipeline shows '2 users' for the two-user stub", async () => {
    render(<UsersPage />);
    expect(screen.getByText("0 users")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "FETCH(5)" }));

    expect(await screen.findByText("2 users")).toBeInTheDocument();
    // the tap(incrementBy) leg ran mid-pipeline; skipOn stayed inert (R4-consistent)
    expect(userStore$.counter$.get()).toBe(5);
    expect(userStore$.data$.get()).toBe(twoUsers);
  });
});
