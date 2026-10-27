import { useTranslation } from "react-i18next";
import { formatRelativeDate } from "../formatDateTime";

/** Binds formatRelativeDate to the current locale and its "Today"/"Tomorrow" labels. */
export function useRelativeDate(): (date: string, now?: Date, timeZone?: string) => string {
  const { t, i18n } = useTranslation();
  return (date, now, timeZone) => formatRelativeDate(date, i18n.language, t("common.today"), t("common.tomorrow"), now, timeZone);
}
