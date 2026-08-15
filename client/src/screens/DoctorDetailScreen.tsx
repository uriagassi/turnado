import { useTranslation } from "react-i18next";
import type { Doctor } from "../api";
import { DoctorAvatar } from "../components/DoctorAvatar";

export function DoctorDetailScreen({ doctor, onBack }: { doctor: Doctor; onBack: () => void }) {
  const { t } = useTranslation();

  return (
    <main className="screen doctor-detail-screen">
      <div className="doctor-header">
        <h1>{doctor.name}</h1>
        <DoctorAvatar doctor={doctor} />
      </div>
      {doctor.specialty && <p>{doctor.specialty}</p>}
      {doctor.clinic && <p>{doctor.clinic}</p>}
      {doctor.phone && <p>{doctor.phone}</p>}
      {doctor.address && <p>{doctor.address}</p>}
      {doctor.email && <p>{doctor.email}</p>}
      <p>{doctor.notes}</p>

      <section>
        <h2>{t("doctorDetail.appointment.title")}</h2>
        <p className="empty-state">{t("doctorDetail.appointment.empty")}</p>
      </section>

      <section>
        <h2>{t("doctorDetail.openItems.title")}</h2>
        <p className="empty-state">{t("doctorDetail.openItems.empty")}</p>
      </section>

      <section>
        <h2>{t("doctorDetail.documents.title")}</h2>
        <p className="empty-state">{t("doctorDetail.documents.empty")}</p>
      </section>

      <button type="button" className="back-to-list" onClick={onBack}>
        {t("doctorDetail.back")}
      </button>
    </main>
  );
}
