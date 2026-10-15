import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "./App";
import { counter$, users$ } from "./CounterView";
import { userStore$ } from "./StoreView";

afterEach(cleanup);

beforeEach(() => {
  act(() => {
    counter$.reset();
    users$.reset();
    userStore$.reset();
  });
});

describe("demo gallery — component exploration surface", () => {
  it("links route to the three spec example views", async () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "PAKER DEMO" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("link", { name: "/counter" }));
    expect(screen.getByRole("button")).toHaveTextContent("0 (0 users, 0 total)");

    await userEvent.click(screen.getByRole("link", { name: "/store" }));
    expect(screen.getByText("Whole: 0 (0 users)")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("link", { name: "/users" }));
    expect(screen.getByText("0 users")).toBeInTheDocument();
  });
});
