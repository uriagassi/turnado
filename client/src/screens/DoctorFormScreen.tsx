import { FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Doctor, DoctorInput } from "../api";
import { DoctorAvatar } from "../components/DoctorAvatar";

// The plain single-line text fields — every DoctorInput key except name
// (which gets its own required-field validation/error slot below) and
// notes (its own textarea), and photo, which isn't part of DoctorInput at
// all (see setPhoto/Doctors.ts header comment on why it's a separate
// upload, not a create/update field).
const OPTIONAL_TEXT_FIELDS = ["specialty", "clinic", "phone", "address", "email"] as const;

type RequiredFieldErrors = { name?: string };

function TextField({
  label,
  type = "text",
  value,
  onChange,
}: {
  label: string;
  type?: "text" | "email";
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="form-field">
      <label>
        {label}
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
      </label>
    </div>
  );
}

export function DoctorFormScreen({
  doctor,
  onSubmit,
  onCancel,
}: {
  doctor?: Doctor;
  onSubmit: (input: DoctorInput, photo: File | null) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<DoctorInput>({
    name: doctor?.name ?? "",
    specialty: doctor?.specialty ?? "",
    clinic: doctor?.clinic ?? "",
    phone: doctor?.phone ?? "",
    address: doctor?.address ?? "",
    email: doctor?.email ?? "",
    notes: doctor?.notes ?? "",
  });
  const [errors, setErrors] = useState<RequiredFieldErrors>({});
  const [photo, setPhoto] = useState<File | null>(null);

  const setField = <K extends keyof DoctorInput>(key: K, value: DoctorInput[K]) =>
    setFormData((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    // Mirrors the server's own required-field check (Doctors.validate) so the
    // user sees the problem immediately instead of round-tripping to find out.
    const nextErrors: RequiredFieldErrors = {};
    if (!formData.name.trim()) nextErrors.name = t("doctorForm.name.required");
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    onSubmit(formData, photo);
  };

  return (
    <main className="screen doctor-form-screen">
      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <label>
            {t("doctorForm.name.label")}
            <input type="text" value={formData.name} onChange={(e) => setField("name", e.target.value)} />
          </label>
          {errors.name && <p className="field-error">{errors.name}</p>}
        </div>
        {OPTIONAL_TEXT_FIELDS.map((field) => (
          <TextField
            key={field}
            label={t(`doctorForm.${field}.label`)}
            type={field === "email" ? "email" : "text"}
            value={formData[field] ?? ""}
            onChange={(value) => setField(field, value)}
          />
        ))}
        <div className="form-field">
          <label>
            {t("doctorForm.notes.label")}
            <textarea value={formData.notes ?? ""} onChange={(e) => setField("notes", e.target.value)} />
          </label>
        </div>
        <div className="form-field">
          {doctor && (
            // Shows what's already on file (photo or the initials fallback)
            // so the user knows what a blank file input would leave in
            // place, before deciding whether to replace it.
            <div className="current-photo">
              <span>{t("doctorForm.currentPhoto.label")}</span>
              <DoctorAvatar doctor={doctor} />
            </div>
          )}
          <label>
            {t("doctorForm.photo.label")}
            <input type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
          </label>
        </div>
        <div className="form-actions">
          <button type="submit" className="save-doctor">
            {t("doctorForm.save")}
          </button>
          <button type="button" className="cancel-doctor" onClick={onCancel}>
            {t("doctorForm.cancel")}
          </button>
        </div>
      </form>
    </main>
  );
}
