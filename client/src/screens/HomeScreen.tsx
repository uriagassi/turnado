import { useTranslation } from "react-i18next";
import type { HomeData } from "../api";

export function HomeScreen({ home }: { home: HomeData }) {
  const { t } = useTranslation();
  const isEmpty = !home.nextAppointment && home.openItems.length === 0 && home.recentDocuments.length === 0;

  return (
    <main className="screen home-screen">
      <h1>{t("home.title")}</h1>
      {isEmpty && <p className="empty-state">{t("home.empty")}</p>}
    </main>
  );
}
