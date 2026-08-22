import type { Appointment } from "../appointments/Appointments.js";
import type { Task } from "../tasks/Tasks.js";
import { translate } from "../i18n/translate.js";

/** The rendered {subject, body} for one reminder email, in plain text, ready to hand to a mailer. */
export interface ReminderEmailContent {
  subject: string;
  body: string;
}

/**
 * Everything this needs to know about one due item, pre-resolved by the
 * caller — doctor lookup by id stays out of this pure function, the same
 * division of labor `dueReminders.ts` already uses for the DB itself.
 */
export type ReminderEmailItem =
  | { itemType: "appointment"; appointment: Appointment; doctorName: string | null }
  | { itemType: "task"; task: Task; doctorName: string | null };

/**
 * Renders one due item into an email {subject, body} in the recipient's
 * locale (issue #10: "one email per event ... with the key details
 * directly in the body"). `timezone` is the household zone (see
 * dueReminders.ts) — used only for the appointment's real date+time
 * instant; see buildTaskReminder for why a task's due date doesn't use it.
 */
export function buildReminderEmail(
  item: ReminderEmailItem,
  locale: string,
  timezone: string,
): ReminderEmailContent {
  if (item.itemType === "appointment") {
    return buildAppointmentReminder(item.appointment, item.doctorName, locale, timezone);
  }
  return buildTaskReminder(item.task, item.doctorName, locale);
}

function buildAppointmentReminder(
  appointment: Appointment,
  doctorName: string | null,
  locale: string,
  timezone: string,
): ReminderEmailContent {
  const dateTimeLabel = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  }).format(new Date(appointment.dateTime));

  const lines = [
    field(locale, "appointmentForm.doctor.label", doctorLabel(doctorName, locale)),
    field(locale, "appointmentForm.dateTime.label", dateTimeLabel),
    // location is genuinely optional (no NOT NULL on the column, unlike
    // notes) - omitted rather than shown as "Location: null" when unset.
    appointment.location ? field(locale, "appointmentForm.location.label", appointment.location) : null,
    field(locale, "appointmentForm.notes.label", appointment.notes),
  ].filter((line): line is string => line !== null);

  return {
    subject: translate(locale, "reminder.appointment.subject"),
    body: [translate(locale, "reminder.appointment.intro"), "", ...lines].join("\n"),
  };
}

function buildTaskReminder(task: Task, doctorName: string | null, locale: string): ReminderEmailContent {
  // selectDueReminders (seam 1) only ever surfaces a task that has a
  // dueDate - a flexible Test with none "never generates a reminder on its
  // own" per the AC - so reaching here with a null dueDate is a caller bug,
  // not a real case to render around. Failing loudly beats silently
  // formatting the Unix epoch (what `new Date(null)` would otherwise do).
  if (!task.dueDate) {
    throw new Error(`Task ${task.id} has no due date; it should never have reached buildReminderEmail`);
  }

  // task.dueDate is a bare YYYY-MM-DD calendar date with no time-of-day
  // component (confirmed in this repo's Task model) - formatted as UTC so
  // the day shown never shifts under a household timezone that was never
  // part of the value to begin with.
  const dueDateLabel = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(task.dueDate));

  const lines = [
    field(locale, "taskForm.type.label", translate(locale, `task.type.${task.type}`)),
    field(locale, "reminder.field.description", task.title),
    field(locale, "taskDetail.dueDate", dueDateLabel),
    field(locale, "taskDetail.doctor", doctorLabel(doctorName, locale)),
  ];

  return {
    subject: translate(locale, "reminder.task.subject", { title: task.title }),
    body: [translate(locale, "reminder.task.intro"), "", ...lines].join("\n"),
  };
}

function doctorLabel(doctorName: string | null, locale: string): string {
  return doctorName ?? translate(locale, "appointmentForm.doctor.none");
}

function field(locale: string, labelKey: string, value: string): string {
  return `${translate(locale, labelKey)}: ${value}`;
}
