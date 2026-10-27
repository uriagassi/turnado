import { useState, type MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import type { Appointment, Doctor, DocumentType, HomeData, MedicalDocument, Task } from "../api";
import { calendarDay } from "../formatDateTime";
import { useRelativeDate } from "../hooks/useRelativeDate";
import { useRelativeDateTime } from "../hooks/useRelativeDateTime";
import { getTaskIcon } from "../tasks/taskUtils";
import { TaskStatusBadge } from "../components/TaskStatusBadge";
import { MissedReminderBadge } from "../components/MissedReminderBadge";
import { SimilarTaskBadge } from "../components/SimilarTaskBadge";
import { celebrateAfter } from "../celebration/celebrate";

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
  onSelectAppointment,
  onAddAppointment,
  onSeeAllUpcoming,
  onSelectTask,
  onMarkTaskDone,
  onAddTask,
  onSelectDocument,
  onAddDocument,
  onRefresh,
}: {
  home: HomeData;
  doctors: Doctor[];
  appointments?: Appointment[];
  /** Opens the appointment detail from the hero card (issue #68). */
  onSelectAppointment: (appointment: Appointment) => void;
  onAddAppointment: () => void;
  /** Opens the upcoming-appointments screen from the hero (issue #71). */
  onSeeAllUpcoming: () => void;
  onSelectTask?: (task: Task) => void;
  /** The row's own "mark done" action — celebrates (issue #13) once the returned save resolves. */
  onMarkTaskDone?: (task: Task) => void | Promise<void>;
  onAddTask?: () => void;
  onSelectDocument?: (doc: MedicalDocument) => void;
  onAddDocument?: () => void;
  onRefresh: () => void;
}) {
  const { t } = useTranslation();
  const formatRelative = useRelativeDateTime();
  const formatRelativeDay = useRelativeDate();
  const sortedOpenItems = sortOpenItems(home.openItems, appointments);
  // Tasks whose ✓ was tapped, keyed to the `home` snapshot they were
  // tapped on. The row stays on screen until home re-fetches (after the
  // save resolves), so without this a double-tap would save — and
  // celebrate — twice. A fresh `home` retires every entry on its own: a
  // done task has dropped out of it, and a reopened one is tappable again.
  const [markedOn, setMarkedOn] = useState<ReadonlyMap<number, HomeData>>(new Map());
  const isMarking = (task: Task) => markedOn.get(task.id) === home;

  function markDone(task: Task, button: HTMLButtonElement, event: MouseEvent) {
    if (!onMarkTaskDone || isMarking(task)) return;
    setMarkedOn((marked) => new Map(marked).set(task.id, home));
    void celebrateAfter(button, event, () => onMarkTaskDone(task)).catch((err: unknown) => {
      setMarkedOn((marked) => {
        const next = new Map(marked);
        next.delete(task.id);
        return next;
      });
      throw err;
    });
  }
  const openHeroAppointment = () => {
    if (home.nextAppointment) onSelectAppointment(home.nextAppointment);
  };
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
    const effectiveDate = task.dueDate || (appt && calendarDay(new Date(appt.dateTime)));
    if (effectiveDate) return t("task.due.target", { date: formatRelativeDay(effectiveDate) });
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
      {/*
        Every section below always renders — header (title + its own "+ Add"
        button) plus either its content or an empty-state line — the same
        shape DoctorDetailScreen's Appointments/Open items/Documents
        sections already use. Each section is now the one and only place to
        add that kind of record: the bottom-of-page nav row this replaced
        duplicated these same three actions once a section had content, and
        gave no way to add the *first* item when a section was still empty
        (issue #27 follow-up).
      */}
      <section className="hero-card-section">
        <div className="section-header">
          <h2 className="section-title">{t("home.hero.title")}</h2>
          <button type="button" className="btn-small btn-secondary" onClick={onAddAppointment}>
            + {t("home.addAppointment")}
          </button>
        </div>
        {home.nextAppointment ? (
          // Single-column, phone-legible; whole card opens the appointment (issue #68).
          <div
            className="hero-card clickable"
            role="button"
            tabIndex={0}
            onClick={openHeroAppointment}
            onKeyDown={(e) => {
              if (e.target !== e.currentTarget) return;
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openHeroAppointment();
              }
            }}
          >
            {heroDoctor && (
              <p className="hero-doctor-line">
                <span>{heroDoctor.name}</span>
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
            {home.nextAppointment.missedReminder && <MissedReminderBadge reason={home.nextAppointment.missedReminder} />}
          </div>
        ) : (
          <p className="section-empty">{t("home.hero.empty")}</p>
        )}
        <button type="button" className="btn-small btn-secondary hero-see-all" onClick={onSeeAllUpcoming}>
          {t("home.hero.seeAll")}
        </button>
      </section>

      <section className="open-items-section">
        <div className="section-header">
          <h2 className="section-title">{t("home.openItems.title")}</h2>
          {onAddTask && (
            <button type="button" className="btn-small btn-secondary" onClick={onAddTask}>
              + {t("home.addTask")}
            </button>
          )}
        </div>
        {home.openItems.length > 0 ? (
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
                      {task.missedReminder && <MissedReminderBadge reason={task.missedReminder} />}
                      {task.similarTaskIds.length > 0 && <SimilarTaskBadge />}
                    </div>
                  </div>
                  {onMarkTaskDone && (
                    <button
                      type="button"
                      className="feed-done"
                      aria-label={t("home.openItems.markDone", { title: task.title })}
                      // A control nested inside the row's own role="button":
                      // stop both click and Enter/Space from also opening the task.
                      // aria-disabled rather than disabled: a tap on a disabled
                      // button can fall through to the row and open the task.
                      aria-disabled={isMarking(task)}
                      onClick={(e) => {
                        e.stopPropagation();
                        markDone(task, e.currentTarget, e);
                      }}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      ✓
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="section-empty">{t("home.openItems.empty")}</p>
        )}
      </section>

      <section className="recent-documents-section">
        <div className="section-header">
          <h2 className="section-title">{t("home.recentDocuments.title")}</h2>
          {onAddDocument && (
            <button type="button" className="btn-small btn-secondary" onClick={onAddDocument}>
              + {t("home.addDocument")}
            </button>
          )}
        </div>
        {home.recentDocuments.length > 0 ? (
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
                  {doc.documentDate ? formatRelativeDay(doc.documentDate) : (doc.createdAt ? formatRelative(doc.createdAt) : "")}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="section-empty">{t("home.recentDocuments.empty")}</p>
        )}
      </section>
    </main>
  );
}

