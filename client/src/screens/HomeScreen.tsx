import { useTranslation } from "react-i18next";
import type { HomeData } from "../api";

export function HomeScreen({ home, onOpenDoctors }: { home: HomeData; onOpenDoctors: () => void }) {
  const { t } = useTranslation();
  const isEmpty = !home.nextAppointment && home.openItems.length === 0 && home.recentDocuments.length === 0;

  return (
    <main className="screen home-screen">
      <h1>{t("home.title")}</h1>
      {isEmpty && <p className="empty-state">{t("home.empty")}</p>}
      {/* Temporary entry point until appointments (issue #4) land — the spec's
          other way in, tapping a doctor's name on an appointment card,
          doesn't exist yet. */}
      <button type="button" onClick={onOpenDoctors}>
        {t("doctors.title")}
      </button>
    </main>
  );
}
