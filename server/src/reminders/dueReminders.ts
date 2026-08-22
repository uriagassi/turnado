import type { Appointment } from "../appointments/Appointments.js";
import type { Task } from "../tasks/Tasks.js";

export type ReminderItemType = "appointment" | "task";

/**
 * One (item type, item id, target date) triple — the exact dedup key shape
 * ReminderLog keys off of (issue #10), so a rescheduled date is automatically
 * a new key with no special reset logic needed anywhere downstream.
 */
export interface DueReminder {
  itemType: ReminderItemType;
  itemId: number;
  targetDate: string;
}

/**
 * Every appointment/task due for a one-day-ahead reminder right now, derived
 * fresh from the DB on every hourly poll tick (issue #10) rather than
 * tracked as standing state. Lead time is fixed at day resolution: an item
 * is due when its own date is exactly tomorrow relative to `now`'s date,
 * regardless of time-of-day on either side.
 *
 * `timezone` is an IANA zone name (e.g. "Asia/Jerusalem", from the
 * `reminders.timezone` config key) that pins what "today"/"tomorrow" mean —
 * deliberately not the server process's own tz (which could be UTC in a
 * container regardless of where the household actually is) and not derived
 * per-recipient either, since the dedup key this feeds (item type, item id,
 * target date) is shared across every recipient and has no room for two
 * different "todays" to disagree.
 */
export function selectDueReminders(appointments: Appointment[], tasks: Task[], now: Date, timezone: string): DueReminder[] {
  const tomorrow = addDays(dateOnly(now, timezone), 1);

  const dueAppointments = dueItems(
    appointments,
    (a) => a.status === "planned" && dateOnly(new Date(a.dateTime), timezone) === tomorrow,
    "appointment",
    tomorrow,
  );
  const dueTasks = dueItems(
    tasks,
    (t) => (t.status === "open" || t.status === "in-progress") && t.dueDate === tomorrow,
    "task",
    tomorrow,
  );

  return [...dueAppointments, ...dueTasks];
}

// Shared filter->wrap shape behind both branches above: keep only the items
// due today, and wrap each into the (itemType, itemId, targetDate) key —
// the one thing an appointment-due-tomorrow and a task-due-tomorrow really
// have in common here, once "is it due" is left to the caller's predicate.
function dueItems<T extends { id: number }>(
  items: T[],
  isDue: (item: T) => boolean,
  itemType: ReminderItemType,
  targetDate: string,
): DueReminder[] {
  return items.filter(isDue).map((item) => ({ itemType, itemId: item.id, targetDate }));
}

// en-CA renders as YYYY-MM-DD, giving this the same shape Task.dueDate and
// the (itemType, itemId, targetDate) key already use, computed as that
// timezone's wall-clock calendar date rather than the instant's UTC date.
function dateOnly(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(date);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
