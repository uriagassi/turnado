import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmationModal } from "./ConfirmationModal";

describe("ConfirmationModal", () => {
  it("renders title, message, and action buttons", () => {
    render(
      <ConfirmationModal
        title="Mark task as completed?"
        message="Would you like to complete this task now?"
        confirmLabel="Yes, complete"
        cancelLabel="Keep open"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Mark task as completed?")).toBeInTheDocument();
    expect(screen.getByText("Would you like to complete this task now?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Yes, complete" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Keep open" })).toBeInTheDocument();
  });

  it("calls onConfirm when confirm button is clicked", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    render(
      <ConfirmationModal
        title="Mark task as completed?"
        message="Would you like to complete this task now?"
        confirmLabel="Yes, complete"
        cancelLabel="Keep open"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: "Yes, complete" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("calls onCancel when cancel button or backdrop is clicked", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();

    render(
      <ConfirmationModal
        title="Mark task as completed?"
        message="Would you like to complete this task now?"
        confirmLabel="Yes, complete"
        cancelLabel="Keep open"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    );

    await user.click(screen.getByRole("button", { name: "Keep open" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("calls onCancel on Escape key press", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();

    render(
      <ConfirmationModal
        title="Mark task as completed?"
        message="Would you like to complete this task now?"
        confirmLabel="Yes, complete"
        cancelLabel="Keep open"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    );

    await user.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
