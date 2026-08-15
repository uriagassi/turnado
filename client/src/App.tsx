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
  fetchTasks,
  createTask,
  updateTask,
  setTaskStatus,
  setTaskPendingAppointment,
  AuthClientData,
  Appointment,
  AppointmentInput,
  AppointmentStatus,
  Doctor,
  DoctorInput,
  HomeData,
  Task,
  TaskInput,
  TaskStatus,
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
import { TaskFormScreen } from "./screens/TaskFormScreen";
import { TaskDetailScreen } from "./screens/TaskDetailScreen";

type Session = { user: UserInfo; home: HomeData; doctors: Doctor[]; appointments: Appointment[]; tasks?: Task[] };

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
 * Every still-upcoming planned appointment for one doctor, soonest first —
 * the client-side counterpart of the server's selectUpcomingAppointments
 * (see server/src/appointments/heroAppointment.ts), scoped to a single
 * doctorId for the doctor detail view's Appointments section. Bounded to
 * upcoming (not the doctor's full history) so the section can't grow
 * unboundedly long for a doctor seen for years.
 */
function upcomingAppointmentsForDoctor(appointments: Appointment[], doctorId: number, now: Date): Appointment[] {
  return appointments
    .filter((a) => a.doctorId === doctorId && a.status === "planned" && new Date(a.dateTime) >= now)
    .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
}

/**
 * The soonest still-upcoming planned appointment for one doctor — just the
 * first entry of upcomingAppointmentsForDoctor, for previews (the doctors
 * list's "next appointment" row) where only the soonest one matters.
 */
function nextAppointmentForDoctor(appointments: Appointment[], doctorId: number, now: Date): Appointment | undefined {
  return upcomingAppointmentsForDoctor(appointments, doctorId, now)[0];
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

function openItemsForDoctor(openItems: Task[], doctorId: number): Task[] {
  return openItems.filter((t) => t.doctorId === doctorId && t.status !== "done");
}

/**
 * Orders doctors by their soonest upcoming appointment (ascending) rather
 * than the list's base name order — a doctor you're about to see should
 * surface above one you have no appointment with. Doctors with no upcoming
 * appointment sort after every doctor who has one, and fall back to name
 * order among themselves so the tail of the list stays stable and matches
 * how it read before this sort existed.
 */
function sortDoctorsByNextAppointment(doctors: Doctor[], nextAppointments: Map<number, Appointment | undefined>): Doctor[] {
  return [...doctors].sort((a, b) => {
    const aNext = nextAppointments.get(a.id);
    const bNext = nextAppointments.get(b.id);
    if (aNext && bNext) return new Date(aNext.dateTime).getTime() - new Date(bNext.dateTime).getTime();
    if (aNext) return -1;
    if (bNext) return 1;
    return a.name.localeCompare(b.name);
  });
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
  | {
      phase: "appointment-form";
      session: Session;
      appointment?: Appointment | (Partial<AppointmentInput> & { id?: number });
      returnTo: "home" | "appointment-upcoming" | "appointment-history";
      resolvingTaskId?: number;
    }
  | { phase: "appointment-upcoming"; session: Session }
  | { phase: "appointment-history"; session: Session }
  | {
      phase: "task-detail";
      session: Session;
      task: Task;
      returnTo: "home" | "doctor-detail";
      doctor?: Doctor;
    }
  | {
      phase: "task-form";
      session: Session;
      task?: Task;
      returnTo: "home" | "doctor-detail" | "task-detail";
      doctor?: Doctor;
    };

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

  const navigateToResolveAppointment = (session: Session, t: Task) => {
    setState({
      phase: "appointment-form",
      session,
      appointment: {
        doctorId: t.doctorId,
        notes: t.title,
        dateTime: "",
        location: "",
      },
      resolvingTaskId: t.id,
      returnTo: "home",
    });
  };

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
      const addTask = () => setState({ phase: "task-form", session, returnTo: "home" });
      const selectTask = (task: Task) => setState({ phase: "task-detail", session, task, returnTo: "home" });
      return (
        <HomeScreen
          home={session.home}
          doctors={session.doctors}
          appointments={session.appointments}
          onOpenDoctors={openDoctors}
          onSelectDoctor={selectDoctor}
          onAddAppointment={addAppointment}
          onViewUpcoming={viewUpcoming}
          onViewHistory={viewHistory}
          onSelectTask={selectTask}
          onAddTask={addTask}
          onRefresh={refreshHome}
        />
      );
    }
    case "doctors": {
      const { session, doctors } = state;
      const selectDoctor = (doctor: Doctor) => setState({ phase: "doctor-detail", session, doctors, doctor });
      const addDoctor = () => setState({ phase: "doctor-form", session, doctors });
      const backHome = () => setState({ phase: "home", session });
      // Same nextAppointmentForDoctor used by doctor-detail, just precomputed
      // per doctor for the list's own "next appointment" preview (see
      // DoctorsScreen — matches the prototype's directory-row preview).
      const now = new Date();
      const nextAppointments = new Map(doctors.map((d) => [d.id, nextAppointmentForDoctor(session.appointments, d.id, now)]));
      return (
        <DoctorsScreen
          doctors={sortDoctorsByNextAppointment(doctors, nextAppointments)}
          nextAppointments={nextAppointments}
          onSelectDoctor={selectDoctor}
          onAddDoctor={addDoctor}
          onBackHome={backHome}
        />
      );
    }
    case "doctor-detail": {
      const { session, doctors, doctor } = state;
      const back = () => setState({ phase: "doctors", session, doctors });
      const edit = () => setState({ phase: "doctor-form", session, doctors, doctor });
      const appointments = upcomingAppointmentsForDoctor(session.appointments, doctor.id, new Date());
      const doctorOpenItems = openItemsForDoctor(session.home.openItems, doctor.id);
      const selectTask = (task: Task) => setState({ phase: "task-detail", session, task, returnTo: "doctor-detail", doctor });
      return (
        <DoctorDetailScreen
          doctor={doctor}
          appointments={appointments}
          openItems={doctorOpenItems}
          onBack={back}
          onEdit={edit}
          onSelectTask={selectTask}
        />
      );
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
      const { session, appointment, returnTo, resolvingTaskId } = state;
      const cancel = () => setState({ phase: returnTo, session });
      const submit = async (input: AppointmentInput) => {
        const saved = appointment?.id ? await updateAppointment(appointment.id, input) : await createAppointment(input);
        if (resolvingTaskId) {
          await setTaskPendingAppointment(resolvingTaskId, saved.id);
        }
        // Also re-fetches home, not just folding `saved` into the
        // appointments list — home.nextAppointment is computed server-side
        // (selectHeroAppointment) and a created/edited appointment can
        // become (or stop being) that hero card, which the fold alone
        // wouldn't reflect.
        const home = await fetchHome();
        const appointments = await fetchAppointments();
        setState({ phase: returnTo, session: { ...session, appointments, home } });
      };
      return <AppointmentFormScreen appointment={appointment as Appointment | undefined} doctors={session.doctors} onSubmit={submit} onCancel={cancel} />;
    }
    case "task-detail": {
      const { session, task, returnTo, doctor } = state;
      const back = () =>
        returnTo === "doctor-detail" && doctor
          ? setState({ phase: "doctor-detail", session, doctors: session.doctors, doctor })
          : setState({ phase: "home", session });
      const edit = (t: Task) =>
        setState({ phase: "task-form", session, task: t, returnTo: "task-detail", doctor });
      const changeStatus = async (t: Task, status: TaskStatus) => {
        const updated = await setTaskStatus(t.id, status);
        const home = await fetchHome();
        const nextSession = { ...session, home };
        setState({ phase: "task-detail", session: nextSession, task: updated, returnTo, doctor });
      };
      return (
        <TaskDetailScreen
          task={task}
          doctors={session.doctors}
          appointments={session.appointments}
          onBack={back}
          onEdit={edit}
          onStatusChange={changeStatus}
          onResolveToAppointment={(t) => navigateToResolveAppointment(session, t)}
        />
      );
    }
    case "task-form": {
      const { session, task, returnTo, doctor } = state;
      const cancel = () => {
        if (returnTo === "task-detail" && task) {
          setState({ phase: "task-detail", session, task, returnTo: doctor ? "doctor-detail" : "home", doctor });
        } else if (returnTo === "doctor-detail" && doctor) {
          setState({ phase: "doctor-detail", session, doctors: session.doctors, doctor });
        } else {
          setState({ phase: "home", session });
        }
      };
      const submit = async (input: TaskInput) => {
        const saved = task ? await updateTask(task.id, input) : await createTask(input);
        const home = await fetchHome();
        const nextSession = { ...session, home };
        if (returnTo === "task-detail") {
          setState({ phase: "task-detail", session: nextSession, task: saved, returnTo: doctor ? "doctor-detail" : "home", doctor });
        } else if (returnTo === "doctor-detail" && doctor) {
          setState({ phase: "doctor-detail", session: nextSession, doctors: session.doctors, doctor });
        } else {
          setState({ phase: "home", session: nextSession });
        }
      };
      return (
        <TaskFormScreen
          task={task}
          doctors={session.doctors}
          onSubmit={submit}
          onCancel={cancel}
          onResolveToAppointment={(t) => navigateToResolveAppointment(session, t)}
        />
      );
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
