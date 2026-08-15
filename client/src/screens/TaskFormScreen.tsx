import { FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Doctor, Task, TaskInput, TaskStatus, TaskType } from "../api";

type RequiredFieldErrors = { title?: string; doctorId?: string };

export function TaskFormScreen({
  task,
  doctors,
  onSubmit,
  onCancel,
  onResolveToAppointment,
}: {
  task?: Task;
  doctors: Doctor[];
  onSubmit: (input: TaskInput) => void;
  onCancel: () => void;
  onResolveToAppointment?: (task: Task) => void;
}) {
  const { t } = useTranslation();
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

  const setField = <K extends keyof TaskInput>(key: K, value: TaskInput[K]) =>
    setFormData((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const nextErrors: RequiredFieldErrors = {};
    if (!formData.title.trim()) nextErrors.title = t("taskForm.name.required");
    if (formData.type === "doctor_visit" && !formData.doctorId) {
      nextErrors.doctorId = t("taskForm.doctor.required");
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    onSubmit({
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
    });
  };

  const isResolvable =
    Boolean(task) &&
    (formData.type === "doctor_visit" || (formData.type === "test" && formData.requiresAdvanceScheduling));

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
