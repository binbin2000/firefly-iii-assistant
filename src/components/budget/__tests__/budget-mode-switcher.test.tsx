import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BudgetModeSwitcher } from "@/components/budget/budget-mode-switcher";

describe("BudgetModeSwitcher", () => {
  it("shows both modes and highlights the active one", () => {
    render(<BudgetModeSwitcher mode="follow-up" onModeChange={() => undefined} />);

    expect(screen.getByRole("button", { name: "Uppföljning" })).toHaveClass("bg-slate-950");
    expect(screen.getByRole("button", { name: "Årsplanering" })).not.toHaveClass(
      "bg-slate-950",
    );
  });

  it("reports the selected mode", () => {
    const onModeChange = vi.fn();
    render(<BudgetModeSwitcher mode="follow-up" onModeChange={onModeChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Årsplanering" }));

    expect(onModeChange).toHaveBeenCalledOnce();
    expect(onModeChange).toHaveBeenCalledWith("planning");
  });
});
