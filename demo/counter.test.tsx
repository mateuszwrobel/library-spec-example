import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Component, counter$, users$ } from "./CounterView";

afterEach(cleanup);

beforeEach(() => {
  act(() => {
    counter$.reset();
    users$.reset();
  });
});

describe("D1 — Counter example behaves as specified", () => {
  it("button shows the witnessed copy and updates it after one click", async () => {
    render(<Component />);

    const button = screen.getByRole("button");
    expect(button).toHaveTextContent("0 (0 users, 0 total)");

    await userEvent.click(button);
    expect(button).toHaveTextContent("1 (0 users, 1 total)");
  });
});
