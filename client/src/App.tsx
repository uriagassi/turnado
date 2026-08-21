import { useCallback, useEffect, useRef, useState } from "react";
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
  fetchDocuments,
  fetchDocument,
  uploadDocument,
  AuthClientData,
  Appointment,
  AppointmentInput,
  AppointmentStatus,
  Doctor,
  DoctorInput,
  DocumentQueryFilter,
  DocumentType,
  HomeData,
  MedicalDocument,
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
import { DocumentFormScreen, getDocumentTypeForTask } from "./screens/DocumentFormScreen";
import { DocumentDetailScreen } from "./screens/DocumentDetailScreen";
import { DocumentsScreen, type DocumentFilters } from "./screens/DocumentsScreen";
import { ConfirmationModal } from "./components/ConfirmationModal";
import { NavBar, type NavDestination } from "./components/NavBar";

export type Session = {
  user: UserInfo;
  home: HomeData;
  doctors: Doctor[];
  appointments: Appointment[];
  tasks?: Task[];
  doctorDocuments?: Record<number, MedicalDocument[]>;
  taskDocuments?: Record<number, MedicalDocument[]>;
};

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

/**
 * Uploads the optional invitation letter attached in AppointmentFormScreen
 * as an "appointment invitation" document linked to the just-saved
 * appointment. The server derives the auto Form-17 task from that link
 * (see #8 / app.ts's linkInvitationToFormSeventeen) — this is only
 * responsible for getting the file there with the right link.
 */
async function uploadInvitation(appointment: Appointment, file: File): Promise<void> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("title", file.name.replace(/\.[^/.]+$/, ""));
  formData.append("type", "appointment invitation");
  if (appointment.doctorId) formData.append("doctorId", String(appointment.doctorId));
  formData.append("appointmentIds", JSON.stringify([appointment.id]));
  await uploadDocument(formData);
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

export type AppState =
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
    }
  | {
      phase: "document-form";
      session: Session;
      returnTo: "home" | "doctor-detail";
      doctor?: Doctor;
      initialDoctorId?: number;
      initialAppointmentId?: number;
      initialTaskId?: number;
      initialType?: DocumentType;
    }
  | {
      phase: "document-detail";
      session: Session;
      document: MedicalDocument;
      returnTo: "home" | "doctor-detail" | "documents";
      doctor?: Doctor;
      documentsFilters?: DocumentFilters;
    }
  | {
      phase: "documents";
      session: Session;
      documents: MedicalDocument[];
      filters: DocumentFilters;
      /** Every task regardless of status — unlike session.home.openItems (open-only), so a document's
          "linked to N items" badge can expand to the full detail even when a linked task is done. */
      allTasks: Task[];
    };

const EMPTY_DOCUMENT_FILTERS: DocumentFilters = { query: "", type: "", doctorId: "", dateFrom: "", dateTo: "" };

function documentFiltersToApiFilter(filters: DocumentFilters): DocumentQueryFilter {
  return {
    query: filters.query || undefined,
    type: filters.type || undefined,
    doctorId: filters.doctorId === "" ? undefined : filters.doctorId,
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
  };
}

/**
 * Fetches everything the "documents" phase needs and builds its state —
 * shared by navigateTo's own "documents" destination and document-detail's
 * back handler (returnTo === "documents"), which used to each duplicate
 * this fetch-both-then-setState shape with only the filters differing.
 */
async function loadDocumentsScreen(
  session: Session,
  filters: DocumentFilters,
): Promise<Extract<AppState, { phase: "documents" }>> {
  const [documents, allTasks] = await Promise.all([
    fetchDocuments(documentFiltersToApiFilter(filters)),
    fetchTasks(),
  ]);
  return { phase: "documents", session, documents, filters, allTasks };
}

/**
 * The title NavBar shows for the current screen (issue #27 AC: "showing at
 * least the current screen's title"). Drill-in phases show the nearest
 * top-level section's title (or, where the screen itself already headlines
 * a specific record — a doctor, task, or document — that record's own name)
 * rather than a bespoke title per phase.
 */
