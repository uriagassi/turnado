import { useTranslation } from "react-i18next";
import type { Appointment, Doctor } from "../api";
import { DoctorAvatar } from "../components/DoctorAvatar";
import { useRelativeDateTime } from "../hooks/useRelativeDateTime";

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
  const { t } = useTranslation();
  const formatRelative = useRelativeDateTime();

  return (
    <main className="screen doctor-detail-screen">
      {/* Labeled, full-width back-link at the TOP of the page rather than a
          footer button — matches the winning doctor-view prototype
          (06-doctor-view.html), whose round-2 feedback specifically flagged
          "from the detail view, not obvious how to get back to the list". */}
      <button type="button" className="back-link" onClick={onBack}>
        <span className="back-link-arrow" aria-hidden="true">
          ←
        </span>
        {t("doctorDetail.back")}
      </button>
      {/* Compact avatar + name/specialty header, matching the prototype's
          `.detail-head` — a small round avatar next to the identity, not a
          large portrait spanning the row. Contact fields (clinic/phone/
          address/email) have no prototype equivalent (its mock data doesn't
          model them), so they get their own themed card below instead of
          crowding the header. */}
      <div className="detail-head">
        <DoctorAvatar doctor={doctor} />
        <div className="detail-titles">
          <h1>{doctor.name}</h1>
          {doctor.specialty && <p className="detail-specialty">{doctor.specialty}</p>}
        </div>
      </div>
      {(doctor.clinic || doctor.phone || doctor.address || doctor.email) && (
        <div className="card doctor-contact">
          {doctor.clinic && <p>{doctor.clinic}</p>}
          {doctor.phone && <p>{doctor.phone}</p>}
          {doctor.address && <p>{doctor.address}</p>}
          {doctor.email && <p>{doctor.email}</p>}
        </div>
      )}
      <button type="button" className="edit-doctor" onClick={onEdit}>
        {t("doctorDetail.edit")}
      </button>
      {doctor.notes && <p className="doctor-notes">{doctor.notes}</p>}

      <section>
        <h2 className="section-title">{t("doctorDetail.appointment.title")}</h2>
        {nextAppointment ? (
          // Card + status badge, matching the prototype's `.item-row` —
          // same treatment as the appointments/tasks/documents rows in its
          // detail view (06-doctor-view.html).
          <div className="card item-row">
            <div>
              <p className="next-appointment-notes">{nextAppointment.notes}</p>
              <p className="item-row-sub">{formatRelative(nextAppointment.dateTime)}</p>
            </div>
            <span className={`badge badge-${nextAppointment.status}`}>
              {t(`appointmentCard.status.${nextAppointment.status}`)}
            </span>
          </div>
        ) : (
          <p className="section-empty">{t("doctorDetail.appointment.empty")}</p>
        )}
      </section>

      <section>
        <h2 className="section-title">{t("doctorDetail.openItems.title")}</h2>
        <p className="section-empty">{t("doctorDetail.openItems.empty")}</p>
      </section>

      <section>
        <h2 className="section-title">{t("doctorDetail.documents.title")}</h2>
        <p className="section-empty">{t("doctorDetail.documents.empty")}</p>
      </section>
    </main>
  );
}
