import { useTranslation } from "react-i18next";
import type { Appointment, Doctor, HomeData, Task, TaskType } from "../api";
import { useRelativeDateTime } from "../hooks/useRelativeDateTime";

function getTaskIcon(type: TaskType): string {
  switch (type) {
    case "test":
      return "🩸";
    case "doctor_visit":
      return "🩺";
    case "form_17":
      return "📄";
    case "general_approval":
      return "✅";
    default:
      return "📌";
  }
}

function sortOpenItems(tasks: Task[], appointments: Appointment[] = []): Task[] {
  return [...tasks].sort((a, b) => {
    const aAppt = a.pendingAppointmentId ? appointments.find((x) => x.id === a.pendingAppointmentId) : undefined;
    const bAppt = b.pendingAppointmentId ? appointments.find((x) => x.id === b.pendingAppointmentId) : undefined;
    const aDate = a.dueDate || aAppt?.dateTime.slice(0, 10);
    const bDate = b.dueDate || bAppt?.dateTime.slice(0, 10);
    const aHasDate = Boolean(aDate);
    const bHasDate = Boolean(bDate);
    if (!aHasDate && !bHasDate) return a.id - b.id;
    if (!aHasDate) return -1;
    if (!bHasDate) return 1;
    return new Date(aDate!).getTime() - new Date(bDate!).getTime();
  });
}

export function HomeScreen({
  home,
  doctors,
  appointments = [],
  onOpenDoctors,
  onSelectDoctor,
  onAddAppointment,
  onViewUpcoming,
  onViewHistory,
  onSelectTask,
  onAddTask,
  onRefresh,
}: {
  home: HomeData;
  doctors: Doctor[];
  appointments?: Appointment[];
  onOpenDoctors: () => void;
  /** Follows the doctor-name link on the hero card into that doctor's detail view (see issue #4 AC). */
  onSelectDoctor: (doctor: Doctor) => void;
  onAddAppointment: () => void;
  onViewUpcoming: () => void;
  onViewHistory: () => void;
  onSelectTask?: (task: Task) => void;
  onAddTask?: () => void;
  onRefresh: () => void;
}) {
  const { t } = useTranslation();
  const formatRelative = useRelativeDateTime();
  const sortedOpenItems = sortOpenItems(home.openItems, appointments);
  const isEmpty = !home.nextAppointment && home.openItems.length === 0 && home.recentDocuments.length === 0;
  const heroDoctor = home.nextAppointment?.doctorId
    ? doctors.find((d) => d.id === home.nextAppointment?.doctorId)
    : undefined;

  function getPendingAppointmentLabel(pendingAppointmentId: number | null): string | null {
    if (!pendingAppointmentId) return null;
    const appt = appointments.find((a) => a.id === pendingAppointmentId);
    if (!appt) return t("task.pendingAppointmentGeneral");
    const doc = appt.doctorId ? doctors.find((d) => d.id === appt.doctorId) : undefined;
    return doc
      ? t("task.pendingAppointmentTag", { doctor: doc.name })
      : t("task.pendingAppointmentTag", { doctor: appt.notes });
  }

  function formatTaskDue(task: Task): string {
    const appt = task.pendingAppointmentId ? appointments.find((a) => a.id === task.pendingAppointmentId) : undefined;
    const effectiveDate = task.dueDate || appt?.dateTime.slice(0, 10);
    if (effectiveDate) return t("task.due.target", { date: formatRelative(effectiveDate) });
    if (task.approximateDateWindow) return task.approximateDateWindow;
    return t("task.due.noDate");
  }

  return (
    <main className="screen home-screen">
      <div className="home-header">
        <h1>{t("home.title")}</h1>
        <button type="button" className="refresh-home" onClick={onRefresh}>
          {t("home.refresh")}
        </button>
      </div>
      {home.nextAppointment && (
        // Single-column, phone-legible per the AC — no side-by-side layout
        // to squeeze on a narrow viewport. Structure follows the winning
        // hero-card prototype (05-home-screen.html, variant A): a label,
        // then doctor + specialty on one line, then a date/location meta
        // line — see medical/.scratch/medical-app-spec/prototypes.
        <section className="hero-card">
          <h2>{t("home.hero.title")}</h2>
          {heroDoctor && (
            <p className="hero-doctor-line">
              <button type="button" className="hero-doctor-link" onClick={() => onSelectDoctor(heroDoctor)}>
                {heroDoctor.name}
              </button>
              {heroDoctor.specialty && <span className="hero-specialty"> — {heroDoctor.specialty}</span>}
            </p>
          )}
          <p className="hero-date">
            {/* "Tomorrow, 10:00 AM" while the appointment is near, matching
                the prototype's "מחר" treatment — see useRelativeDateTime. */}
            {formatRelative(home.nextAppointment.dateTime)}
            {home.nextAppointment.location ? ` · ${home.nextAppointment.location}` : ""}
          </p>
          <p className="hero-notes">{home.nextAppointment.notes}</p>
        </section>
      )}

      {home.openItems.length > 0 && (
        <section className="open-items-section">
          <div className="section-header">
            <h2 className="section-title">{t("home.openItems.title")}</h2>
            {onAddTask && (
              <button type="button" className="btn-small btn-secondary" onClick={onAddTask}>
                + {t("home.addTask")}
              </button>
            )}
          </div>
          <div className="feed">
            {sortedOpenItems.map((task) => {
              const pendingLabel = getPendingAppointmentLabel(task.pendingAppointmentId);
              const statusClass =
                task.status === "in-progress"
                  ? "badge status-inprogress"
                  : task.status === "done"
                  ? "badge status-done"
                  : "badge status-open";

              return (
                <div
                  className="card feed-row clickable"
                  key={task.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectTask?.(task)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelectTask?.(task);
                    }
                  }}
                >
                  <div className="feed-icon" aria-hidden="true">
                    {getTaskIcon(task.type)}
                  </div>
                  <div className="feed-body">
                    <div className="feed-top">
                      <span className="feed-name">{task.title}</span>
                      <span className="feed-when">{formatTaskDue(task)}</span>
                    </div>
                    <div className="feed-meta">
                      <span className={statusClass}>
                        {task.status === "in-progress"
                          ? t("task.status.inprogress")
                          : task.status === "done"
                          ? t("task.status.done")
                          : t("task.status.open")}
                      </span>
                      {pendingLabel && <span className="badge type-tag">{pendingLabel}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {isEmpty && <p className="empty-state">{t("home.empty")}</p>}
      <nav className="home-nav">
        {onAddTask && (
          <button type="button" className="home-nav-item" onClick={onAddTask}>
            {t("home.addTask")}
          </button>
        )}
        <button type="button" className="home-nav-item" onClick={onAddAppointment}>
          {t("home.addAppointment")}
        </button>
        <button type="button" className="home-nav-item" onClick={onOpenDoctors}>
          {t("doctors.title")}
        </button>
        <button type="button" className="home-nav-item" onClick={onViewUpcoming}>
          {t("home.viewUpcoming")}
        </button>
        <button type="button" className="home-nav-item" onClick={onViewHistory}>
          {t("home.viewHistory")}
        </button>
      </nav>
    </main>
  );
}

