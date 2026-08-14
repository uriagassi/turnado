import { useTranslation } from "react-i18next";

export function NotAuthorizedScreen() {
  const { t } = useTranslation();
  return (
    <main className="screen status-screen">
      <p>{t("auth.notAuthorized")}</p>
    </main>
  );
}
