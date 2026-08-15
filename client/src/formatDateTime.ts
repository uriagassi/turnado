/**
 * Renders an appointment's stored ISO dateTime as locale-friendly text
 * (e.g. "Sep 1, 2026, 10:00 AM") instead of the raw ISO string. `timeZone`
 * is only ever passed explicitly in tests, to keep expected output
 * deterministic regardless of the machine running them — production calls
 * omit it, so the viewer's own local time zone applies.
 */
export function formatDateTime(dateTime: string, locale: string, timeZone?: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(dateTime));
}

// en-CA gives a plain YYYY-MM-DD, locale-independently — used only to diff
// calendar days, never shown to a user, so its own locale doesn't matter.
function calendarDay(date: Date, timeZone?: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
}

/**
 * A short day label for a near-future date — "Today"/"Tomorrow" for the
 * next two calendar days, the weekday name for the rest of the week, or
 * null once it's far enough out that a bare weekday would be ambiguous
 * (callers fall back to formatDateTime's full date in that case). Mirrors
 * the prototypes' "מחר" (tomorrow) treatment on near appointments
 * (05-home-screen.html hero, 06-doctor-view.html doctor cards) instead of
 * always spelling out the full date. Day boundaries are computed via
 * `timeZone` (falling back to the viewer's own, same as formatDateTime)
 * rather than the two Dates' raw instants, so "tomorrow" means the next
 * calendar day where the viewer is, not a raw 24h offset from now.
 */
export function relativeDayLabel(
  dateTime: string,
  locale: string,
  todayLabel: string,
  tomorrowLabel: string,
  now: Date = new Date(),
  timeZone?: string,
): string | null {
  const target = new Date(dateTime);
  const dayDiff = daysBetween(calendarDay(now, timeZone), calendarDay(target, timeZone));
  if (dayDiff === 0) return todayLabel;
  if (dayDiff === 1) return tomorrowLabel;
  if (dayDiff > 1 && dayDiff < 7) return new Intl.DateTimeFormat(locale, { weekday: "long", timeZone }).format(target);
  return null;
}

/**
 * formatDateTime's relative-aware counterpart for upcoming appointments —
 * "Tomorrow, 10:00 AM" instead of "Sep 2, 2026, 10:00 AM" while the date is
 * near, same full date once it isn't. See relativeDayLabel.
 */
export function formatRelativeDateTime(
  dateTime: string,
  locale: string,
  todayLabel: string,
  tomorrowLabel: string,
  now: Date = new Date(),
  timeZone?: string,
): string {
  const day = relativeDayLabel(dateTime, locale, todayLabel, tomorrowLabel, now, timeZone);
  if (day === null) return formatDateTime(dateTime, locale, timeZone);
  const time = new Intl.DateTimeFormat(locale, { timeStyle: "short", timeZone }).format(new Date(dateTime));
  return `${day}, ${time}`;
}
