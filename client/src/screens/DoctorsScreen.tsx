import { useTranslation } from "react-i18next";
import type { Doctor } from "../api";

export function DoctorsScreen({ doctors }: { doctors: Doctor[] }) {
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
              <DoctorAvatar doctor={doctor} />
              {doctor.name}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function DoctorAvatar({ doctor }: { doctor: Doctor }) {
  return (
    <span className="doctor-avatar" data-testid="doctor-avatar">
      {doctor.photoPath ? <img src={`/photos/${doctor.photoPath}`} alt={doctor.name} /> : getInitials(doctor.name)}
    </span>
  );
}

// Title tokens ("Dr.", "Mr.", ...) are near-universal on a doctor's name in
// this app, so they're stripped before taking initials — otherwise every
// avatar in the list would start with the same "D".
function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter((word) => !/^[A-Za-z]{1,3}\.$/.test(word));
  return words.slice(0, 2).map((word) => word[0]?.toUpperCase() ?? "").join("");
}
