import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { Appointment, Doctor, MedicalDocument, Task, TaskStatus } from "../api";
import { MissedReminderBadge } from "../components/MissedReminderBadge";
import { AddDocument } from "../components/AddDocument";
import { useRelativeDateTime } from "../hooks/useRelativeDateTime";
import { useRelativeDate } from "../hooks/useRelativeDate";
import { TaskIcon } from "../components/TaskIcon";
import { celebrateAfter } from "../celebration/celebrate";

/**
 * Combined readiness for the checklist (issue #9) — the client-side
 * counterpart of the server's computeAppointmentChecklist (see
 * server/src/appointments/appointmentChecklist.ts), so the two can't
 * disagree about what counts as "ready": an attached document always is
 * (having it *is* the ready state), a linked open item only once its own
 * status is "done".
 */
function computeReadiness(documents: MedicalDocument[], openItems: Task[]): { ready: number; total: number } {
  const readyItems = openItems.filter((t) => t.status === "done").length;
  return { ready: documents.length + readyItems, total: documents.length + openItems.length };
}

/** A checklist row clickable by mouse or keyboard — same role="button"/onKeyDown pattern as TaskDetailScreen's own document rows. */
function ClickableRow({ className, onClick, children }: { className: string; onClick: () => void; children: ReactNode }) {
  return (
    <li
      className={className}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {children}
    </li>
  );
}

/**
 * One open item as a checklist row, laid out like HomeScreen's open-item
 * rows: the whole row opens the task, and a round control on the end toggles
 * its done state in place. Checking always sets "done"; unchecking always
 * sets "open" (not whatever status it had before), matching
 * TaskDetailScreen's own reopen action.
 */
function OpenItemRow({
  item,
  onToggle,
  onSelect,
}: {
  item: Task;
  onToggle: (item: Task, status: TaskStatus) => void | Promise<void>;
  onSelect?: (item: Task) => void;
}) {
  const { t } = useTranslation();
  const formatRelativeDay = useRelativeDate();
  const done = item.status === "done";
  const open = () => onSelect?.(item);

  return (
    <li
      className="card feed-row clickable"
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      }}
    >
      <div className="feed-icon" aria-hidden="true">
        <TaskIcon type={item.type} />
      </div>
      <div className="feed-body">
        <div className="feed-top">
          <span className={`feed-name${done ? " done" : ""}`}>{item.title}</span>
          <span className="feed-when">
            {item.dueDate ? formatRelativeDay(item.dueDate) : (item.approximateDateWindow ?? t("task.due.noDate"))}
          </span>
        </div>
      </div>
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        className={`feed-done${done ? " is-done" : ""}`}
        aria-label={item.title}
        onClick={(e) => {
          e.stopPropagation();
          if (done) void onToggle(item, "open");
          else void celebrateAfter(e.currentTarget, e, () => onToggle(item, "done"));
        }}
        onKeyDown={(e) => e.stopPropagation()}
      >
        ✓
      </button>
    </li>
  );
}

export function AppointmentDetailScreen({
  appointment,
  doctor,
  documents = [],
  openItems = [],
  allDocuments = [],
  onEdit,
  onAttachDocument,
  onUploadDocuments,
  onSelectDocument,
  onSelectTask,
  onTaskStatusChange,
  onSelectDoctor,
}: {
  appointment: Appointment;
  doctor?: Doctor;
  documents?: MedicalDocument[];
  openItems?: Task[];
  allDocuments?: MedicalDocument[];
  onEdit: () => void;
  onAttachDocument: (document: MedicalDocument) => void;
  onUploadDocuments: (files: File[]) => void;
  onSelectDocument?: (document: MedicalDocument) => void;
  onSelectTask?: (task: Task) => void;
  /** Checks/unchecks an open item straight from the checklist (see OpenItemRow) without leaving this screen. */
  onTaskStatusChange?: (task: Task, status: TaskStatus) => void | Promise<void>;
  /** Follows the doctor's name into their own detail view — now the only
      place that link lives (appointment list cards deliberately dropped it,
      see AppointmentCard). */
  onSelectDoctor?: (doctor: Doctor) => void;
}) {
  const { t } = useTranslation();
  const formatRelative = useRelativeDateTime();
  const { ready, total } = computeReadiness(documents, openItems);

  // Already-attached documents are dropped from the picker's own candidate
  // pool — re-offering something the checklist already has would just
  // invite a confusing duplicate "attach" of an already-ready item.
  const attachedIds = new Set(documents.map((d) => d.id));

  return (
    <main className="screen appointment-detail-screen">
      {doctor &&
        (onSelectDoctor ? (
          <button type="button" className="appointment-detail-doctor appointment-doctor-link" onClick={() => onSelectDoctor(doctor)}>
            {doctor.name}
          </button>
        ) : (
          <p className="appointment-detail-doctor">{doctor.name}</p>
        ))}
      <p className="appointment-detail-date">{formatRelative(appointment.dateTime)}</p>
      {appointment.location && <p className="appointment-detail-location">{appointment.location}</p>}
      {appointment.missedReminder && <MissedReminderBadge reason={appointment.missedReminder} />}
      <button type="button" className="edit-appointment" onClick={onEdit}>
        {t("doctorDetail.edit")}
      </button>
      {total > 0 && <p className="readiness-indicator">{t("appointmentDetail.readiness", { ready, total })}</p>}

      <section data-testid="appointment-documents-section">
        <h2 className="section-title">{t("doctorDetail.documents.title")}</h2>
        {documents.length > 0 ? (
          <ul className="item-row-list">
            {documents.map((document) => (
              <ClickableRow key={document.id} className="card item-row clickable" onClick={() => onSelectDocument?.(document)}>
                {document.title}
              </ClickableRow>
            ))}
          </ul>
        ) : (
          <p className="section-empty">{t("doctorDetail.documents.empty")}</p>
        )}

        <AddDocument allDocuments={allDocuments} excludedIds={attachedIds} onPick={onAttachDocument} onUpload={onUploadDocuments} />
      </section>

      <section data-testid="appointment-openitems-section">
        <h2 className="section-title">{t("doctorDetail.openItems.title")}</h2>
        {openItems.length > 0 ? (
          <ul className="feed">
            {openItems.map((item) => (
              <OpenItemRow
                key={item.id}
                item={item}
                onToggle={(t, status) => onTaskStatusChange?.(t, status)}
                onSelect={onSelectTask}
              />
            ))}
          </ul>
        ) : (
          <p className="section-empty">{t("doctorDetail.openItems.empty")}</p>
        )}
      </section>
    </main>
  );
}
