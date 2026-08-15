import type { Task, TaskStatus, TaskType } from "../api";

export function getTaskIcon(type: TaskType): string {
  switch (type) {
    case "test":
      return "🩸";
    case "doctor_visit":
      return "🩺";
    case "form_17":
      return "📄";
    case "general_approval":
      return "✅";
    default:
      return "📌";
  }
}

export function isResolvableTask(task: Pick<Task, "type"> & Partial<Pick<Task, "requiresAdvanceScheduling">>): boolean {
  return task.type === "doctor_visit" || (task.type === "test" && Boolean(task.requiresAdvanceScheduling));
}

export function taskStatusClass(status: TaskStatus): string {
  switch (status) {
    case "in-progress":
      return "badge status-inprogress";
    case "done":
      return "badge status-done";
    case "open":
    default:
      return "badge status-open";
  }
}
