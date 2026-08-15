import { FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Appointment, AppointmentInput, Doctor } from "../api";

type RequiredFieldErrors = { notes?: string; dateTime?: string };

export function AppointmentFormScreen({
  appointment,
  doctors,
  onSubmit,
  onCancel,
}: {
  appointment?: Appointment;
  doctors: Doctor[];
  onSubmit: (input: AppointmentInput) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<AppointmentInput>({
    doctorId: appointment?.doctorId ?? null,
    dateTime: appointment?.dateTime ?? "",
    location: appointment?.location ?? "",
    notes: appointment?.notes ?? "",
  });
  const [errors, setErrors] = useState<RequiredFieldErrors>({});

  const setField = <K extends keyof AppointmentInput>(key: K, value: AppointmentInput[K]) =>
    setFormData((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    // Mirrors the server's own required-field check (Appointments.validate)
    // so the user sees the problem immediately instead of round-tripping.
    const nextErrors: RequiredFieldErrors = {};
    if (!formData.notes.trim()) nextErrors.notes = t("appointmentForm.notes.required");
    if (!formData.dateTime.trim()) nextErrors.dateTime = t("appointmentForm.dateTime.required");
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    onSubmit(formData);
  };

  return (
    <main className="screen appointment-form-screen">
      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <label>
            {t("appointmentForm.doctor.label")}
            <select
              value={formData.doctorId ?? ""}
              onChange={(e) => setField("doctorId", e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">{t("appointmentForm.doctor.none")}</option>
              {doctors.map((doctor) => (
                <option key={doctor.id} value={doctor.id}>
                  {doctor.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="form-field">
          <label>
            {t("appointmentForm.dateTime.label")}
            <input type="datetime-local" value={formData.dateTime} onChange={(e) => setField("dateTime", e.target.value)} />
          </label>
          {errors.dateTime && <p className="field-error">{errors.dateTime}</p>}
        </div>
        <div className="form-field">
          <label>
            {t("appointmentForm.location.label")}
            <input type="text" value={formData.location ?? ""} onChange={(e) => setField("location", e.target.value)} />
          </label>
        </div>
        <div className="form-field">
          <label>
            {t("appointmentForm.notes.label")}
            <textarea value={formData.notes} onChange={(e) => setField("notes", e.target.value)} />
          </label>
          {errors.notes && <p className="field-error">{errors.notes}</p>}
        </div>
        <div className="form-actions">
          <button type="submit" className="save-appointment">
            {t("appointmentForm.save")}
          </button>
          <button type="button" className="cancel-appointment" onClick={onCancel}>
            {t("appointmentForm.cancel")}
          </button>
        </div>
      </form>
    </main>
  );
}
