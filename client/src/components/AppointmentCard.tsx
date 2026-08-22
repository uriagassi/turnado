import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Appointment, AppointmentStatus, Doctor } from "../api";
import { formatDateTime } from "../formatDateTime";
import { MissedReminderBadge } from "./MissedReminderBadge";

/**
 * One appointment row: shared by UpcomingAppointmentsScreen and
 * AppointmentHistoryScreen so "what an appointment row looks like" —
 * including the status control, editing, and the post-visit summary — lives
 * in one place instead of being reimplemented per screen (see issue #4 AC:
 * four-state status and summary need to work from either list).
 *
 * The doctor's name is shown but deliberately not a link here — the doctor
 * isn't why you're on this list (see issue #4's original doctor-link AC,
 * superseded by this one); the explicit Details button below is the one
 * way off this row, and it's the checklist screen it opens where following
 * through to the doctor now lives (see AppointmentDetailScreen).
 */
export function AppointmentCard({
  appointment,
  doctor,
  onEdit,
  onStatusChange,
  onSaveSummary,
  onSelect,
}: {
  appointment: Appointment;
  doctor?: Doctor;
  onEdit: (appointment: Appointment) => void;
  onStatusChange: (appointment: Appointment, status: AppointmentStatus) => void;
  onSaveSummary: (appointment: Appointment, summary: string) => void;
  /** Opens the appointment's own detail/checklist screen (issue #9). */
  onSelect?: (appointment: Appointment) => void;
}) {
  const { t, i18n } = useTranslation();
  // Local draft so typing doesn't round-trip through the parent on every
  // keystroke — reset per appointment since the card is keyed by id.
  const [summaryDraft, setSummaryDraft] = useState(appointment.summary ?? "");

  return (
    <li className="appointment-row">
      <span className="appointment-date">{formatDateTime(appointment.dateTime, i18n.language)}</span>
      {doctor && <span className="appointment-doctor-name">{doctor.name}</span>}
      <span className="appointment-notes">{appointment.notes}</span>
      {appointment.location && <span className="appointment-location">{appointment.location}</span>}
      {appointment.missedReminder && <MissedReminderBadge reason={appointment.missedReminder} />}
      <div className="appointment-row-actions">
        {onSelect && (
          <button type="button" className="edit-appointment" onClick={() => onSelect(appointment)}>
            {t("appointmentCard.details")}
          </button>
        )}
        <button type="button" className="edit-appointment" onClick={() => onEdit(appointment)}>
          {t("appointmentCard.edit")}
        </button>
        {/* status-<value> class picks the pill color from the prototypes'
            shared badge palette (see index.css) — see appointment-status-field.status-*. */}
        <label className={`appointment-status-field status-${appointment.status}`}>
          {t("appointmentCard.status.label")}
          <select
            value={appointment.status}
            onChange={(e) => onStatusChange(appointment, e.target.value as AppointmentStatus)}
          >
            <option value="planned">{t("appointmentCard.status.planned")}</option>
            <option value="done">{t("appointmentCard.status.done")}</option>
            <option value="cancelled">{t("appointmentCard.status.cancelled")}</option>
            <option value="postponed">{t("appointmentCard.status.postponed")}</option>
          </select>
        </label>
      </div>
      {/* Post-visit summary only makes sense once the visit has actually
          happened (AC: "added to an appointment after it happens") — hidden
          for the other three statuses rather than offered up front. */}
      {appointment.status === "done" && (
        <div className="appointment-summary-field">
          <label>
            {t("appointmentCard.summary.label")}
            <textarea value={summaryDraft} onChange={(e) => setSummaryDraft(e.target.value)} />
          </label>
          <button
            type="button"
            className="save-summary"
            disabled={summaryDraft === (appointment.summary ?? "")}
            onClick={() => onSaveSummary(appointment, summaryDraft)}
          >
            {t("appointmentCard.summary.save")}
          </button>
        </div>
      )}
    </li>
  );
}
