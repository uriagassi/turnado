import { useTranslation } from "react-i18next";
import { formatRelativeDateTime } from "../formatDateTime";

/**
 * Binds formatRelativeDateTime to the current locale and its translated
 * "Today"/"Tomorrow" labels, so call sites (HomeScreen, DoctorsScreen,
 * DoctorDetailScreen) just pass a dateTime instead of repeating the same
 * (locale, todayLabel, tomorrowLabel) triple at every call.
 */
export function useRelativeDateTime(): (dateTime: string, now?: Date, timeZone?: string) => string {
  const { t, i18n } = useTranslation();
  return (dateTime, now, timeZone) =>
    formatRelativeDateTime(dateTime, i18n.language, t("common.today"), t("common.tomorrow"), now, timeZone);
}
