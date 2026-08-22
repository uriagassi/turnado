import type { Document } from "../documents/Documents.js";
import type { Task } from "../tasks/Tasks.js";

export interface AppointmentChecklist {
  readyCount: number;
  totalCount: number;
}

/**
 * Combined readiness for an appointment's checklist (issue #9): every
 * attached document is inherently "ready" (having it *is* the ready state),
 * while a linked task is ready only once its own status is "done" — the two
 * kinds share one readiness count/total rather than being scored separately,
 * so the appointment detail screen's single indicator (e.g. "4 of 5 ready")
 * can span both sections.
 */
/**
 * Every task tied to this appointment: it either spawned the task as a
 * prerequisite (sourceAppointmentId — e.g. the auto-created "Form 17" task
 * from an uploaded invitation, issue #8) or the task was itself resolved
 * onto this appointment (pendingAppointmentId — e.g. a test task scheduled
 * as a follow-up). A task pointing at this appointment through both fields
 * still appears once.
 */
export function selectAppointmentTasks(tasks: Task[], appointmentId: number): Task[] {
  return tasks.filter((t) => t.sourceAppointmentId === appointmentId || t.pendingAppointmentId === appointmentId);
}

export function computeAppointmentChecklist(documents: Document[], tasks: Task[]): AppointmentChecklist {
  const readyTasks = tasks.filter((t) => t.status === "done").length;
  return {
    readyCount: documents.length + readyTasks,
    totalCount: documents.length + tasks.length,
  };
}
