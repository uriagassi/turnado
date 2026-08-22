import type { Appointments } from "../appointments/Appointments.js";
import type { Tasks } from "../tasks/Tasks.js";
import type { Doctors } from "../doctors/Doctors.js";
import type { AllowList } from "../auth/AllowList.js";
import { ReminderLog } from "./ReminderLog.js";
import { selectDueReminders, selectPastDueItems, dateOnly, type DueReminder } from "./dueReminders.js";
import { buildReminderEmail, type ReminderEmailContent, type ReminderEmailItem } from "./reminderEmail.js";
import type { Mailer } from "./Mailer.js";

/**
 * A bag, not the positional constructor params used elsewhere in this
 * codebase (Appointments(db), Doctors(db, parentTagName)) — deliberately:
 * six collaborators plus two config values makes a positional list error-
 * prone to read and extend, even though TypeScript's own type-checking
 * would catch a same-shaped swap. Documents' constructor keeps db
 * positional and bundles only its non-collaborator config; this class has
 * enough collaborators that bundling all of them together reads clearer.
 */
export interface ReminderServiceDeps {
  appointments: Appointments;
  tasks: Tasks;
  doctors: Doctors;
  reminderLog: ReminderLog;
  allowList: AllowList;
  mailer: Mailer;
  /** Household timezone (config's reminders.timezone) — see dueReminders.ts's JSDoc for why this is shared, not per-recipient. */
  timezone: string;
  /** Injected so tests don't depend on real wall-clock time; defaults to the real clock. */
  clock?: () => Date;
}

/**
 * Orchestrates one hourly poll tick of issue #10's reminders: derives due
 * items (selectDueReminders), sends each to its single owner (not a
 * broadcast — see Appointment.ownerUsername's doc for why), dedups/retries
 * via ReminderLog, and detects both "missed" cases — sweepMissed's
 * "send failed" for rows with prior attempts, and this class's own
 * detection of "window closed before delivery" for items the log never
 * saw at all. An item with no resolvable recipient (unowned, or owned by
 * someone no longer allow-listed) is skipped silently: no send attempt,
 * no log entry — per the user's explicit call that pre-migration/orphaned
 * items shouldn't get a reminder or a false "missed" marker.
 */
export class ReminderService {
  private readonly deps: Required<ReminderServiceDeps>;

  constructor(deps: ReminderServiceDeps) {
    this.deps = { clock: () => new Date(), ...deps };
  }

  async runOnce(): Promise<void> {
    const { appointments, tasks, reminderLog, timezone, clock } = this.deps;
    const now = clock();
    const today = dateOnly(now, timezone);

    // Must run before the "window closed" detection below: sweepMissed
    // terminates every stale *pending* row (one with prior attempts) into
    // missed/"send failed" first, so anything left with no log row at all
    // by the time selectPastDueItems runs is genuinely never-attempted.
    reminderLog.sweepMissed(today);

    const allAppointments = appointments.list();
    const allTasks = tasks.list();

    for (const item of selectPastDueItems(allAppointments, allTasks, now, timezone)) {
      this.markWindowClosedIfUnlogged(item);
    }

    for (const item of selectDueReminders(allAppointments, allTasks, now, timezone)) {
      await this.sendIfDue(item);
    }
  }

  private markWindowClosedIfUnlogged(item: DueReminder): void {
    if (!item.ownerUsername) return; // unowned: no reminder was ever due for it (user's call — skip silently)
    if (this.deps.reminderLog.find(item.itemType, item.itemId, item.targetDate)) return; // already has history; sweepMissed (or an earlier send) already handled it
    this.deps.reminderLog.markMissed(item.itemType, item.itemId, item.targetDate, "window closed before delivery");
  }

  private async sendIfDue(item: DueReminder): Promise<void> {
    const { reminderLog, allowList, mailer } = this.deps;

    const existing = reminderLog.find(item.itemType, item.itemId, item.targetDate);
    if (existing && existing.status !== "pending") return; // sent or missed: terminal, never resend

    if (!item.ownerUsername) return; // unowned: skip silently, no log entry
    const email = allowList.emailFor(item.ownerUsername);
    const locale = allowList.localeFor(item.ownerUsername);
    if (!email || !locale) return; // owner no longer allow-listed: same "no resolvable recipient" skip

    const content = this.buildContent(item, locale);
    if (!content) return; // item vanished between selectDueReminders and here (deleted mid-tick) — nothing to send

    try {
      await mailer.send(email, content);
      reminderLog.markSent(item.itemType, item.itemId, item.targetDate);
    } catch (err) {
      // A real, unexpected delivery failure (SMTP down, auth rejected,
      // etc.) — logged like every other genuine-failure catch in this
      // codebase (Auth.ts's console.error(err) before its own 401), not
      // silently swallowed the way the *expected*, documented fallbacks
      // elsewhere in app.ts are. markFailed still lets the next tick retry.
      console.error(`Reminder send failed for ${item.itemType} ${item.itemId} (${item.targetDate}):`, err);
      reminderLog.markFailed(item.itemType, item.itemId, item.targetDate);
    }
  }

  private buildContent(item: DueReminder, locale: string): ReminderEmailContent | null {
    const emailItem = this.resolveEmailItem(item);
    if (!emailItem) return null;
    return buildReminderEmail(emailItem, locale, this.deps.timezone);
  }

  private resolveEmailItem(item: DueReminder): ReminderEmailItem | null {
    const { appointments, tasks } = this.deps;
    if (item.itemType === "appointment") {
      const appointment = appointments.get(item.itemId);
      if (!appointment) return null;
      return { itemType: "appointment", appointment, doctorName: this.doctorNameFor(appointment.doctorId) };
    }
    const task = tasks.get(item.itemId);
    if (!task) return null;
    return { itemType: "task", task, doctorName: this.doctorNameFor(task.doctorId) };
  }

  private doctorNameFor(doctorId: number | null): string | null {
    if (!doctorId) return null;
    return this.deps.doctors.get(doctorId)?.name ?? null;
  }
}
