import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Appointment, Doctor, DocumentType, Task, TaskType } from "../api";

export const DOCUMENT_TYPES: DocumentType[] = [
  "test result",
  "letter",
  "referral",
  "appointment invitation",
  "Form 17",
  "approval",
  "other",
];

export function getDocumentTypeForTask(taskType?: TaskType): DocumentType {
  switch (taskType) {
    case "form_17":
      return "Form 17";
    case "general_approval":
      return "approval";
    case "test":
      return "test result";
    case "doctor_visit":
      return "referral";
    default:
      return "other";
  }
}

interface DocumentFormScreenProps {
  doctors: Doctor[];
  appointments?: Appointment[];
  openItems?: Task[];
  initialDoctorId?: number;
  initialAppointmentId?: number;
  initialTaskId?: number;
  initialType?: DocumentType;
  onSubmit: (formData: FormData) => Promise<void> | void;
  onCancel: () => void;
}

export function DocumentFormScreen({
  doctors,
  appointments = [],
  openItems = [],
  initialDoctorId,
  initialAppointmentId,
  initialTaskId,
  initialType,
  onSubmit,
  onCancel,
}: DocumentFormScreenProps) {
  const { t } = useTranslation();

  const defaultType: DocumentType = initialType
    ? initialType
    : initialTaskId
    ? getDocumentTypeForTask(openItems.find((t) => t.id === initialTaskId)?.type)
    : "other";

  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<DocumentType>(defaultType);
  const [documentDate, setDocumentDate] = useState("");
  const [doctorId, setDoctorId] = useState<string>(initialDoctorId ? String(initialDoctorId) : "");
  const [appointmentId, setAppointmentId] = useState<string>(
    initialAppointmentId ? String(initialAppointmentId) : "",
  );
  const [taskId, setTaskId] = useState<string>(
    initialTaskId ? String(initialTaskId) : "",
  );
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<{ file?: string; title?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nextErrors: { file?: string; title?: string } = {};

    if (!file) {
      nextErrors.file = t("documentForm.file.required");
    }
    if (!title.trim()) {
      nextErrors.title = t("documentForm.title.required");
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    const formData = new FormData();
    if (file) formData.append("file", file);
    formData.append("title", title.trim());
    formData.append("type", type);
    if (documentDate.trim()) formData.append("documentDate", documentDate.trim());
    if (doctorId) formData.append("doctorId", doctorId);
    if (notes.trim()) formData.append("notes", notes.trim());
    if (appointmentId) {
      formData.append("appointmentIds", JSON.stringify([Number(appointmentId)]));
    }
    if (taskId) {
      formData.append("taskIds", JSON.stringify([Number(taskId)]));
    }

    try {
      await onSubmit(formData);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="screen document-form-screen">
      <h1>{t("documentForm.title")}</h1>
      <form onSubmit={handleSubmit} noValidate>
        <div className="form-field">
          <label>
            {t("documentForm.file.label")}
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => {
                const selected = e.target.files?.[0] ?? null;
                setFile(selected);
                if (selected && !title) {
                  const nameWithoutExt = selected.name.replace(/\.[^/.]+$/, "");
                  setTitle(nameWithoutExt);
                }
              }}
            />
          </label>
          {errors.file && <p className="field-error">{errors.file}</p>}
        </div>

        <div className="form-field">
          <label>
            {t("documentForm.title.label")}
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          {errors.title && <p className="field-error">{errors.title}</p>}
        </div>

        <div className="form-field">
          <label>
            {t("documentForm.type.label")}
            <select value={type} onChange={(e) => setType(e.target.value as DocumentType)}>
              {DOCUMENT_TYPES.map((dt) => (
                <option key={dt} value={dt}>
                  {t(`document.type.${dt}`)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="form-field">
          <label>
            {t("documentForm.date.label")}
            <input
              type="date"
              value={documentDate}
              onChange={(e) => setDocumentDate(e.target.value)}
            />
          </label>
        </div>

        <div className="form-field">
          <label>
            {t("documentForm.doctor.label")}
            <select value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
              <option value="">{t("appointmentForm.doctor.none")}</option>
              {doctors.map((d) => (
                <option key={d.id} value={String(d.id)}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {appointments.length > 0 && (
          <div className="form-field">
            <label>
              {t("documentForm.appointments.label")}
              <select value={appointmentId} onChange={(e) => setAppointmentId(e.target.value)}>
                <option value="">{t("documentForm.link.none")}</option>
                {appointments.map((a) => (
                  <option key={a.id} value={String(a.id)}>
                    {a.notes} ({a.dateTime.slice(0, 10)})
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        {openItems.length > 0 && (
          <div className="form-field">
            <label>
              {t("documentForm.tasks.label")}
              <select
                value={taskId}
                onChange={(e) => {
                  const nextTaskId = e.target.value;
                  setTaskId(nextTaskId);
                  if (nextTaskId) {
                    const selectedTask = openItems.find((t) => t.id === Number(nextTaskId));
                    if (selectedTask) {
                      setType(getDocumentTypeForTask(selectedTask.type));
                    }
                  }
                }}
              >
                <option value="">{t("documentForm.link.none")}</option>
                {openItems.map((item) => (
                  <option key={item.id} value={String(item.id)}>
                    {item.title}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        <div className="form-field">
          <label>
            {t("documentForm.notes.label")}
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
        </div>

        <div className="form-actions">
          <button type="submit" className="save-document" disabled={isSubmitting}>
            {t("documentForm.save")}
          </button>
          <button type="button" className="cancel-document" onClick={onCancel} disabled={isSubmitting}>
            {t("documentForm.cancel")}
          </button>
        </div>
      </form>
    </main>
  );
}
