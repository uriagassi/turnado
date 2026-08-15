import type { Appointment } from "./Appointments.js";

/**
 * Every still-upcoming planned appointment, soonest first — the full list
 * behind both the home screen's hero card (the first entry) and the
 * "upcoming appointments" view (the whole list), so the two can never
 * disagree about what counts as upcoming.
 */
export function selectUpcomingAppointments(appointments: Appointment[], now: Date): Appointment[] {
  return appointments
    .filter((a) => a.status === "planned" && new Date(a.dateTime) >= now)
    .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
}

/**
 * Picks the appointment for the home screen's "hero" card: the soonest
 * still-upcoming planned appointment, or none if there isn't one.
 */
export function selectHeroAppointment(appointments: Appointment[], now: Date): Appointment | null {
  return selectUpcomingAppointments(appointments, now)[0] ?? null;
}