export function screenTitle(state: AppState, t: (key: string) => string): string {
  switch (state.phase) {
    case "loading":
    case "not-authorized":
    case "sign-in":
      return t("app.title");
    case "home":
      return t("home.title");
    case "doctors":
    case "doctor-form":
      return t("doctors.title");
    case "doctor-detail":
      return state.doctor.name;
    case "appointment-upcoming":
      return t("upcomingAppointments.title");
    case "appointment-history":
      return t("appointmentHistory.title");
    case "appointment-form":
      if (state.returnTo === "appointment-upcoming") return t("upcomingAppointments.title");
      if (state.returnTo === "appointment-history") return t("appointmentHistory.title");
      return t("home.title");
    case "task-detail":
      return state.task.title;
    case "task-form":
      return state.task ? t("taskForm.title.edit") : t("taskForm.title.new");
    case "document-form":
      return t("documentForm.title");
    case "document-detail":
      return state.document.title;
    case "documents":
      return t("documentsScreen.title");
  }
}

/**
 * The title bar's back control, used only as a fallback for when the
 * App()-level back-stack (see `backStack`/`goTo`/`goBack`) has nothing to
 * pop — i.e. the detail view being shown was just *created* by a form
 * (add doctor, upload document), so there's no prior screen on the stack to
 * retrace. In that case there's a fixed, correct answer regardless of stack
 * state: back to wherever that kind of record is created from. Whenever the
 * stack does have an entry, the render below prefers it over this, since it
 * reflects the screen the user actually came from (this function doesn't
 * know that — e.g. it always sends doctor-detail to the doctors list, which
 * is right after creating a doctor but wrong after drilling in from a
 * document, the exact bug the stack exists to fix).
 */
export function screenBack(state: AppState, setState: (s: AppState) => void): (() => void) | undefined {
  switch (state.phase) {
    case "doctor-detail": {
      const { session, doctors } = state;
      return () => setState({ phase: "doctors", session, doctors });
    }
    case "document-detail": {
      const { session, returnTo, doctor, documentsFilters } = state;
      return async () => {
        if (returnTo === "doctor-detail" && doctor) {
          setState({ phase: "doctor-detail", session, doctors: session.doctors, doctor });
        } else if (returnTo === "documents") {
          setState(await loadDocumentsScreen(session, documentsFilters ?? EMPTY_DOCUMENT_FILTERS));
        } else {
          setState({ phase: "home", session });
        }
      };
    }
    case "task-detail": {
      const { session, returnTo, doctor } = state;
      return () =>
        returnTo === "doctor-detail" && doctor
          ? setState({ phase: "doctor-detail", session, doctors: session.doctors, doctor })
          : setState({ phase: "home", session });
    }
    default:
      return undefined;
  }
}

/**
 * Re-stamps every backStack entry's session with a freshly-fetched home —
 * called wherever a background mutation (e.g. the "mark task as completed?"
 * prompt below) changes data that an already-pushed entry's snapshot no
 * longer reflects. Without this, "Back" happily restores that stale
 * snapshot instead of the fresh data (see screenBack's own doc comment on
 * why the stack is preferred over a fresh static fallback) — the exact bug
 * where confirming the prompt marked a task done, but Back still showed it
 * open because the backStack entry was frozen from before the confirm.
 */
export function refreshBackStackSessions(backStack: AppState[], home: HomeData): AppState[] {
  return backStack.map((entry) =>
    entry.phase === "loading" || entry.phase === "not-authorized" || entry.phase === "sign-in"
      ? entry
      : { ...entry, session: { ...entry.session, home } },
  );
}

/** How often the home screen's data refreshes itself in the background, absent a manual refresh or a window-focus event (see useAutoRefresh). */
const HOME_REFRESH_INTERVAL_MS = 45_000;

/** Delay before a documents-filter change re-fetches results — filters/chips still update instantly, this only smooths the network call so fast typing in the title-search field doesn't fire one request per keystroke. */
const DOCUMENTS_FILTER_DEBOUNCE_MS = 300;

