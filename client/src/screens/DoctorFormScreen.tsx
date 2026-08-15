import { FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Doctor, DoctorInput } from "../api";

export function DoctorFormScreen({
  doctor,
  onSubmit,
  onCancel,
}: {
  doctor?: Doctor;
  onSubmit: (input: DoctorInput) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(doctor?.name ?? "");
  const [specialty, setSpecialty] = useState(doctor?.specialty ?? "");
  const [clinic, setClinic] = useState(doctor?.clinic ?? "");
  const [phone, setPhone] = useState(doctor?.phone ?? "");
  const [address, setAddress] = useState(doctor?.address ?? "");
  const [email, setEmail] = useState(doctor?.email ?? "");
  const [notes, setNotes] = useState(doctor?.notes ?? "");
  const [errors, setErrors] = useState<{ name?: string; notes?: string }>({});

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    // Mirrors the server's own required-field check (Doctors.validate) so the
    // user sees the problem immediately instead of round-tripping to find out.
    const nextErrors: { name?: string; notes?: string } = {};
    if (!name.trim()) nextErrors.name = t("doctorForm.name.required");
    if (!notes.trim()) nextErrors.notes = t("doctorForm.notes.required");
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    onSubmit({ name, specialty, clinic, phone, address, email, notes });
  };

  return (
    <main className="screen doctor-form-screen">
      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <label>
            {t("doctorForm.name.label")}
            <input type="text" name="name" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          {errors.name && <p className="field-error">{errors.name}</p>}
        </div>
        <div className="form-field">
          <label>
            {t("doctorForm.specialty.label")}
            <input type="text" name="specialty" value={specialty} onChange={(e) => setSpecialty(e.target.value)} />
          </label>
        </div>
        <div className="form-field">
          <label>
            {t("doctorForm.clinic.label")}
            <input type="text" name="clinic" value={clinic} onChange={(e) => setClinic(e.target.value)} />
          </label>
        </div>
        <div className="form-field">
          <label>
            {t("doctorForm.phone.label")}
            <input type="text" name="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </label>
        </div>
        <div className="form-field">
          <label>
            {t("doctorForm.address.label")}
            <input type="text" name="address" value={address} onChange={(e) => setAddress(e.target.value)} />
          </label>
        </div>
        <div className="form-field">
          <label>
            {t("doctorForm.email.label")}
            <input type="email" name="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
        </div>
        <div className="form-field">
          <label>
            {t("doctorForm.notes.label")}
            <textarea name="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
          {errors.notes && <p className="field-error">{errors.notes}</p>}
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
