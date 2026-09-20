import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Doctor, DocumentType, MedicalDocument, Task, TaskInput, TaskStatus, TaskType } from "../api";
import { isResolvableTask } from "../tasks/taskUtils";
import { getDocumentIcon } from "./HomeScreen";
import { getDocumentTypeForTask } from "./DocumentFormScreen";
import { useRelativeDateTime } from "../hooks/useRelativeDateTime";

type RequiredFieldErrors = { title?: string; doctorId?: string };

/** One new file the user selected inline, not yet uploaded — title/type are auto-filled (see getDocumentTypeForTask) and not editable here; fix them from the document's own detail screen afterwards if needed. */
export interface TaskDocumentUpload {
  file: File;
  title: string;
  type: DocumentType;
}

/** The diff between what was attached when the form opened and what's staged now — computed on submit and applied by the caller (create/update the task first, then apply these) since a brand-new task has no id yet while the form is open. */
export interface TaskDocumentChanges {
  attachDocumentIds: number[];
  detachDocumentIds: number[];
  uploads: TaskDocumentUpload[];
}

type StagedDoc =
  | { kind: "existing"; document: MedicalDocument }
  | ({ kind: "upload"; uploadId: number } & TaskDocumentUpload);

export function TaskFormScreen({
  task,
  doctors,
  documents = [],
  allDocuments = [],
  focusDocuments = false,
  onSubmit,
  onCancel,
  onResolveToAppointment,
}: {
  task?: Task;
  doctors: Doctor[];
  /** Documents already attached to `task` when the form opened (empty for a brand-new task). */
  documents?: MedicalDocument[];
  /** Every document in the system, for the "attach existing" picker to search across. */
  allDocuments?: MedicalDocument[];
  /** Scrolls the documents section into view on mount — used when arriving here via the detail screen's document-edit shortcut. */
  focusDocuments?: boolean;
  onSubmit: (input: TaskInput, documentChanges: TaskDocumentChanges) => void;
  onCancel: () => void;
  onResolveToAppointment?: (task: Task) => void;
}) {
  const { t } = useTranslation();
  const formatRelative = useRelativeDateTime();
  const [formData, setFormData] = useState<TaskInput>({
    type: task?.type ?? "test",
    title: task?.title ?? "",
    status: task?.status ?? "open",
    doctorId: task?.doctorId ?? null,
    dueDate: task?.dueDate ?? "",
    sourceAppointmentId: task?.sourceAppointmentId ?? null,
    pendingAppointmentId: task?.pendingAppointmentId ?? null,
    requiresAdvanceScheduling: task?.requiresAdvanceScheduling ?? false,
    recurrenceWindow: task?.recurrenceWindow ?? "",
    approximateDateWindow: task?.approximateDateWindow ?? "",
    institution: task?.institution ?? "",
    department: task?.department ?? "",
    healthFund: task?.healthFund ?? "",
    codeNumber: task?.codeNumber ?? "",
    codeName: task?.codeName ?? "",
    issuingBody: task?.issuingBody ?? "",
    purpose: task?.purpose ?? "",
  });
  const [errors, setErrors] = useState<RequiredFieldErrors>({});

  const setField = <K extends keyof TaskInput>(field: K, value: TaskInput[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field as keyof RequiredFieldErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  // Document attach/detach/upload is staged here and only applied by the
  // caller once the task itself has been saved (see TaskDocumentChanges) —
  // Cancel simply drops this state, same as it drops any other field edit.
  const [stagedDocs, setStagedDocs] = useState<StagedDoc[]>(
    documents.map((document) => ({ kind: "existing", document })),
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");
  const uploadIdCounter = useRef(0);
  const documentsSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (focusDocuments) {
      documentsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    // Only ever on mount — this is a one-time "arrived here for the documents section" nudge.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stagedExistingIds = new Set(
    stagedDocs.filter((d): d is Extract<StagedDoc, { kind: "existing" }> => d.kind === "existing").map((d) => d.document.id),
  );
  const pickerResults = allDocuments
    .filter((d) => !stagedExistingIds.has(d.id))
    .filter((d) => d.title.toLowerCase().includes(pickerQuery.trim().toLowerCase()));

  const attachExisting = (document: MedicalDocument) => {
    setStagedDocs((docs) => [...docs, { kind: "existing", document }]);
  };

  const removeExisting = (documentId: number) => {
    setStagedDocs((docs) => docs.filter((d) => !(d.kind === "existing" && d.document.id === documentId)));
  };

  const removeUpload = (uploadId: number) => {
    setStagedDocs((docs) => docs.filter((d) => !(d.kind === "upload" && d.uploadId === uploadId)));
  };

  const onFilesSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    const uploads: StagedDoc[] = files.map((file) => ({
      kind: "upload",
      uploadId: ++uploadIdCounter.current,
      file,
      title: file.name.replace(/\.[^/.]+$/, ""),
      type: getDocumentTypeForTask(formData.type),
    }));
    setStagedDocs((docs) => [...docs, ...uploads]);
    event.target.value = "";
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const nextErrors: RequiredFieldErrors = {};
    if (!formData.title.trim()) nextErrors.title = t("taskForm.name.required");
    if (formData.type === "doctor_visit" && !formData.doctorId) {
      nextErrors.doctorId = t("taskForm.doctor.required");
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const originalAttachedIds = new Set(documents.map((d) => d.id));
    const attachDocumentIds = [...stagedExistingIds].filter((id) => !originalAttachedIds.has(id));
    const detachDocumentIds = documents.map((d) => d.id).filter((id) => !stagedExistingIds.has(id));
    const uploads: TaskDocumentUpload[] = stagedDocs
      .filter((d): d is Extract<StagedDoc, { kind: "upload" }> => d.kind === "upload")
      .map(({ file, title, type }) => ({ file, title, type }));

    onSubmit(
      {
        ...formData,
        title: formData.title.trim(),
        dueDate: formData.dueDate ? formData.dueDate : null,
        recurrenceWindow: formData.recurrenceWindow ? formData.recurrenceWindow : null,
        approximateDateWindow: formData.approximateDateWindow ? formData.approximateDateWindow : null,
        institution: formData.institution ? formData.institution : null,
        department: formData.department ? formData.department : null,
        healthFund: formData.healthFund ? formData.healthFund : null,
        codeNumber: formData.codeNumber ? formData.codeNumber : null,
        codeName: formData.codeName ? formData.codeName : null,
        issuingBody: formData.issuingBody ? formData.issuingBody : null,
        purpose: formData.purpose ? formData.purpose : null,
      },
      { attachDocumentIds, detachDocumentIds, uploads },
    );
  };

  const isResolvable = Boolean(task) && isResolvableTask(formData);

  return (
    <main className="screen task-form-screen">
      <h1>{task ? t("taskForm.title.edit") : t("taskForm.title.new")}</h1>
      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <label>
            {t("taskForm.type.label")}
            <select
              value={formData.type}
              onChange={(e) => setField("type", e.target.value as TaskType)}
            >
              <option value="test">{t("task.type.test")}</option>
              <option value="doctor_visit">{t("task.type.doctor_visit")}</option>
              <option value="form_17">{t("task.type.form_17")}</option>
              <option value="general_approval">{t("task.type.general_approval")}</option>
            </select>
          </label>
        </div>

        <div className="form-field">
          <label>
            {t("taskForm.name.label")}
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setField("title", e.target.value)}
            />
          </label>
          {errors.title && <p className="field-error">{errors.title}</p>}
        </div>

        <div className="form-field">
          <label>
            {t("taskForm.status.label")}
            <select
              value={formData.status}
              onChange={(e) => setField("status", e.target.value as TaskStatus)}
            >
              <option value="open">{t("task.status.open")}</option>
              <option value="in-progress">{t("task.status.inprogress")}</option>
              <option value="done">{t("task.status.done")}</option>
            </select>
          </label>
        </div>

        <div className="form-field">
          <label>
            {t("taskForm.doctor.label")}
            <select
              value={formData.doctorId ?? ""}
              onChange={(e) => setField("doctorId", e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">{t("taskForm.doctor.none")}</option>
              {doctors.map((doctor) => (
                <option key={doctor.id} value={doctor.id}>
                  {doctor.name} {doctor.specialty ? `(${doctor.specialty})` : ""}
                </option>
              ))}
            </select>
          </label>
          {errors.doctorId && <p className="field-error">{errors.doctorId}</p>}
        </div>

        <div className="form-field">
          <label>
            {t("taskForm.dueDate.label")}
            <input
              type="date"
              value={formData.dueDate ?? ""}
              onChange={(e) => setField("dueDate", e.target.value)}
            />
          </label>
        </div>

        {/* Kind-specific fields */}
        {formData.type === "test" && (
          <>
            <div className="form-field form-field-checkbox">
              <label>
                <input
                  type="checkbox"
                  checked={Boolean(formData.requiresAdvanceScheduling)}
                  onChange={(e) => setField("requiresAdvanceScheduling", e.target.checked)}
                />
                {t("taskForm.requiresAdvanceScheduling.label")}
              </label>
            </div>
            <div className="form-field">
              <label>
                {t("taskForm.recurrenceWindow.label")}
                <input
                  type="text"
                  value={formData.recurrenceWindow ?? ""}
                  onChange={(e) => setField("recurrenceWindow", e.target.value)}
                />
              </label>
            </div>
            <div className="form-field">
              <label>
                {t("taskForm.approximateDateWindow.label")}
                <input
                  type="text"
                  value={formData.approximateDateWindow ?? ""}
                  onChange={(e) => setField("approximateDateWindow", e.target.value)}
                />
              </label>
            </div>
          </>
        )}

        {formData.type === "form_17" && (
          <>
            <div className="form-field">
              <label>
                {t("taskForm.institution.label")}
                <input
                  type="text"
                  value={formData.institution ?? ""}
                  onChange={(e) => setField("institution", e.target.value)}
                />
              </label>
            </div>
            <div className="form-field">
              <label>
                {t("taskForm.department.label")}
                <input
                  type="text"
                  value={formData.department ?? ""}
                  onChange={(e) => setField("department", e.target.value)}
                />
              </label>
            </div>
            <div className="form-field">
              <label>
                {t("taskForm.healthFund.label")}
                <input
                  type="text"
                  value={formData.healthFund ?? ""}
                  onChange={(e) => setField("healthFund", e.target.value)}
                />
              </label>
            </div>
            <div className="form-field">
              <label>
                {t("taskForm.codeNumber.label")}
                <input
                  type="text"
                  value={formData.codeNumber ?? ""}
                  onChange={(e) => setField("codeNumber", e.target.value)}
                />
              </label>
            </div>
            <div className="form-field">
              <label>
                {t("taskForm.codeName.label")}
                <input
                  type="text"
                  value={formData.codeName ?? ""}
                  onChange={(e) => setField("codeName", e.target.value)}
                />
              </label>
            </div>
          </>
        )}

        {formData.type === "general_approval" && (
          <>
            <div className="form-field">
              <label>
                {t("taskForm.issuingBody.label")}
                <input
                  type="text"
                  value={formData.issuingBody ?? ""}
                  onChange={(e) => setField("issuingBody", e.target.value)}
                />
              </label>
            </div>
            <div className="form-field">
              <label>
                {t("taskForm.purpose.label")}
                <input
                  type="text"
                  value={formData.purpose ?? ""}
                  onChange={(e) => setField("purpose", e.target.value)}
                />
              </label>
            </div>
          </>
        )}

        <div className="card task-form-section task-form-documents" ref={documentsSectionRef}>
          <h2 className="section-title">{t("doctorDetail.documents.title")}</h2>

          {stagedDocs.length > 0 && (
            <ul className="item-row-list">
              {stagedDocs.map((doc) => {
                const key = doc.kind === "existing" ? `existing-${doc.document.id}` : `upload-${doc.uploadId}`;
                const title = doc.kind === "existing" ? doc.document.title : doc.title;
                const type = doc.kind === "existing" ? doc.document.type : doc.type;
                return (
                  <li key={key} className="card feed-row task-form-document-row">
                    <div className="feed-icon" aria-hidden="true">
                      {getDocumentIcon(type)}
                    </div>
                    <div className="feed-body">
                      <span className="feed-name">{title}</span>
                      <div className="feed-meta">
                        <span className="badge type-tag">{t(`document.type.${type}`)}</span>
                        {doc.kind === "upload" && (
                          <span className="badge">{t("taskForm.documents.pendingUpload")}</span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn-icon-remove"
                      aria-label={t("taskForm.documents.remove", { title })}
                      onClick={() =>
                        doc.kind === "existing" ? removeExisting(doc.document.id) : removeUpload(doc.uploadId)
                      }
                    >
                      ×
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="task-form-documents-actions">
            <button type="button" className="btn-small btn-secondary" onClick={() => setPickerOpen((open) => !open)}>
              {t("appointmentDetail.attachDocument.toggle")}
            </button>
            <label className="btn-small btn-secondary task-form-upload-label">
              {t("taskForm.documents.upload")}
              <input
                type="file"
                multiple
                accept="image/*,application/pdf"
                className="visually-hidden"
                onChange={onFilesSelected}
              />
            </label>
          </div>

          {pickerOpen && (
            <div className="card document-picker">
              <label>
                {t("appointmentDetail.attachDocument.search.label")}
                <input type="text" value={pickerQuery} onChange={(e) => setPickerQuery(e.target.value)} />
              </label>
              {pickerResults.length > 0 ? (
                <ul className="item-row-list">
                  {pickerResults.map((document) => (
                    <li
                      key={document.id}
                      className="card item-row clickable picker-result"
                      role="button"
                      tabIndex={0}
                      onClick={() => attachExisting(document)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          attachExisting(document);
                        }
                      }}
                    >
                      <div>
                        <p className="item-row-notes">{document.title}</p>
                        <p className="item-row-sub">{formatRelative(document.createdAt)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="section-empty">{t("appointmentDetail.attachDocument.empty")}</p>
              )}
            </div>
          )}
        </div>

        {isResolvable && onResolveToAppointment && task && (
          <div className="form-resolve-action">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => onResolveToAppointment(task)}
            >
              📅 {t("taskForm.resolveToAppointment")}
            </button>
          </div>
        )}

        <div className="form-actions">
          <button type="submit" className="save-task">
            {t("taskForm.save")}
          </button>
          <button type="button" className="cancel-task" onClick={onCancel}>
            {t("taskForm.cancel")}
          </button>
        </div>
      </form>
    </main>
  );
}
