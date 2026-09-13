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
  // The invitation file, when the user attaches one — see the "appointment
  // invitation" upload below, which is optional (an appointment can be
  // created/edited without one). Not part of AppointmentInput, same
  // reasoning as DoctorFormScreen's separate photo parameter.
  onSubmit: (input: AppointmentInput, invitationFile: File | null) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<Omit<AppointmentInput, "location">>({
    doctorId: appointment?.doctorId ?? null,
    dateTime: appointment?.dateTime ?? "",
    notes: appointment?.notes ?? "",
  });
  const [errors, setErrors] = useState<RequiredFieldErrors>({});
  const [invitationFile, setInvitationFile] = useState<File | null>(null);
  // Issue #50: doctor selection fills this from the doctor's address, until
  // it's hand-edited (autoFilled tracks which of those states it's in).
  const [location, setLocation] = useState({ value: appointment?.location ?? "", autoFilled: !appointment });

  const setField = <K extends keyof typeof formData>(key: K, value: (typeof formData)[K]) =>
    setFormData((prev) => ({ ...prev, [key]: value }));

  const handleDoctorChange = (value: string) => {
    const doctorId = value ? Number(value) : null;
    const doctor = doctors.find((d) => d.id === doctorId);
    setField("doctorId", doctorId);
    setLocation((prev) => (prev.autoFilled ? { value: doctor?.address ?? "", autoFilled: true } : prev));
  };

  const handleLocationChange = (value: string) => setLocation({ value, autoFilled: false });

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    // Mirrors the server's own required-field check (Appointments.validate)
    // so the user sees the problem immediately instead of round-tripping.
    const nextErrors: RequiredFieldErrors = {};
    if (!formData.notes.trim()) nextErrors.notes = t("appointmentForm.notes.required");
    if (!formData.dateTime.trim()) nextErrors.dateTime = t("appointmentForm.dateTime.required");
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    onSubmit({ ...formData, location: location.value }, invitationFile);
  };

  return (
    <main className="screen appointment-form-screen">
      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <label>
            {t("appointmentForm.doctor.label")}
            <select value={formData.doctorId ?? ""} onChange={(e) => handleDoctorChange(e.target.value)}>
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
            <input type="text" value={location.value} onChange={(e) => handleLocationChange(e.target.value)} />
          </label>
        </div>
        <div className="form-field">
          <label>
            {t("appointmentForm.notes.label")}
            <textarea value={formData.notes} onChange={(e) => setField("notes", e.target.value)} />
          </label>
          {errors.notes && <p className="field-error">{errors.notes}</p>}
        </div>
        <div className="form-field">
          <label>
            {t("appointmentForm.invitation.label")}
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setInvitationFile(e.target.files?.[0] ?? null)}
            />
          </label>
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
