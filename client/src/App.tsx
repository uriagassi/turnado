import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { applyLocale } from "./i18n";
import { fetchAuthInfo, fetchCurrentUser, fetchHome, fetchDoctors, AuthClientData, Doctor, HomeData, UserInfo } from "./api";
import { HomeScreen } from "./screens/HomeScreen";
import { NotAuthorizedScreen } from "./screens/NotAuthorizedScreen";
import { SignInScreen } from "./screens/SignInScreen";
import { DoctorsScreen } from "./screens/DoctorsScreen";
import { DoctorDetailScreen } from "./screens/DoctorDetailScreen";

type Session = { user: UserInfo; home: HomeData };

type AppState =
  | { phase: "loading" }
  | { phase: "not-authorized" }
  | { phase: "sign-in"; authInfo: AuthClientData }
  | { phase: "home"; session: Session }
  | { phase: "doctors"; session: Session; doctors: Doctor[] }
  | { phase: "doctor-detail"; session: Session; doctors: Doctor[]; doctor: Doctor };

export function App() {
  const { t } = useTranslation();
  const [state, setState] = useState<AppState>({ phase: "loading" });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const result = await fetchCurrentUser();
      if (cancelled) return;

      if (result.status === "not-authorized") {
        setState({ phase: "not-authorized" });
        return;
      }
      if (result.status === "unauthenticated") {
        const authInfo = await fetchAuthInfo();
        if (!cancelled) setState({ phase: "sign-in", authInfo });
        return;
      }

      applyLocale(result.user.locale);
      const home = await fetchHome();
      if (!cancelled) setState({ phase: "home", session: { user: result.user, home } });
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  switch (state.phase) {
    case "loading":
      return <p className="status">{t("auth.loading")}</p>;
    case "not-authorized":
      return <NotAuthorizedScreen />;
    case "sign-in":
      return <SignInScreen authInfo={state.authInfo} />;
    case "home": {
      const { session } = state;
      const openDoctors = async () => {
        const doctors = await fetchDoctors();
        setState({ phase: "doctors", session, doctors });
      };
      return <HomeScreen home={session.home} onOpenDoctors={openDoctors} />;
    }
    case "doctors": {
      const { session, doctors } = state;
      const selectDoctor = (doctor: Doctor) => setState({ phase: "doctor-detail", session, doctors, doctor });
      return <DoctorsScreen doctors={doctors} onSelectDoctor={selectDoctor} />;
    }
    case "doctor-detail": {
      const { session, doctors } = state;
      const back = () => setState({ phase: "doctors", session, doctors });
      return <DoctorDetailScreen doctor={state.doctor} onBack={back} />;
    }
  }
}
