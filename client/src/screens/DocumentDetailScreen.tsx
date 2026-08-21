import { useTranslation } from "react-i18next";
import type { Appointment, Doctor, MedicalDocument, Task } from "../api";
import { DocumentPreview } from "../components/DocumentPreview";

interface DocumentDetailScreenProps {
  document: MedicalDocument;
  doctors: Doctor[];
  appointments?: Appointment[];
  openItems?: Task[];
  onSelectDoctor?: (doctor: Doctor) => void;
  onSelectAppointment?: (appointment: Appointment) => void;
  onSelectTask?: (task: Task) => void;
}

export function DocumentDetailScreen({
  document,
  doctors,
  appointments = [],
  openItems = [],
  onSelectDoctor,
  onSelectAppointment,
  onSelectTask,
}: DocumentDetailScreenProps) {
  const { t } = useTranslation();

  const doctor = document.doctorId
    ? doctors.find((d) => d.id === document.doctorId)
    : undefined;

  const linkedAppointments = appointments.filter((a) =>
    document.appointmentIds.includes(a.id),
  );

  const linkedTasks = openItems.filter((task) =>
    document.taskIds.includes(task.id),
  );

  return (
    <main className="screen document-detail-screen">
      <div className="detail-head">
        <div className="detail-titles">
          <h1>{document.title}</h1>
          <span className="badge type-tag">{t(`document.type.${document.type}`)}</span>
        </div>
      </div>

      <div className="card document-meta-card">
        {document.documentDate && (
          <div className="meta-row">
            <span className="meta-label">{t("documentForm.date.label")}:</span>
            <span>{document.documentDate}</span>
          </div>
        )}

        {doctor && (
          <div className="meta-row">
            <span className="meta-label">{t("documentForm.doctor.label")}:</span>
            {onSelectDoctor ? (
              <button
                type="button"
                className="link-button"
                onClick={() => onSelectDoctor(doctor)}
              >
                {doctor.name}
              </button>
            ) : (
              <span>{doctor.name}</span>
            )}
          </div>
        )}

        {document.notes && (
          <div className="meta-row">
            <p className="document-notes">{document.notes}</p>
          </div>
        )}
      </div>

      {linkedAppointments.length > 0 && (
        <section>
          <h2 className="section-title">{t("documentForm.appointments.label")}</h2>
          <div className="item-row-list">
            {linkedAppointments.map((appt) => (
              <div
                key={appt.id}
                className="card item-row clickable"
                role="button"
                tabIndex={0}
                onClick={() => onSelectAppointment?.(appt)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectAppointment?.(appt);
                  }
                }}
              >
                <div>
                  <p className="item-row-notes">{appt.notes}</p>
                  <p className="item-row-sub">{appt.dateTime.slice(0, 10)}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {linkedTasks.length > 0 && (
        <section>
          <h2 className="section-title">{t("doctorDetail.openItems.title")}</h2>
          <div className="item-row-list">
            {linkedTasks.map((task) => (
              <div
                key={task.id}
                className="card item-row clickable"
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
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="preview-section">
        <DocumentPreview file={document.file} />
      </section>
    </main>
  );
}
