import { FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Appointment, AppointmentInput, Doctor } from "../api";

type RequiredFieldErrors = { dateTime?: string };

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
  onSubmit: (input: AppointmentInput, invitationFile: File | null) => Promise<void> | void;
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
  // Resolving a doctor_visit task into an appointment (see App.tsx's
  // navigateToResolveAppointment) hands us a doctor-prefilled but unsaved
  // appointment (no id) — still "new" for auto-fill purposes, and since the
  // doctor already comes pre-selected, the <select>'s onChange
  // (handleDoctorChange, below) never fires, so the initial value has to
  // account for that doctor's address itself.
  const [location, setLocation] = useState(() => {
    const isNew = !appointment?.id;
    const doctor = isNew ? doctors.find((d) => d.id === appointment?.doctorId) : undefined;
    return { value: appointment?.location || doctor?.address || "", isDoctorDefault: isNew };
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const setField = <K extends keyof typeof formData>(key: K, value: (typeof formData)[K]) =>
    setFormData((prev) => ({ ...prev, [key]: value }));

  const handleDoctorChange = (value: string) => {
    const doctorId = value ? Number(value) : null;
    const doctor = doctors.find((d) => d.id === doctorId);
    setField("doctorId", doctorId);
    setLocation((prev) => (prev.isDoctorDefault ? { value: doctor?.address ?? "", isDoctorDefault: true } : prev));
  };

  const handleLocationChange = (value: string) => setLocation({ value, isDoctorDefault: false });

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    // Mirrors the server's own required-field check (Appointments.validate)
    // so the user sees the problem immediately instead of round-tripping.
    const nextErrors: RequiredFieldErrors = {};
    if (!formData.dateTime.trim()) nextErrors.dateTime = t("appointmentForm.dateTime.required");
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setIsSubmitting(true);
    try {
      await onSubmit({ ...formData, location: location.value }, invitationFile);
    } finally {
      setIsSubmitting(false);
    }
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
          <button type="submit" className="save-appointment" disabled={isSubmitting}>
            {t("appointmentForm.save")}
          </button>
          <button type="button" className="cancel-appointment" onClick={onCancel} disabled={isSubmitting}>
            {t("appointmentForm.cancel")}
          </button>
        </div>
      </form>
    </main>
  );
}
