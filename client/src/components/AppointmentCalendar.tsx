import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Appointment, AppointmentStatus, Doctor } from "../api";
import { AppointmentCard } from "./AppointmentCard";
import { buildMonthGrid } from "../utils/monthGrid";

// A known Sunday, used only to derive localized weekday header labels — its
// own date is irrelevant, only its day-of-week offsets from Sunday matter.
const WEEKDAY_REFERENCE_SUNDAY = new Date(2023, 0, 1);

/**
 * Month-grid alternative to the plain appointment list (issue #22) — a
 * Sunday-first calendar with a marker on any day that has appointments;
 * selecting a day surfaces that day's appointments below the grid, reusing
 * AppointmentCard so a row looks and behaves the same as it does in the
 * list view (same edit/status/summary controls, same Details hand-off).
 */
export function AppointmentCalendar({
  appointments,
  doctors,
  onEdit,
  onStatusChange,
  onSaveSummary,
  onSelect,
  now = new Date(),
}: {
  appointments: Appointment[];
  doctors: Doctor[];
  onEdit: (appointment: Appointment) => void;
  onStatusChange: (appointment: Appointment, status: AppointmentStatus) => void;
  onSaveSummary: (appointment: Appointment, summary: string) => void;
  onSelect?: (appointment: Appointment) => void;
  now?: Date;
}) {
  const { t, i18n } = useTranslation();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const grid = useMemo(() => buildMonthGrid(year, month, appointments), [year, month, appointments]);

  const weekdayLabels = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(i18n.language, { weekday: "short" });
    return Array.from({ length: 7 }, (_, i) => {
      const reference = new Date(WEEKDAY_REFERENCE_SUNDAY);
      reference.setDate(reference.getDate() + i);
      return formatter.format(reference);
    });
  }, [i18n.language]);

  const monthLabel = useMemo(
    () => new Intl.DateTimeFormat(i18n.language, { month: "long", year: "numeric" }).format(new Date(year, month, 1)),
    [i18n.language, year, month],
  );

  const goToPreviousMonth = () => {
    setSelectedDay(null);
    if (month === 0) {
      setYear(year - 1);
      setMonth(11);
    } else {
      setMonth(month - 1);
    }
  };

  const goToNextMonth = () => {
    setSelectedDay(null);
    if (month === 11) {
      setYear(year + 1);
      setMonth(0);
    } else {
      setMonth(month + 1);
    }
  };

  const selectedAppointments = grid.find((cell) => cell.dateKey === selectedDay)?.appointments ?? [];

  return (
    <div className="appointment-calendar">
      <div className="calendar-nav">
        <button
          type="button"
          className="btn-small btn-secondary calendar-nav-button"
          aria-label={t("appointmentCalendar.previousMonth")}
          onClick={goToPreviousMonth}
        >
          ‹
        </button>
        <span className="calendar-month-label">{monthLabel}</span>
        <button
          type="button"
          className="btn-small btn-secondary calendar-nav-button"
          aria-label={t("appointmentCalendar.nextMonth")}
          onClick={goToNextMonth}
        >
          ›
        </button>
      </div>

      <div className="calendar-weekdays" aria-hidden="true">
        {weekdayLabels.map((label, i) => (
          <span key={i}>{label}</span>
        ))}
      </div>

      <div className="calendar-grid" role="grid">
        {grid.map((cell) => (
          <button
            type="button"
            key={cell.dateKey}
            data-testid={`calendar-day-${cell.dateKey}`}
            className={
              "calendar-day" +
              (cell.inMonth ? "" : " outside-month") +
              (selectedDay === cell.dateKey ? " selected" : "")
            }
            aria-pressed={selectedDay === cell.dateKey}
            aria-label={new Intl.DateTimeFormat(i18n.language, { dateStyle: "full" }).format(
              new Date(cell.year, cell.month, cell.day),
            )}
            onClick={() => setSelectedDay(cell.dateKey)}
          >
            <span className="calendar-day-number">{cell.day}</span>
            {cell.appointments.length > 0 && <span className="calendar-day-marker" aria-hidden="true" />}
          </button>
        ))}
      </div>

      {selectedDay && (
        <div className="calendar-selected-day">
          {selectedAppointments.length === 0 ? (
            <p className="empty-state">{t("appointmentCalendar.noAppointments")}</p>
          ) : (
            <ul className="appointment-list">
              {selectedAppointments.map((appointment) => (
                <AppointmentCard
                  key={appointment.id}
                  appointment={appointment}
                  doctor={appointment.doctorId ? doctors.find((d) => d.id === appointment.doctorId) : undefined}
                  onEdit={onEdit}
                  onStatusChange={onStatusChange}
                  onSaveSummary={onSaveSummary}
                  onSelect={onSelect}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
