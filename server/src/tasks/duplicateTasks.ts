import type { TaskStatus, TaskType } from "./Tasks.js";

/** The subset of a Task that similarity comparison actually looks at. */
export interface SimilarityCandidate {
  id: number;
  type: TaskType;
  status: TaskStatus;
  doctorId: number | null;
  dueDate: string | null;
}

const SIMILARITY_WINDOW_DAYS = 30;
const OPEN_STATUSES: ReadonlySet<TaskStatus> = new Set(["open", "in-progress"]);

/** Bare `YYYY-MM-DD` strings parse as UTC midnight, so a plain millisecond diff is safe here (issue #10's dueDate decision applies the same way). */
function daysBetween(a: string, b: string): number {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / (24 * 60 * 60 * 1000);
}

/**
 * Issue #12's similarity rule: same type, same linked doctor (only when
 * both sides actually have one — a task with no doctor can never be "the
 * same doctor" as anything, so it's excluded rather than treated as a
 * wildcard), and due dates within 30 days of each other when both are set.
 * A task with no due date on either side skips the date check entirely
 * (compared on type + doctor only), rather than treating a missing date as
 * infinitely far away.
 */
export function areSimilarTasks(a: SimilarityCandidate, b: SimilarityCandidate): boolean {
  if (a.type !== b.type) return false;
  if (a.doctorId === null || b.doctorId === null || a.doctorId !== b.doctorId) return false;
  if (a.dueDate && b.dueDate && daysBetween(a.dueDate, b.dueDate) > SIMILARITY_WINDOW_DAYS) return false;
  return true;
}

/**
 * Every current candidate similar to `candidate`, drawn only from
 * open/in-progress tasks in `pool` (done tasks never trigger a match, per
 * the AC) and never matching `candidate` against itself.
 */
export function findSimilarTasks<T extends SimilarityCandidate>(candidate: SimilarityCandidate, pool: T[]): T[] {
  return pool.filter((t) => t.id !== candidate.id && OPEN_STATUSES.has(t.status) && areSimilarTasks(candidate, t));
}

/**
 * Attaches `similarTaskIds` to each task in `items`, computed live against
 * `pool` (typically the full task list) — never persisted, per the AC.
 * Only open/in-progress tasks are ever flagged: once a task is done it's no
 * longer a duplicate risk, even if an open counterpart still matches it.
 */
export function withSimilarTaskIds<T extends SimilarityCandidate>(
  items: T[],
  pool: SimilarityCandidate[],
): (T & { similarTaskIds: number[] })[] {
  return items.map((item) => ({
    ...item,
    similarTaskIds: OPEN_STATUSES.has(item.status) ? findSimilarTasks(item, pool).map((t) => t.id) : [],
  }));
}
