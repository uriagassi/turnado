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
  /** The source item's owner (issue #10) — null flows through as-is; ReminderService treats a null owner as "no reminder due" rather than guessing a recipient. */
  ownerUsername: string | null;
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

/**
 * Every appointment/task whose own date has already passed `now` (issue
 * #10's "window closed before delivery" case) — same reminder-eligibility
 * filter as selectDueReminders (planned appointment / open-or-in-progress
 * task with a due date), just for `date < today` instead of `date ===
 * tomorrow`. ReminderService cross-references this against ReminderLog: an
 * item here with zero log history means the server was down for that
 * item's *entire* one-day-ahead window, since selectDueReminders would
 * have surfaced it — and therefore created a log row — on some earlier
 * tick otherwise.
 */
export function selectPastDueItems(appointments: Appointment[], tasks: Task[], now: Date, timezone: string): DueReminder[] {
  const today = dateOnly(now, timezone);

  const pastAppointments = pastDueItems(
    appointments,
    (a) => a.status === "planned",
    "appointment",
    (a) => dateOnly(new Date(a.dateTime), timezone),
    today,
  );
  const pastTasks = pastDueItems(
    tasks,
    (t) => (t.status === "open" || t.status === "in-progress") && !!t.dueDate,
    "task",
    (t) => t.dueDate!,
    today,
  );

  return [...pastAppointments, ...pastTasks];
}

// Mirrors dueItems below, but each item's targetDate is its own date rather
// than one shared "tomorrow" — so targetDateOf is computed once per item
// (via the intermediate map) instead of once for the filter and again for
// the wrap, the way a single combined filter+map predicate would otherwise
// require.
function pastDueItems<T extends { id: number; ownerUsername: string | null }>(
  items: T[],
  isEligible: (item: T) => boolean,
  itemType: ReminderItemType,
  targetDateOf: (item: T) => string,
  today: string,
): DueReminder[] {
  return items
    .filter(isEligible)
    .map((item) => ({ item, targetDate: targetDateOf(item) }))
    .filter(({ targetDate }) => targetDate < today)
    .map(({ item, targetDate }) => wrap(item, itemType, targetDate));
}

// Shared filter->wrap shape behind both branches above: keep only the items
// due today, and wrap each into the (itemType, itemId, targetDate) key —
// the one thing an appointment-due-tomorrow and a task-due-tomorrow really
// have in common here, once "is it due" is left to the caller's predicate.
function dueItems<T extends { id: number; ownerUsername: string | null }>(
  items: T[],
  isDue: (item: T) => boolean,
  itemType: ReminderItemType,
  targetDate: string,
): DueReminder[] {
  return items.filter(isDue).map((item) => wrap(item, itemType, targetDate));
}

function wrap<T extends { id: number; ownerUsername: string | null }>(
  item: T,
  itemType: ReminderItemType,
  targetDate: string,
): DueReminder {
  return { itemType, itemId: item.id, targetDate, ownerUsername: item.ownerUsername };
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
