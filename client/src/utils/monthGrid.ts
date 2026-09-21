import type { Appointment } from "../api";

export interface MonthGridCell {
  year: number;
  month: number;
  day: number;
  /** YYYY-MM-DD, locale-independent — used for React keys, lookups, and test targeting. */
  dateKey: string;
  inMonth: boolean;
  appointments: Appointment[];
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function dateKey(year: number, month: number, day: number): string {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

// en-CA gives a plain YYYY-MM-DD, locale-independently — mirrors
// formatDateTime.ts's own calendarDay helper, which this duplicates rather
// than imports since that one is unexported and the two call sites diverge
// only in default parameters.
function calendarDayKey(date: Date, timeZone?: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

/**
 * A Sunday-first, full-week grid for `month` (0-indexed) of `year`, padded
 * with the trailing/leading days of neighboring months so every row has 7
 * days — the shape a month-view calendar grid renders. Built from plain
 * year/month/day integer arithmetic rather than by reformatting Date
 * objects through Intl, so the grid's own layout can't shift with the
 * machine's time zone; `timeZone` only affects the one place a real
 * timestamp becomes a calendar day — matching each appointment to its
 * cell — same default-to-viewer's-own-zone convention as
 * formatDateTime.ts's relativeDayLabel.
 */
export function buildMonthGrid(year: number, month: number, appointments: Appointment[], timeZone?: string): MonthGridCell[] {
  const byDay = new Map<string, Appointment[]>();
  const sorted = [...appointments].sort((a, b) => Date.parse(a.dateTime) - Date.parse(b.dateTime));
  for (const appointment of sorted) {
    const key = calendarDayKey(new Date(appointment.dateTime), timeZone);
    const bucket = byDay.get(key);
    if (bucket) bucket.push(appointment);
    else byDay.set(key, [appointment]);
  }

  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;

  const cells: MonthGridCell[] = [];
  for (let i = 0; i < totalCells; i++) {
    const dayOffset = i - firstWeekday + 1;
    let cellYear = year;
    let cellMonth = month;
    let day = dayOffset;

    if (dayOffset < 1) {
      day = daysInPrevMonth + dayOffset;
      cellMonth = month - 1;
    } else if (dayOffset > daysInMonth) {
      day = dayOffset - daysInMonth;
      cellMonth = month + 1;
    }

    if (cellMonth < 0) {
      cellMonth = 11;
      cellYear -= 1;
    } else if (cellMonth > 11) {
      cellMonth = 0;
      cellYear += 1;
    }

    const key = dateKey(cellYear, cellMonth, day);
    cells.push({
      year: cellYear,
      month: cellMonth,
      day,
      dateKey: key,
      inMonth: cellMonth === month && cellYear === year,
      appointments: byDay.get(key) ?? [],
    });
  }

  return cells;
}
