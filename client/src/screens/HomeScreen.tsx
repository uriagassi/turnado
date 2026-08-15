import { useTranslation } from "react-i18next";
import type { Doctor, HomeData } from "../api";
import { formatDateTime } from "../formatDateTime";

export function HomeScreen({
  home,
  doctors,
  onOpenDoctors,
  onSelectDoctor,
  onAddAppointment,
  onViewUpcoming,
  onViewHistory,
  onRefresh,
}: {
  home: HomeData;
  doctors: Doctor[];
  onOpenDoctors: () => void;
  /** Follows the doctor-name link on the hero card into that doctor's detail view (see issue #4 AC). */
  onSelectDoctor: (doctor: Doctor) => void;
  onAddAppointment: () => void;
  onViewUpcoming: () => void;
  onViewHistory: () => void;
  onRefresh: () => void;
}) {
  const { t, i18n } = useTranslation();
  const isEmpty = !home.nextAppointment && home.openItems.length === 0 && home.recentDocuments.length === 0;
  const heroDoctor = home.nextAppointment?.doctorId
    ? doctors.find((d) => d.id === home.nextAppointment?.doctorId)
    : undefined;

  return (
    <main className="screen home-screen">
      <div className="home-header">
        <h1>{t("home.title")}</h1>
        <button type="button" className="refresh-home" onClick={onRefresh}>
          {t("home.refresh")}
        </button>
      </div>
      {home.nextAppointment && (
        // Single-column, phone-legible per the AC — no side-by-side layout
        // to squeeze on a narrow viewport.
        <section className="hero-card">
          <h2>{t("home.hero.title")}</h2>
          {heroDoctor && (
            <button type="button" className="hero-doctor-link" onClick={() => onSelectDoctor(heroDoctor)}>
              {heroDoctor.name}
            </button>
          )}
          <p className="hero-date">{formatDateTime(home.nextAppointment.dateTime, i18n.language)}</p>
          <p className="hero-notes">{home.nextAppointment.notes}</p>
        </section>
      )}
      {isEmpty && <p className="empty-state">{t("home.empty")}</p>}
      <nav className="home-nav">
        <button type="button" className="home-nav-item" onClick={onAddAppointment}>
          {t("home.addAppointment")}
        </button>
        <button type="button" className="home-nav-item" onClick={onOpenDoctors}>
          {t("doctors.title")}
        </button>
        <button type="button" className="home-nav-item" onClick={onViewUpcoming}>
          {t("home.viewUpcoming")}
        </button>
        <button type="button" className="home-nav-item" onClick={onViewHistory}>
          {t("home.viewHistory")}
        </button>
      </nav>
    </main>
  );
}