export function App() {
  const { t } = useTranslation();
  const [state, setState] = useState<AppState>({ phase: "loading" });
  const [pendingTaskPrompt, setPendingTaskPrompt] = useState<{ taskId: number } | null>(null);
  const documentsFilterTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Chronological back-stack for the title bar's back arrow (issue #27
   * follow-up) — every screen actually visited on the way to the current
   * one, so "back" always retraces the real path (e.g. document → doctor →
   * back returns to that document), not a fixed per-record destination like
   * "doctor detail always goes back to the doctors list" (the bug this
   * replaced). Only pushed to at the specific "drill into a record's detail
   * view" call sites below (see goTo) — status changes, edits, and form
   * cancel/submit keep using plain setState and don't disturb it, so
   * returning from an edit still resumes wherever the stack already had.
   */
  const [backStack, setBackStack] = useState<AppState[]>([]);

  /** Drills into a detail view, remembering the screen being left so the title bar's back arrow can retrace it (see backStack above). */
  const goTo = (next: AppState) => {
    setBackStack((stack) => [...stack, state]);
    setState(next);
  };

  /** Pops the back-stack, if it has anything — used only as a fallback when it doesn't (see backOrFallback below in the render). */
  const goBack = () => {
    setBackStack((stack) => {
      if (stack.length === 0) return stack;
      setState(stack[stack.length - 1]);
      return stack.slice(0, -1);
    });
  };

  // Home screen auto-refreshes periodically while it's the active screen;
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

  // The nav drawer's destination handler (issue #27) — reachable from any
  // screen that has a session, jumping straight to a top-level section
  // rather than routing back through Home first. Doctors/Documents refetch
  // (matching openDoctors/viewDocuments below) so the list is current even
  // if it was never loaded on this visit; Home/Upcoming/History just switch
  // phase since their data already lives on the session.
  const navigateTo = async (destination: NavDestination) => {
    if (state.phase === "loading" || state.phase === "not-authorized" || state.phase === "sign-in") return;
    const { session } = state;
    // A drawer jump leaves whatever drill-down the user was in — the
    // back-stack it leaves behind is no longer relevant to where they're
    // going, so pressing back after a drawer jump shouldn't tunnel back
    // into it.
    setBackStack([]);
    switch (destination) {
      case "home":
        setState({ phase: "home", session });
        return;
      case "doctors": {
        const doctors = await fetchDoctors();
        setState({ phase: "doctors", session: { ...session, doctors }, doctors });
        return;
      }
      case "documents": {
        setState(await loadDocumentsScreen(session, EMPTY_DOCUMENT_FILTERS));
        return;
      }
      case "appointment-upcoming":
        setState({ phase: "appointment-upcoming", session });
        return;
      case "appointment-history":
        setState({ phase: "appointment-history", session });
        return;
    }
  };

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

  const renderScreen = () => {
    switch (state.phase) {
    case "loading":
      return <p className="status">{t("auth.loading")}</p>;
    case "not-authorized":
      return <NotAuthorizedScreen />;
    case "sign-in":
      return <SignInScreen authInfo={state.authInfo} />;
    case "home": {
      const { session } = state;
      const selectDoctor = (doctor: Doctor) => goTo({ phase: "doctor-detail", session, doctors: session.doctors, doctor });
      const addAppointment = () => setState({ phase: "appointment-form", session, returnTo: "home" });
      const addTask = () => setState({ phase: "task-form", session, returnTo: "home" });
      const selectTask = async (task: Task) => {
        const docs = await fetchDocuments({ taskId: task.id });
        const taskDocuments = { ...session.taskDocuments, [task.id]: docs };
        goTo({ phase: "task-detail", session: { ...session, taskDocuments }, task, returnTo: "home" });
      };
      const addDocument = () => setState({ phase: "document-form", session, returnTo: "home" });
      const selectDocument = (doc: MedicalDocument) =>
        goTo({ phase: "document-detail", session, document: doc, returnTo: "home" });
      return (
        <HomeScreen
          home={session.home}
          doctors={session.doctors}
          appointments={session.appointments}
          onSelectDoctor={selectDoctor}
          onAddAppointment={addAppointment}
          onSelectTask={selectTask}
          onAddTask={addTask}
          onAddDocument={addDocument}
          onSelectDocument={selectDocument}
          onRefresh={refreshHome}
        />
      );
    }
    case "doctors": {
      const { session, doctors } = state;
      const selectDoctor = async (doctor: Doctor) => {
        const docs = await fetchDocuments({ doctorId: doctor.id });
        const doctorDocuments = { ...session.doctorDocuments, [doctor.id]: docs };
        goTo({
          phase: "doctor-detail",
          session: { ...session, doctorDocuments },
          doctors,
          doctor,
        });
      };
      const addDoctor = () => setState({ phase: "doctor-form", session, doctors });
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
        />
      );
    }
    case "doctor-detail": {
      const { session, doctors, doctor } = state;
      const edit = () => setState({ phase: "doctor-form", session, doctors, doctor });
      const appointments = upcomingAppointmentsForDoctor(session.appointments, doctor.id, new Date());
      const doctorOpenItems = openItemsForDoctor(session.home.openItems, doctor.id);
      const doctorDocs = session.doctorDocuments?.[doctor.id] ?? [];
      const selectTask = async (task: Task) => {
        const docs = await fetchDocuments({ taskId: task.id });
        const taskDocuments = { ...session.taskDocuments, [task.id]: docs };
        goTo({ phase: "task-detail", session: { ...session, taskDocuments }, task, returnTo: "doctor-detail", doctor });
      };
      const selectDocument = (doc: MedicalDocument) =>
        goTo({ phase: "document-detail", session, document: doc, returnTo: "doctor-detail", doctor });
      return (
        <DoctorDetailScreen
          doctor={doctor}
          appointments={appointments}
          openItems={doctorOpenItems}
          documents={doctorDocs}
          onEdit={edit}
          onSelectTask={selectTask}
          onSelectDocument={selectDocument}
        />
      );
    }
    case "document-form": {
      const { session, returnTo, doctor, initialDoctorId, initialAppointmentId, initialTaskId, initialType } = state;
      const cancel = () => {
        if (returnTo === "doctor-detail" && doctor) {
          setState({ phase: "doctor-detail", session, doctors: session.doctors, doctor });
        } else {
          setState({ phase: "home", session });
        }
      };
      const submit = async (formData: FormData) => {
        const saved = await uploadDocument(formData);
        const targetTaskId =
          initialTaskId ||
          (formData.get("taskIds") ? JSON.parse(formData.get("taskIds") as string)[0] : undefined);
        const home = await fetchHome();
        const nextSession = { ...session, home };
        setState({ phase: "document-detail", session: nextSession, document: saved, returnTo, doctor });
        if (targetTaskId) {
          setPendingTaskPrompt({ taskId: targetTaskId });
        }
      };
      return (
        <DocumentFormScreen
          doctors={session.doctors}
          appointments={session.appointments}
          openItems={session.home.openItems}
          initialDoctorId={initialDoctorId ?? doctor?.id}
          initialAppointmentId={initialAppointmentId}
          initialTaskId={initialTaskId}
          initialType={initialType}
          onSubmit={submit}
          onCancel={cancel}
        />
      );
    }
    case "document-detail": {
      const { session, document } = state;
      const selectDoctor = (d: Doctor) =>
        goTo({ phase: "doctor-detail", session, doctors: session.doctors, doctor: d });
      const selectAppointment = (appt: Appointment) =>
        setState({ phase: "appointment-form", session, appointment: appt, returnTo: "home" });
      const selectTask = (t: Task) =>
        goTo({ phase: "task-detail", session, task: t, returnTo: "home" });
      return (
        <DocumentDetailScreen
          document={document}
          doctors={session.doctors}
          appointments={session.appointments}
          openItems={session.home.openItems}
          onSelectDoctor={selectDoctor}
          onSelectAppointment={selectAppointment}
          onSelectTask={selectTask}
        />
      );
    }
    case "documents": {
      const { session, documents, filters, allTasks } = state;
      const changeFilters = (nextFilters: DocumentFilters) => {
        // Filters/chips update immediately (AC: live, no apply step); only the
        // results re-fetch is debounced, so fast typing in the search box
        // doesn't fire one request per keystroke.
        setState({ phase: "documents", session, documents, filters: nextFilters, allTasks });
        if (documentsFilterTimer.current) clearTimeout(documentsFilterTimer.current);
        documentsFilterTimer.current = setTimeout(async () => {
          const nextDocuments = await fetchDocuments(documentFiltersToApiFilter(nextFilters));
          setState((prev) => (prev.phase === "documents" ? { ...prev, documents: nextDocuments } : prev));
        }, DOCUMENTS_FILTER_DEBOUNCE_MS);
      };
      const selectDocument = (doc: MedicalDocument) =>
        goTo({ phase: "document-detail", session, document: doc, returnTo: "documents", documentsFilters: filters });
      return (
        <DocumentsScreen
          documents={documents}
          doctors={session.doctors}
          appointments={session.appointments}
          openItems={allTasks}
          filters={filters}
          onFiltersChange={changeFilters}
          onSelectDocument={selectDocument}
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
        const nextDoctors = withSavedDoctor(session.doctors, doctor !== undefined, saved);
        const nextSession = { ...session, doctors: nextDoctors };
        setState({ phase: "doctor-detail", session: nextSession, doctors: nextDoctors, doctor: saved });
      };
      return <DoctorFormScreen doctor={doctor} onSubmit={submit} onCancel={cancel} />;
    }
    case "appointment-form": {
      const { session, appointment, returnTo, resolvingTaskId } = state;
      const cancel = () => setState({ phase: returnTo, session });
      const submit = async (input: AppointmentInput, invitationFile: File | null) => {
        const saved = appointment?.id ? await updateAppointment(appointment.id, input) : await createAppointment(input);
        if (invitationFile) {
          await uploadInvitation(saved, invitationFile);
        }
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
      const edit = (t: Task) =>
        setState({ phase: "task-form", session, task: t, returnTo: "task-detail", doctor });
      const changeStatus = async (t: Task, status: TaskStatus) => {
        const updated = await setTaskStatus(t.id, status);
        const home = await fetchHome();
        const nextSession = { ...session, home };
        setState({ phase: "task-detail", session: nextSession, task: updated, returnTo, doctor });
      };
      const selectDocument = (doc: MedicalDocument) =>
        goTo({
          phase: "document-detail",
          session,
          document: doc,
          returnTo: returnTo === "doctor-detail" ? "doctor-detail" : "home",
          doctor,
        });
      const addDocument = (t: Task) => {
        const defaultApptId = t.pendingAppointmentId ?? t.sourceAppointmentId ?? undefined;
        const defaultDoctorId =
          t.doctorId ??
          (defaultApptId ? session.appointments.find((a) => a.id === defaultApptId)?.doctorId : undefined) ??
          undefined;
        const defaultType = getDocumentTypeForTask(t.type);
        setState({
          phase: "document-form",
          session,
          returnTo: returnTo === "doctor-detail" ? "doctor-detail" : "home",
          initialTaskId: t.id,
          initialAppointmentId: defaultApptId,
          initialDoctorId: defaultDoctorId,
          initialType: defaultType,
          doctor,
        });
      };
      const taskDocs = session.taskDocuments?.[task.id] ?? [];
      return (
        <TaskDetailScreen
          task={task}
          doctors={session.doctors}
          appointments={session.appointments}
          documents={taskDocs}
          onEdit={edit}
          onStatusChange={changeStatus}
          onResolveToAppointment={(t) => navigateToResolveAppointment(session, t)}
          onAddDocument={addDocument}
          onSelectDocument={selectDocument}
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
      const selectDoctor = (doctor: Doctor) => goTo({ phase: "doctor-detail", session, doctors: session.doctors, doctor });
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
        />
      );
    }
    case "appointment-history": {
      const { session } = state;
      const selectDoctor = (doctor: Doctor) => goTo({ phase: "doctor-detail", session, doctors: session.doctors, doctor });
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
        />
      );
    }
  }
};

  const showNavBar = state.phase !== "loading" && state.phase !== "not-authorized" && state.phase !== "sign-in";
  // screenBack(...) is non-undefined only on the 3 detail phases that ever
  // get a back control at all — reused here as that check, so the stack
  // isn't offered as "back" on a phase that shouldn't show one even if
  // something left stale entries in it (e.g. see navigateTo's own comment).
  const staticBack = screenBack(state, setState);
  const onBack = staticBack && backStack.length > 0 ? goBack : staticBack;

  return (
    <>
      {showNavBar && <NavBar title={screenTitle(state, t)} onNavigate={navigateTo} onBack={onBack} />}
      {renderScreen()}
      {pendingTaskPrompt && (
        <ConfirmationModal
          title={t("documentForm.closeTaskModal.title")}
          message={t("documentForm.closeTaskModal.message")}
          confirmLabel={t("documentForm.closeTaskModal.confirm")}
          cancelLabel={t("documentForm.closeTaskModal.cancel")}
          onConfirm={async () => {
            const id = pendingTaskPrompt.taskId;
            setPendingTaskPrompt(null);
            await setTaskStatus(id, "done");
            const home = await fetchHome();
            setState((prev) =>
              prev.phase !== "loading" && prev.phase !== "not-authorized" && prev.phase !== "sign-in"
                ? { ...prev, session: { ...prev.session, home } }
                : prev,
            );
            // Also refreshes any backStack entries' own session — "Back"
            // prefers the stack over a fresh static fallback (see
            // screenBack's doc comment), so without this it would restore
            // whatever snapshot was pushed *before* this task closed.
            setBackStack((stack) => refreshBackStackSessions(stack, home));
          }}
          onCancel={() => setPendingTaskPrompt(null)}
        />
      )}
    </>
  );
}
