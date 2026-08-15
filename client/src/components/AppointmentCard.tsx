import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Appointment, AppointmentStatus, Doctor } from "../api";
import { formatDateTime } from "../formatDateTime";

/**
 * One appointment row: shared by UpcomingAppointmentsScreen and
 * AppointmentHistoryScreen so "what an appointment row looks like" —
 * including the doctor-name link, the status control, editing, and the
 * post-visit summary — lives in one place instead of being reimplemented
 * per screen (see issue #4 AC: doctor link, four-state status, and summary
 * all need to work from either list).
 */
export function AppointmentCard({
  appointment,
  doctor,
  onSelectDoctor,
  onEdit,
  onStatusChange,
  onSaveSummary,
}: {
  appointment: Appointment;
  doctor?: Doctor;
  onSelectDoctor: (doctor: Doctor) => void;
  onEdit: (appointment: Appointment) => void;
  onStatusChange: (appointment: Appointment, status: AppointmentStatus) => void;
  onSaveSummary: (appointment: Appointment, summary: string) => void;
}) {
  const { t, i18n } = useTranslation();
  // Local draft so typing doesn't round-trip through the parent on every
  // keystroke — reset per appointment since the card is keyed by id.
  const [summaryDraft, setSummaryDraft] = useState(appointment.summary ?? "");

  return (
    <li className="appointment-row">
      <span className="appointment-date">{formatDateTime(appointment.dateTime, i18n.language)}</span>
      {doctor && (
        <button type="button" className="appointment-doctor-link" onClick={() => onSelectDoctor(doctor)}>
          {doctor.name}
        </button>
      )}
      <span className="appointment-notes">{appointment.notes}</span>
      {appointment.location && <span className="appointment-location">{appointment.location}</span>}
      <div className="appointment-row-actions">
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
