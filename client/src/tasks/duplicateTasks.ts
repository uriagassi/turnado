import type { Task, TaskStatus, TaskType } from "../api";

const SIMILARITY_WINDOW_DAYS = 30;
const OPEN_STATUSES: ReadonlySet<TaskStatus> = new Set(["open", "in-progress"]);

function daysBetween(a: string, b: string): number {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / (24 * 60 * 60 * 1000);
}

/**
 * Client-side counterpart of the server's areSimilarTasks (see
 * server/src/tasks/duplicateTasks.ts) — kept identical so the creation
 * form's live warning can never disagree with the persisted badge it's
 * previewing. Same type, same linked doctor (only when both sides actually
 * have one), and due dates within 30 days when both are set; a missing due
 * date on either side skips the date check entirely.
 */
function areSimilarTasks(
  a: { type: TaskType; doctorId: number | null; dueDate: string | null },
  b: { type: TaskType; doctorId: number | null; dueDate: string | null },
): boolean {
  if (a.type !== b.type) return false;
  if (a.doctorId === null || b.doctorId === null || a.doctorId !== b.doctorId) return false;
  if (a.dueDate && b.dueDate && daysBetween(a.dueDate, b.dueDate) > SIMILARITY_WINDOW_DAYS) return false;
  return true;
}

/**
 * Every currently open/in-progress task in `pool` similar to `candidate` —
 * used for the live "you might be creating a duplicate" check in
 * TaskFormScreen, run against whatever open items the client already has
 * loaded (issue #12). `excludeId` leaves out the task being edited so it
 * never matches itself.
 */
export function findSimilarTasks(
  candidate: { type: TaskType; doctorId: number | null; dueDate: string | null },
  pool: Task[],
  excludeId?: number,
): Task[] {
  return pool.filter(
    (t) => t.id !== excludeId && OPEN_STATUSES.has(t.status) && areSimilarTasks(candidate, t),
  );
}
