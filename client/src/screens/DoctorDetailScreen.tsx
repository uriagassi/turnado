import { useTranslation } from "react-i18next";
import type { Appointment, Doctor, Task } from "../api";
import { DoctorAvatar } from "../components/DoctorAvatar";
import { useRelativeDateTime } from "../hooks/useRelativeDateTime";

export function DoctorDetailScreen({
  doctor,
  appointments = [],
  openItems = [],
  onBack,
  onEdit,
  onSelectTask,
}: {
  doctor: Doctor;
  /**
   * This doctor's still-upcoming planned appointments, soonest first —
   * populated by App.tsx via upcomingAppointmentsForDoctor (the client-side
   * counterpart of the server's selectUpcomingAppointments). Matches the
   * accepted prototype 06-doctor-view.html's plural "תורים" heading, which
   * lists every upcoming appointment rather than just the soonest one.
   */
  appointments?: Appointment[];
  openItems?: Task[];
  onBack: () => void;
  onEdit: () => void;
  onSelectTask?: (task: Task) => void;
}) {
  const { t } = useTranslation();
  const formatRelative = useRelativeDateTime();

  return (
    <main className="screen doctor-detail-screen">
      {/* Labeled, full-width back-link at the TOP of the page rather than a
          footer button — matches the winning doctor-view prototype
          (06-doctor-view.html), whose round-2 feedback specifically flagged
          "from the detail view, not obvious how to get back to the list". */}
      <button type="button" className="back-link" onClick={onBack}>
        <span className="back-link-arrow" aria-hidden="true">
          ←
        </span>
        {t("doctorDetail.back")}
      </button>
      {/* Compact avatar + name/specialty header, matching the prototype's
          `.detail-head` — a small round avatar next to the identity, not a
          large portrait spanning the row. Contact fields (clinic/phone/
          address/email) have no prototype equivalent (its mock data doesn't
          model them), so they get their own themed card below instead of
          crowding the header. */}
      <div className="detail-head">
        <DoctorAvatar doctor={doctor} />
        <div className="detail-titles">
          <h1>{doctor.name}</h1>
          {doctor.specialty && <p className="detail-specialty">{doctor.specialty}</p>}
        </div>
      </div>
      {(doctor.clinic || doctor.phone || doctor.address || doctor.email) && (
        <div className="card doctor-contact">
          {doctor.clinic && <p>{doctor.clinic}</p>}
          {doctor.phone && <p>{doctor.phone}</p>}
          {doctor.address && <p>{doctor.address}</p>}
          {doctor.email && <p>{doctor.email}</p>}
        </div>
      )}
      <button type="button" className="edit-doctor" onClick={onEdit}>
        {t("doctorDetail.edit")}
      </button>
      {doctor.notes && <p className="doctor-notes">{doctor.notes}</p>}

      <section>
        <h2 className="section-title">{t("doctorDetail.appointment.title")}</h2>
        {appointments.length > 0 ? (
          // Card + status badge per appointment, matching the prototype's
          // `.item-row` — same treatment as the tasks/documents rows in its
          // detail view (06-doctor-view.html), one row per upcoming
          // appointment rather than just the soonest.
          <div className="item-row-list">
            {appointments.map((appointment) => (
              <div className="card item-row" key={appointment.id}>
                <div>
                  <p className="item-row-notes">{appointment.notes}</p>
                  <p className="item-row-sub">{formatRelative(appointment.dateTime)}</p>
                </div>
                <span className={`badge badge-${appointment.status}`}>
                  {t(`appointmentCard.status.${appointment.status}`)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="section-empty">{t("doctorDetail.appointment.empty")}</p>
        )}
      </section>

      <section>
        <h2 className="section-title">{t("doctorDetail.openItems.title")}</h2>
        {openItems.length > 0 ? (
          <div className="item-row-list">
            {openItems.map((task) => (
              <div
                className="card item-row clickable"
                key={task.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelectTask?.(task)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectTask?.(task);
                  }
                }}
              >
                <div>
                  <p className="item-row-notes">{task.title}</p>
                  <p className="item-row-sub">
                    {task.dueDate ? formatRelative(task.dueDate) : (task.approximateDateWindow ?? t("task.due.noDate"))}
                  </p>
                </div>
                <span className={`badge status-${task.status === "in-progress" ? "inprogress" : task.status}`}>
                  {task.status === "in-progress"
                    ? t("task.status.inprogress")
                    : task.status === "done"
                    ? t("task.status.done")
                    : t("task.status.open")}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="section-empty">{t("doctorDetail.openItems.empty")}</p>
        )}
      </section>

      <section>
        <h2 className="section-title">{t("doctorDetail.documents.title")}</h2>
        <p className="section-empty">{t("doctorDetail.documents.empty")}</p>
      </section>
    </main>
  );
}
