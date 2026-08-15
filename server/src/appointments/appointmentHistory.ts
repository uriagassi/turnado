import type { Appointment } from "./Appointments.js";

/**
 * Selects appointments for the history/archive view: everything whose
 * dateTime has already passed, most recent first. Deliberately includes
 * every status (done/cancelled/postponed, even a planned appointment that
 * slipped by unactioned) — "past" here means the slot itself elapsed, not
 * that anything was recorded about it.
 */
export function selectPastAppointments(appointments: Appointment[], now: Date): Appointment[] {
  return appointments
    .filter((a) => new Date(a.dateTime) < now)
    .sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());
}
