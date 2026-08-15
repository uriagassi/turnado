import { useTranslation } from "react-i18next";
import type { Appointment, Doctor } from "../api";
import { DoctorAvatar } from "../components/DoctorAvatar";
import { formatDateTime } from "../formatDateTime";

export function DoctorDetailScreen({
  doctor,
  nextAppointment,
  onBack,
  onEdit,
}: {
  doctor: Doctor;
  /** This doctor's soonest upcoming appointment, if any — populated by App.tsx via selectHeroAppointment-style filtering over this doctor's appointments (see issue #4 AC: doctor detail shows their next appointment). */
  nextAppointment?: Appointment;
  onBack: () => void;
  onEdit: () => void;
}) {
  const { t, i18n } = useTranslation();

  return (
    <main className="screen doctor-detail-screen">
      <div className="doctor-card">
        <div className="doctor-info">
          <h1>{doctor.name}</h1>
          {doctor.specialty && <p>{doctor.specialty}</p>}
          {doctor.clinic && <p>{doctor.clinic}</p>}
          {doctor.phone && <p>{doctor.phone}</p>}
          {doctor.address && <p>{doctor.address}</p>}
          {doctor.email && <p>{doctor.email}</p>}
        </div>
        <DoctorAvatar doctor={doctor} />
      </div>
      <button type="button" className="edit-doctor" onClick={onEdit}>
        {t("doctorDetail.edit")}
      </button>
      {doctor.notes && <p className="doctor-notes">{doctor.notes}</p>}

      <section>
        <h2>{t("doctorDetail.appointment.title")}</h2>
        {nextAppointment ? (
          <div className="next-appointment">
            <p className="next-appointment-date">{formatDateTime(nextAppointment.dateTime, i18n.language)}</p>
            <p className="next-appointment-notes">{nextAppointment.notes}</p>
          </div>
        ) : (
          <p className="empty-state">{t("doctorDetail.appointment.empty")}</p>
        )}
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
