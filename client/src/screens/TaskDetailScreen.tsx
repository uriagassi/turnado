import { useTranslation } from "react-i18next";
import type { Appointment, Doctor, MedicalDocument, Task, TaskStatus } from "../api";
import { useRelativeDateTime } from "../hooks/useRelativeDateTime";
import { getTaskIcon, isResolvableTask } from "../tasks/taskUtils";
import { getDocumentIcon } from "./HomeScreen";
import { TaskStatusBadge } from "../components/TaskStatusBadge";
import { MissedReminderBadge } from "../components/MissedReminderBadge";

export function TaskDetailScreen({
  task,
  doctors,
  appointments = [],
  documents = [],
  onEdit,
  onStatusChange,
  onResolveToAppointment,
  onAddDocument,
  onSelectDocument,
}: {
  task: Task;
  doctors: Doctor[];
  appointments?: Appointment[];
  documents?: MedicalDocument[];
  onEdit: (task: Task) => void;
  onStatusChange: (task: Task, status: TaskStatus) => void;
  onResolveToAppointment?: (task: Task) => void;
  onAddDocument?: (task: Task) => void;
  onSelectDocument?: (doc: MedicalDocument) => void;
}) {
  const { t } = useTranslation();
  const formatRelative = useRelativeDateTime();

  const doctor = task.doctorId ? doctors.find((d) => d.id === task.doctorId) : undefined;
  const pendingAppointment = task.pendingAppointmentId
    ? appointments.find((a) => a.id === task.pendingAppointmentId)
    : undefined;
  const isResolvable = isResolvableTask(task);

  return (
    <main className="screen task-detail-screen">
      <div className="task-detail-header card">
        <div className="task-detail-top">
          <div className="feed-icon" aria-hidden="true">
            {getTaskIcon(task.type)}
          </div>
          <div className="task-detail-title-area">
            <span className="task-type-label">{t(`task.type.${task.type}`)}</span>
            <h1>{task.title}</h1>
          </div>
        </div>
        <div className="task-detail-meta">
          <TaskStatusBadge status={task.status} />
          {task.requiresAdvanceScheduling && (
            <span className="badge type-tag">{t("taskDetail.advanceSchedulingNotice")}</span>
          )}
          {task.missedReminder && <MissedReminderBadge reason={task.missedReminder} />}
        </div>
      </div>

      <div className="task-detail-body">
        {doctor && (
          <div className="card task-detail-section">
            <h2 className="section-title">{t("taskDetail.doctor")}</h2>
            <p className="task-detail-value">
              {doctor.name} {doctor.specialty ? `(${doctor.specialty})` : ""}
            </p>
          </div>
        )}

        {(task.dueDate || task.approximateDateWindow || task.recurrenceWindow) && (
          <div className="card task-detail-section">
            <h2 className="section-title">{t("taskDetail.timing")}</h2>
            {task.dueDate && (
              <p className="task-detail-row">
                <span className="label-dim">{t("taskDetail.dueDate")}:</span>{" "}
                {formatRelative(task.dueDate)} ({task.dueDate})
              </p>
            )}
            {task.approximateDateWindow && (
              <p className="task-detail-row">
                <span className="label-dim">{t("taskForm.approximateDateWindow.label")}:</span>{" "}
                {task.approximateDateWindow}
              </p>
            )}
            {task.recurrenceWindow && (
              <p className="task-detail-row">
                <span className="label-dim">{t("taskForm.recurrenceWindow.label")}:</span>{" "}
                {task.recurrenceWindow}
              </p>
            )}
          </div>
        )}

        {task.type === "form_17" && (
          <div className="card task-detail-section">
            <h2 className="section-title">{t("task.type.form_17")}</h2>
            {task.institution && (
              <p className="task-detail-row">
                <span className="label-dim">{t("taskDetail.institution")}:</span> {task.institution}
              </p>
            )}
            {task.department && (
              <p className="task-detail-row">
                <span className="label-dim">{t("taskDetail.department")}:</span> {task.department}
              </p>
            )}
            {task.healthFund && (
              <p className="task-detail-row">
                <span className="label-dim">{t("taskDetail.healthFund")}:</span> {task.healthFund}
              </p>
            )}
            {(task.codeNumber || task.codeName) && (
              <p className="task-detail-row">
                <span className="label-dim">{t("taskDetail.code")}:</span>{" "}
                {[task.codeNumber, task.codeName].filter(Boolean).join(" — ")}
              </p>
            )}
          </div>
        )}

        {pendingAppointment && (
          <div className="card task-detail-section task-linked-appointment">
            <h2 className="section-title">{t("taskDetail.scheduledAppointment.title")}</h2>
            <p className="task-detail-value">{pendingAppointment.notes || t("appointmentCard.title")}</p>
            <p className="task-detail-row">
              <span className="label-dim">{t("taskDetail.dueDate")}:</span>{" "}
              {formatRelative(pendingAppointment.dateTime)} ({new Date(pendingAppointment.dateTime).toLocaleDateString()})
            </p>
            {pendingAppointment.location && (
              <p className="task-detail-row">
                <span className="label-dim">{t("appointmentForm.location.label")}:</span>{" "}
                {pendingAppointment.location}
              </p>
            )}
          </div>
        )}

        {task.type === "general_approval" && (
          <div className="card task-detail-section">
            <h2 className="section-title">{t("task.type.general_approval")}</h2>
            {task.issuingBody && (
              <p className="task-detail-row">
                <span className="label-dim">{t("taskDetail.issuingBody")}:</span> {task.issuingBody}
              </p>
            )}
            {task.purpose && (
              <p className="task-detail-row">
                <span className="label-dim">{t("taskDetail.purpose")}:</span> {task.purpose}
              </p>
            )}
          </div>
        )}

        {documents.length > 0 && (
          <div className="card task-detail-section">
            <h2 className="section-title">{t("doctorDetail.documents.title")}</h2>
            <div className="task-documents-list">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="card feed-row clickable"
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
                  <div className="feed-icon" aria-hidden="true">
                    {getDocumentIcon(doc.type)}
                  </div>
                  <div className="feed-body">
                    <div className="feed-top">
                      <span className="feed-name">{doc.title}</span>
                      {doc.documentDate && <span className="feed-when">{doc.documentDate}</span>}
                    </div>
                    <div className="feed-meta">
                      <span className="badge type-tag">{t(`document.type.${doc.type}`)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="task-detail-actions">
        {task.status !== "done" ? (
          <button
            type="button"
            className="btn-primary"
            onClick={() => onStatusChange(task, "done")}
          >
            ✓ {t("taskDetail.markDone")}
          </button>
        ) : (
          <button
            type="button"
            className="btn-secondary"
            onClick={() => onStatusChange(task, "open")}
          >
            ↺ {t("taskDetail.reopen")}
          </button>
        )}

        {isResolvable && onResolveToAppointment && (
          <button
            type="button"
            className="btn-secondary"
            onClick={() => onResolveToAppointment(task)}
          >
            📅 {t("taskForm.resolveToAppointment")}
          </button>
        )}

        {onAddDocument && (
          <button
            type="button"
            className="btn-secondary"
            onClick={() => onAddDocument(task)}
          >
            📎 {t("taskDetail.addDocument")}
          </button>
        )}

        <button
          type="button"
          className="btn-secondary"
          onClick={() => onEdit(task)}
        >
          ✎ {t("taskDetail.edit")}
        </button>
      </div>
    </main>
  );
}
