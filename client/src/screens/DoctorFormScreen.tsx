import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Doctor, DoctorInput } from "../api";
import { DoctorAvatar } from "../components/DoctorAvatar";

import { createPreviewUrl } from "../utils/filePreview";

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
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;
    let urlToRevoke: string | null = null;

    if (!photo) {
      setPhotoPreview(null);
      return;
    }

    createPreviewUrl(photo).then((url) => {
      if (isCancelled) {
        if (url && typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function") {
          URL.revokeObjectURL(url);
        }
        return;
      }
      urlToRevoke = url;
      setPhotoPreview(url);
    });

    return () => {
      isCancelled = true;
      if (urlToRevoke && typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function") {
        URL.revokeObjectURL(urlToRevoke);
      }
    };
  }, [photo]);

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
          {(photoPreview || doctor) && (
            // Shows what's currently selected or on file
            <div className="current-photo">
              <span>
                {photoPreview
                  ? t("doctorForm.newPhotoPreview.label", "Selected photo:")
                  : t("doctorForm.currentPhoto.label")}
              </span>
              {photoPreview ? (
                <img
                  src={photoPreview}
                  alt="Selected doctor photo preview"
                  className="doctor-avatar"
                  style={{ objectFit: "cover", borderRadius: "50%" }}
                />
              ) : (
                <DoctorAvatar doctor={doctor!} />
              )}
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
