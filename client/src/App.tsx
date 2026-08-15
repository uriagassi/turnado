import { useCallback, useEffect, useState } from "react";
import { useAutoRefresh } from "./hooks/useAutoRefresh";
import { useTranslation } from "react-i18next";
import { applyLocale } from "./i18n";
import {
  fetchAuthInfo,
  fetchCurrentUser,
  fetchHome,
  fetchDoctors,
  createDoctor,
  updateDoctor,
  uploadDoctorPhoto,
  fetchAppointments,
  createAppointment,
  updateAppointment,
  setAppointmentStatus,
  setAppointmentSummary,
  AuthClientData,
  Appointment,
  AppointmentInput,
  AppointmentStatus,
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
import { AppointmentFormScreen } from "./screens/AppointmentFormScreen";
import { AppointmentHistoryScreen } from "./screens/AppointmentHistoryScreen";
import { UpcomingAppointmentsScreen } from "./screens/UpcomingAppointmentsScreen";

type Session = { user: UserInfo; home: HomeData; doctors: Doctor[]; appointments: Appointment[] };

/**
 * Creates a new Doctor, or updates an existing one when `doctor` is set —
 * the same create-vs-edit branch DoctorFormScreen itself renders around.
 * Uploading a selected photo is a separate request (see uploadDoctorPhoto /
 * the server's own POST /api/doctors/:id/photo route) since photoPath isn't
 * part of DoctorInput — it needs the id this call itself produces on
 * create, so it always runs after, never merged into the same request.
 */
async function saveDoctor(doctor: Doctor | undefined, input: DoctorInput, photo: File | null): Promise<Doctor> {
  const saved = doctor ? await updateDoctor(doctor.id, input) : await createDoctor(input);
  return photo ? uploadDoctorPhoto(saved.id, photo) : saved;
}

/** Folds a just-saved Doctor into the in-memory list: replaces it in place on edit, or inserts it in name order on create (list order matches the server's own `ORDER BY name`, see Doctors.ts). */
function withSavedDoctor(doctors: Doctor[], wasEdit: boolean, saved: Doctor): Doctor[] {
  if (wasEdit) return doctors.map((d) => (d.id === saved.id ? saved : d));
  return [...doctors, saved].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Folds a just-saved Appointment into the session: replaces it in place
 * (edit, status change, summary) or appends it (create). `home` is only
 * passed when the save could move the hero card (create/edit/status all
 * can; a summary save can't change what's "next", so its callers omit it).
 */
function withSavedAppointment(session: Session, saved: Appointment, wasEdit: boolean, home?: HomeData): Session {
  const appointments = wasEdit
    ? session.appointments.map((a) => (a.id === saved.id ? saved : a))
    : [...session.appointments, saved];
  return { ...session, appointments, ...(home ? { home } : {}) };
}

/**
 * The soonest still-upcoming planned appointment for one doctor — the
 * client-side counterpart of the server's selectHeroAppointment (see
 * server/src/appointments/heroAppointment.ts), scoped to a single doctorId
 * for the doctor detail view's "next appointment" section.
 */
function nextAppointmentForDoctor(appointments: Appointment[], doctorId: number, now: Date): Appointment | undefined {
  const upcoming = appointments.filter((a) => a.doctorId === doctorId && a.status === "planned" && new Date(a.dateTime) >= now);
  if (upcoming.length === 0) return undefined;
  return upcoming.reduce((soonest, a) => (new Date(a.dateTime) < new Date(soonest.dateTime) ? a : soonest));
}

/** Past appointments, most recent first — the client-side counterpart of the server's selectPastAppointments (see server/src/appointments/appointmentHistory.ts), for the history/archive view. */
function pastAppointments(appointments: Appointment[], now: Date): Appointment[] {
  return appointments
    .filter((a) => new Date(a.dateTime) < now)
    .sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());
}

/** Every still-upcoming planned appointment, soonest first — the client-side counterpart of the server's selectUpcomingAppointments (see server/src/appointments/heroAppointment.ts), for the "upcoming appointments" view. */
function upcomingAppointments(appointments: Appointment[], now: Date): Appointment[] {
  return appointments
    .filter((a) => a.status === "planned" && new Date(a.dateTime) >= now)
    .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
}

type AppState =
  | { phase: "loading" }
  | { phase: "not-authorized" }
  | { phase: "sign-in"; authInfo: AuthClientData }
  | { phase: "home"; session: Session }
  | { phase: "doctors"; session: Session; doctors: Doctor[] }
  | { phase: "doctor-detail"; session: Session; doctors: Doctor[]; doctor: Doctor }
  // `doctor` is undefined when adding a new doctor, set when editing an existing one.
  | { phase: "doctor-form"; session: Session; doctors: Doctor[]; doctor?: Doctor }
  // `appointment` is undefined when adding; `returnTo` is where Save/Cancel lands —
  // wherever the user opened the form from (home's "Add appointment", or an
  // Edit on an Upcoming/History card).
  | { phase: "appointment-form"; session: Session; appointment?: Appointment; returnTo: "home" | "appointment-upcoming" | "appointment-history" }
  | { phase: "appointment-upcoming"; session: Session }
  | { phase: "appointment-history"; session: Session };

/** How often the home screen's data refreshes itself in the background, absent a manual refresh or a window-focus event (see useAutoRefresh). */
const HOME_REFRESH_INTERVAL_MS = 45_000;

export function App() {
  const { t } = useTranslation();
  const [state, setState] = useState<AppState>({ phase: "loading" });

  // Re-fetches the home screen's own data — the appointment feed and, along
  // with it, the doctors/appointments lists the hero card's doctor link and
  // doctor-detail's next-appointment section read from — and, if the user's
  // still on the home screen by the time it resolves, folds it into that
  // screen's session. A no-op otherwise, so a refresh that lands after
  // navigating away doesn't stomp on whatever screen the user moved to.
  const refreshHome = useCallback(async () => {
    const [home, doctors, appointments] = await Promise.all([fetchHome(), fetchDoctors(), fetchAppointments()]);
    setState((prev) => (prev.phase === "home" ? { ...prev, session: { ...prev.session, home, doctors, appointments } } : prev));
  }, []);
  useAutoRefresh(refreshHome, HOME_REFRESH_INTERVAL_MS);

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
      const [home, doctors, appointments] = await Promise.all([fetchHome(), fetchDoctors(), fetchAppointments()]);
      if (!cancelled) setState({ phase: "home", session: { user: result.user, home, doctors, appointments } });
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
      const selectDoctor = (doctor: Doctor) => setState({ phase: "doctor-detail", session, doctors: session.doctors, doctor });
      const addAppointment = () => setState({ phase: "appointment-form", session, returnTo: "home" });
      const viewUpcoming = () => setState({ phase: "appointment-upcoming", session });
      const viewHistory = () => setState({ phase: "appointment-history", session });
      return (
        <HomeScreen
          home={session.home}
          doctors={session.doctors}
          onOpenDoctors={openDoctors}
          onSelectDoctor={selectDoctor}
          onAddAppointment={addAppointment}
          onViewUpcoming={viewUpcoming}
          onViewHistory={viewHistory}
          onRefresh={refreshHome}
        />
      );
    }
    case "doctors": {
      const { session, doctors } = state;
      const selectDoctor = (doctor: Doctor) => setState({ phase: "doctor-detail", session, doctors, doctor });
      const addDoctor = () => setState({ phase: "doctor-form", session, doctors });
      const backHome = () => setState({ phase: "home", session });
      return <DoctorsScreen doctors={doctors} onSelectDoctor={selectDoctor} onAddDoctor={addDoctor} onBackHome={backHome} />;
    }
    case "doctor-detail": {
      const { session, doctors, doctor } = state;
      const back = () => setState({ phase: "doctors", session, doctors });
      const edit = () => setState({ phase: "doctor-form", session, doctors, doctor });
      const nextAppointment = nextAppointmentForDoctor(session.appointments, doctor.id, new Date());
      return <DoctorDetailScreen doctor={doctor} nextAppointment={nextAppointment} onBack={back} onEdit={edit} />;
    }
    case "doctor-form": {
      const { session, doctors, doctor } = state;
      const cancel = () =>
        doctor
          ? setState({ phase: "doctor-detail", session, doctors, doctor })
          : setState({ phase: "doctors", session, doctors });
      const submit = async (input: DoctorInput, photo: File | null) => {
        const saved = await saveDoctor(doctor, input, photo);
        const nextDoctors = withSavedDoctor(doctors, doctor !== undefined, saved);
        setState({ phase: "doctor-detail", session, doctors: nextDoctors, doctor: saved });
      };
      return <DoctorFormScreen doctor={doctor} onSubmit={submit} onCancel={cancel} />;
    }
    case "appointment-form": {
      const { session, appointment, returnTo } = state;
      const cancel = () => setState({ phase: returnTo, session });
      const submit = async (input: AppointmentInput) => {
        const saved = appointment ? await updateAppointment(appointment.id, input) : await createAppointment(input);
        // Also re-fetches home, not just folding `saved` into the
        // appointments list — home.nextAppointment is computed server-side
        // (selectHeroAppointment) and a created/edited appointment can
        // become (or stop being) that hero card, which the fold alone
        // wouldn't reflect.
        const home = await fetchHome();
        setState({ phase: returnTo, session: withSavedAppointment(session, saved, appointment !== undefined, home) });
      };
      return <AppointmentFormScreen appointment={appointment} doctors={session.doctors} onSubmit={submit} onCancel={cancel} />;
    }
    case "appointment-upcoming": {
      const { session } = state;
      const back = () => setState({ phase: "home", session });
      const selectDoctor = (doctor: Doctor) => setState({ phase: "doctor-detail", session, doctors: session.doctors, doctor });
      const editAppointment = (appointment: Appointment) =>
        setState({ phase: "appointment-form", session, appointment, returnTo: "appointment-upcoming" });
      const changeStatus = async (appointment: Appointment, status: AppointmentStatus) => {
        const saved = await setAppointmentStatus(appointment.id, status);
        const home = await fetchHome();
        setState({ phase: "appointment-upcoming", session: withSavedAppointment(session, saved, true, home) });
      };
      const saveSummary = async (appointment: Appointment, summary: string) => {
        const saved = await setAppointmentSummary(appointment.id, summary);
        setState({ phase: "appointment-upcoming", session: withSavedAppointment(session, saved, true) });
      };
      return (
        <UpcomingAppointmentsScreen
          appointments={upcomingAppointments(session.appointments, new Date())}
          doctors={session.doctors}
          onSelectDoctor={selectDoctor}
          onEdit={editAppointment}
          onStatusChange={changeStatus}
          onSaveSummary={saveSummary}
          onBack={back}
        />
      );
    }
    case "appointment-history": {
      const { session } = state;
      const back = () => setState({ phase: "home", session });
      const selectDoctor = (doctor: Doctor) => setState({ phase: "doctor-detail", session, doctors: session.doctors, doctor });
      const editAppointment = (appointment: Appointment) =>
        setState({ phase: "appointment-form", session, appointment, returnTo: "appointment-history" });
      const changeStatus = async (appointment: Appointment, status: AppointmentStatus) => {
        const saved = await setAppointmentStatus(appointment.id, status);
        const home = await fetchHome();
        setState({ phase: "appointment-history", session: withSavedAppointment(session, saved, true, home) });
      };
      const saveSummary = async (appointment: Appointment, summary: string) => {
        const saved = await setAppointmentSummary(appointment.id, summary);
        setState({ phase: "appointment-history", session: withSavedAppointment(session, saved, true) });
      };
      return (
        <AppointmentHistoryScreen
          appointments={pastAppointments(session.appointments, new Date())}
          doctors={session.doctors}
          onSelectDoctor={selectDoctor}
          onEdit={editAppointment}
          onStatusChange={changeStatus}
          onSaveSummary={saveSummary}
          onBack={back}
        />
      );
    }
  }
}
