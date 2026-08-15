import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { applyLocale } from "./i18n";
import {
  fetchAuthInfo,
  fetchCurrentUser,
  fetchHome,
  fetchDoctors,
  createDoctor,
  updateDoctor,
  AuthClientData,
  Doctor,
  DoctorInput,
  HomeData,
  UserInfo,
} from "./api";
import { HomeScreen } from "./screens/HomeScreen";
import { NotAuthorizedScreen } from "./screens/NotAuthorizedScreen";
import { SignInScreen } from "./screens/SignInScreen";
import { DoctorsScreen } from "./screens/DoctorsScreen";
import { DoctorDetailScreen } from "./screens/DoctorDetailScreen";
import { DoctorFormScreen } from "./screens/DoctorFormScreen";

type Session = { user: UserInfo; home: HomeData };

type AppState =
  | { phase: "loading" }
  | { phase: "not-authorized" }
  | { phase: "sign-in"; authInfo: AuthClientData }
  | { phase: "home"; session: Session }
  | { phase: "doctors"; session: Session; doctors: Doctor[] }
  | { phase: "doctor-detail"; session: Session; doctors: Doctor[]; doctor: Doctor }
  // `doctor` is undefined when adding a new doctor, set when editing an existing one.
  | { phase: "doctor-form"; session: Session; doctors: Doctor[]; doctor?: Doctor };

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
      const addDoctor = () => setState({ phase: "doctor-form", session, doctors });
      return <DoctorsScreen doctors={doctors} onSelectDoctor={selectDoctor} onAddDoctor={addDoctor} />;
    }
    case "doctor-detail": {
      const { session, doctors, doctor } = state;
      const back = () => setState({ phase: "doctors", session, doctors });
      const edit = () => setState({ phase: "doctor-form", session, doctors, doctor });
      return <DoctorDetailScreen doctor={doctor} onBack={back} onEdit={edit} />;
    }
    case "doctor-form": {
      const { session, doctors, doctor } = state;
      const cancel = () =>
        doctor
          ? setState({ phase: "doctor-detail", session, doctors, doctor })
          : setState({ phase: "doctors", session, doctors });
      const submit = async (input: DoctorInput) => {
        const saved = doctor ? await updateDoctor(doctor.id, input) : await createDoctor(input);
        const nextDoctors = doctor
          ? doctors.map((d) => (d.id === saved.id ? saved : d))
          : [...doctors, saved].sort((a, b) => a.name.localeCompare(b.name));
        setState({ phase: "doctor-detail", session, doctors: nextDoctors, doctor: saved });
      };
      return <DoctorFormScreen doctor={doctor} onSubmit={submit} onCancel={cancel} />;
    }
  }
}
