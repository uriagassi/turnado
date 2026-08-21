import { useTranslation } from "react-i18next";
import type { Appointment, Doctor, DocumentType, HomeData, MedicalDocument, Task } from "../api";
import { useRelativeDateTime } from "../hooks/useRelativeDateTime";
import { getTaskIcon } from "../tasks/taskUtils";
import { TaskStatusBadge } from "../components/TaskStatusBadge";

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

export function getDocumentIcon(type: DocumentType): string {
  switch (type) {
    case "test result":
      return "🩸";
    case "letter":
      return "✉️";
    case "referral":
      return "📋";
    case "appointment invitation":
      return "📎";
    case "Form 17":
      return "📄";
    case "approval":
      return "✅";
    case "other":
    default:
      return "📑";
  }
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
  onSelectDocument,
  onAddDocument,
  onViewDocuments,
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
  onSelectDocument?: (doc: MedicalDocument) => void;
  onAddDocument?: () => void;
  onViewDocuments?: () => void;
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
                      <TaskStatusBadge status={task.status} />
                      {pendingLabel && <span className="badge type-tag">{pendingLabel}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {home.recentDocuments.length > 0 && (
        <section className="recent-documents-section">
          <div className="section-header">
            <h2 className="section-title">{t("home.recentDocuments.title")}</h2>
            {onAddDocument && (
              <button type="button" className="btn-small btn-secondary" onClick={onAddDocument}>
                + {t("home.addDocument")}
              </button>
            )}
          </div>
          <div className="doc-strip">
            {home.recentDocuments.map((doc) => (
              <div
                className="doc-thumb clickable"
                key={doc.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelectDocument?.(doc)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectDocument?.(doc);
                  }
                }}
              >
                <div className="doc-icon" aria-hidden="true">
                  {getDocumentIcon(doc.type)}
                </div>
                <div className="doc-title">{doc.title}</div>
                <div className="doc-date">
                  {doc.documentDate ? formatRelative(doc.documentDate) : (doc.createdAt ? formatRelative(doc.createdAt) : "")}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {isEmpty && <p className="empty-state">{t("home.empty")}</p>}
      <nav className="home-nav">
        {onAddDocument && (
          <button type="button" className="home-nav-item" onClick={onAddDocument}>
            {t("home.addDocument")}
          </button>
        )}
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
        {onViewDocuments && (
          <button type="button" className="home-nav-item" onClick={onViewDocuments}>
            {t("home.viewDocuments")}
          </button>
        )}
      </nav>
    </main>
  );
}

