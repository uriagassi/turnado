import { useTranslation } from "react-i18next";
import type { AuthClientData } from "../api";

export function SignInScreen({ authInfo }: { authInfo: AuthClientData }) {
  const { t } = useTranslation();
  return (
    <main className="screen status-screen">
      {authInfo.loginHref ? (
        <a className="sign-in-link" href={authInfo.loginHref}>
          {t("auth.signIn")}
        </a>
      ) : (
        <p>{t("auth.loading")}</p>
      )}
    </main>
  );
}
