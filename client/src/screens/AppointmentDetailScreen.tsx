import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { Appointment, Doctor, MedicalDocument, Task, TaskStatus } from "../api";

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
 * One open item as a checklist row: a real checkbox toggling its done state
 * directly (no need to leave the checklist), plus its title as a separate
 * clickable control into the task's own detail screen — two independent
 * controls side by side rather than one row fighting itself over what a
 * click means. Checking always sets "done"; unchecking always sets "open"
 * (not whatever status it had before), matching TaskDetailScreen's own
 * reopen action.
 */
function OpenItemRow({
  item,
  onToggle,
  onSelect,
}: {
  item: Task;
  onToggle: (item: Task, status: TaskStatus) => void;
  onSelect?: (item: Task) => void;
}) {
  const done = item.status === "done";

  return (
    <li className={`card item-row checklist-item${done ? " done" : ""}`}>
      <input
        type="checkbox"
        className="checklist-checkbox"
        checked={done}
        aria-label={item.title}
        onChange={() => onToggle(item, done ? "open" : "done")}
      />
      <button
        type="button"
        className={`checklist-item-title appointment-open-link${done ? " done" : ""}`}
        onClick={() => onSelect?.(item)}
      >
        {item.title}
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
  onSelectDocument?: (document: MedicalDocument) => void;
  onSelectTask?: (task: Task) => void;
  /** Checks/unchecks an open item straight from the checklist (see OpenItemRow) without leaving this screen. */
  onTaskStatusChange?: (task: Task, status: TaskStatus) => void;
  /** Follows the doctor's name into their own detail view — now the only
      place that link lives (appointment list cards deliberately dropped it,
      see AppointmentCard). */
  onSelectDoctor?: (doctor: Doctor) => void;
}) {
  const { t } = useTranslation();
  const { ready, total } = computeReadiness(documents, openItems);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");

  // Already-attached documents are dropped from the picker's own candidate
  // pool — re-offering something the checklist already has would just
  // invite a confusing duplicate "attach" of an already-ready item.
  const attachedIds = new Set(documents.map((d) => d.id));
  const pickerResults = allDocuments
    .filter((d) => !attachedIds.has(d.id))
    .filter((d) => d.title.toLowerCase().includes(pickerQuery.trim().toLowerCase()));

  const attach = (document: MedicalDocument) => {
    onAttachDocument(document);
    setPickerOpen(false);
    setPickerQuery("");
  };

  return (
    <main className="screen appointment-detail-screen">
      <h1>{appointment.notes}</h1>
      {doctor &&
        (onSelectDoctor ? (
          <button type="button" className="appointment-detail-doctor appointment-doctor-link" onClick={() => onSelectDoctor(doctor)}>
            {doctor.name}
          </button>
        ) : (
          <p className="appointment-detail-doctor">{doctor.name}</p>
        ))}
      {appointment.location && <p className="appointment-detail-location">{appointment.location}</p>}
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

        <button type="button" className="btn-small btn-secondary" onClick={() => setPickerOpen((open) => !open)}>
          {t("appointmentDetail.attachDocument.toggle")}
        </button>

        {pickerOpen && (
          <div className="card document-picker">
            <label>
              {t("appointmentDetail.attachDocument.search.label")}
              <input type="text" value={pickerQuery} onChange={(e) => setPickerQuery(e.target.value)} />
            </label>
            {pickerResults.length > 0 ? (
              <ul className="item-row-list">
                {pickerResults.map((document) => (
                  <ClickableRow key={document.id} className="card item-row clickable picker-result" onClick={() => attach(document)}>
                    {document.title}
                  </ClickableRow>
                ))}
              </ul>
            ) : (
              <p className="section-empty">{t("appointmentDetail.attachDocument.empty")}</p>
            )}
          </div>
        )}
      </section>

      <section data-testid="appointment-openitems-section">
        <h2 className="section-title">{t("doctorDetail.openItems.title")}</h2>
        {openItems.length > 0 ? (
          <ul className="item-row-list checklist">
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
