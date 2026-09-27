import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HomeScreen } from "../screens/HomeScreen";
import { TaskDetailScreen } from "../screens/TaskDetailScreen";
import type { Task } from "../api";
import { celebrateAfter } from "./celebrate";

// Issue #13 AC: the celebration is triggered identically from a home-screen
// row action and from an item's detail screen. Smoke level only — asserts
// both go through the same helper, anchored at the control that was used.
vi.mock("./celebrate", () => ({
  celebrateAfter: vi.fn(async (_anchor: Element, _event: unknown, save: () => unknown) => {
    await save();
  }),
}));

const task: Task = {
  id: 7,
  type: "general_approval",
  title: "Renew prescription",
  status: "open",
  doctorId: null,
  dueDate: null,
  sourceAppointmentId: null,
  pendingAppointmentId: null,
  requiresAdvanceScheduling: false,
  recurrenceWindow: null,
  approximateDateWindow: null,
  institution: null,
  department: null,
  healthFund: null,
  codeNumber: null,
  codeName: null,
  issuingBody: null,
  purpose: null,
  createdAt: "2026-08-01",
  updatedAt: "2026-08-01",
  missedReminder: null,
  similarTaskIds: [],
};

describe("completion celebration entry points", () => {
  beforeEach(() => {
    vi.mocked(celebrateAfter).mockClear();
  });

  it("celebrates from a home-screen open-item row without opening the task", async () => {
    const user = userEvent.setup();
    const onMarkTaskDone = vi.fn();
    const onSelectTask = vi.fn();
    render(
      <HomeScreen
        home={{ nextAppointment: null, openItems: [task], recentDocuments: [] }}
        doctors={[]}
        onSelectDoctor={() => {}}
        onAddAppointment={() => {}}
        onRefresh={() => {}}
        onSelectTask={onSelectTask}
        onMarkTaskDone={onMarkTaskDone}
      />,
    );

    const button = screen.getByRole("button", { name: "Mark “Renew prescription” as completed" });
    await user.click(button);

    expect(celebrateAfter).toHaveBeenCalledOnce();
    expect(vi.mocked(celebrateAfter).mock.calls[0][0]).toBe(button);
    expect(onMarkTaskDone).toHaveBeenCalledWith(task);
    expect(onSelectTask).not.toHaveBeenCalled();
  });

  it("celebrates from the task detail screen's mark-done action", async () => {
    const user = userEvent.setup();
    const onStatusChange = vi.fn();
    render(<TaskDetailScreen task={task} doctors={[]} onEdit={() => {}} onStatusChange={onStatusChange} />);

    const button = screen.getByRole("button", { name: /Mark as completed/ });
    await user.click(button);

    expect(celebrateAfter).toHaveBeenCalledOnce();
    expect(vi.mocked(celebrateAfter).mock.calls[0][0]).toBe(button);
    expect(onStatusChange).toHaveBeenCalledWith(task, "done");
  });

  it("does not celebrate reopening a done task", async () => {
    const user = userEvent.setup();
    render(<TaskDetailScreen task={{ ...task, status: "done" }} doctors={[]} onEdit={() => {}} onStatusChange={() => {}} />);

    await user.click(screen.getByRole("button", { name: /Reopen task/ }));

    expect(celebrateAfter).not.toHaveBeenCalled();
  });
});
