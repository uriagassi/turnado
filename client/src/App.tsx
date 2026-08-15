import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { applyLocale } from "./i18n";
import { fetchAuthInfo, fetchCurrentUser, fetchHome, fetchDoctors, AuthClientData, Doctor, HomeData, UserInfo } from "./api";
import { HomeScreen } from "./screens/HomeScreen";
import { NotAuthorizedScreen } from "./screens/NotAuthorizedScreen";
import { SignInScreen } from "./screens/SignInScreen";
import { DoctorsScreen } from "./screens/DoctorsScreen";
import { DoctorDetailScreen } from "./screens/DoctorDetailScreen";

type AppState =
  | { phase: "loading" }
  | { phase: "not-authorized" }
  | { phase: "sign-in"; authInfo: AuthClientData }
  | { phase: "home"; user: UserInfo; home: HomeData }
  | { phase: "doctors"; user: UserInfo; home: HomeData; doctors: Doctor[] }
  | { phase: "doctor-detail"; user: UserInfo; home: HomeData; doctors: Doctor[]; doctor: Doctor };

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
      if (!cancelled) setState({ phase: "home", user: result.user, home });
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
      const { user, home } = state;
      const openDoctors = async () => {
        const doctors = await fetchDoctors();
        setState({ phase: "doctors", user, home, doctors });
      };
      return <HomeScreen home={home} onOpenDoctors={openDoctors} />;
    }
    case "doctors": {
      const { user, home, doctors } = state;
      const selectDoctor = (id: number) => {
        const doctor = doctors.find((d) => d.id === id);
        if (doctor) setState({ phase: "doctor-detail", user, home, doctors, doctor });
      };
      return <DoctorsScreen doctors={doctors} onSelectDoctor={selectDoctor} />;
    }
    case "doctor-detail": {
      const { user, home, doctors } = state;
      const back = () => setState({ phase: "doctors", user, home, doctors });
      return <DoctorDetailScreen doctor={state.doctor} onBack={back} />;
    }
  }
}
