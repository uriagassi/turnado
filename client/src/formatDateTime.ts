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
