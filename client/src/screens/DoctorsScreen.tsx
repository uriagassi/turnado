import { useTranslation } from "react-i18next";
import type { Doctor } from "../api";
import { DoctorAvatar } from "../components/DoctorAvatar";

export function DoctorsScreen({ doctors, onSelectDoctor }: { doctors: Doctor[]; onSelectDoctor: (doctor: Doctor) => void }) {
  const { t } = useTranslation();

  return (
    <main className="screen doctors-screen">
      <h1>{t("doctors.title")}</h1>
      {doctors.length === 0 ? (
        <p className="empty-state">{t("doctors.empty")}</p>
      ) : (
        <ul className="doctor-list">
          {doctors.map((doctor) => (
            <li key={doctor.id}>
              {/* The whole row is the "details" affordance (AC: "list cards
                  with a clear details affordance") — a button rather than a
                  link since there's no URL routing in this app (see App.tsx). */}
              <button type="button" className="doctor-row" onClick={() => onSelectDoctor(doctor)}>
                <DoctorAvatar doctor={doctor} />
                <span className="doctor-name">{doctor.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
