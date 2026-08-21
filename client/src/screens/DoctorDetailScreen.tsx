import { useTranslation } from "react-i18next";
import type { Appointment, Doctor, MedicalDocument, Task } from "../api";
import { DoctorAvatar } from "../components/DoctorAvatar";
import { useRelativeDateTime } from "../hooks/useRelativeDateTime";
import { TaskStatusBadge } from "../components/TaskStatusBadge";

export function DoctorDetailScreen({
  doctor,
  appointments = [],
  openItems = [],
  documents = [],
  onEdit,
  onSelectTask,
  onSelectDocument,
}: {
  doctor: Doctor;
  appointments?: Appointment[];
  openItems?: Task[];
  documents?: MedicalDocument[];
  onEdit: () => void;
  onSelectTask?: (task: Task) => void;
  onSelectDocument?: (doc: MedicalDocument) => void;
}) {
  const { t } = useTranslation();
  const formatRelative = useRelativeDateTime();

  return (
    <main className="screen doctor-detail-screen">
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
                <TaskStatusBadge status={task.status} />
              </div>
            ))}
          </div>
        ) : (
          <p className="section-empty">{t("doctorDetail.openItems.empty")}</p>
        )}
      </section>

      <section>
        <h2 className="section-title">{t("doctorDetail.documents.title")}</h2>
        {documents.length > 0 ? (
          <div className="item-row-list">
            {documents.map((doc) => (
              <div
                className="card item-row clickable"
                key={doc.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelectDocument?.(doc)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectDocument?.(doc);
                  }
                }}
              >
                <div>
                  <p className="item-row-notes">{doc.title}</p>
                  <p className="item-row-sub">
                    {doc.documentDate ?? doc.createdAt.slice(0, 10)}
                  </p>
                </div>
                <span className="badge type-tag">{t(`document.type.${doc.type}`)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="section-empty">{t("doctorDetail.documents.empty")}</p>
        )}
      </section>
    </main>
  );
}
