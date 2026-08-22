import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { MissedReason } from "../api";

const REASON_KEYS: Record<MissedReason, string> = {
  "send failed": "reminder.missed.sendFailed",
  "window closed before delivery": "reminder.missed.windowClosed",
};

/**
 * Small marker for issue #10's AC: "Home screen (and the relevant item)
 * shows a small marker on any appointment/task with a missed reminder,
 * with the exact reason available on tap/hover." The native `title`
 * attribute covers hover; the click-to-reveal line (same pattern as
 * DocumentsScreen's .linked-badge) covers tap, since a title tooltip
 * doesn't reliably show on touch. stopPropagation keeps a tap here from
 * also triggering an ancestor row's own onClick (e.g. HomeScreen's
 * clickable feed rows).
 */
export function MissedReminderBadge({ reason }: { reason: MissedReason }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const detail = t(REASON_KEYS[reason]);

  return (
    <span className="missed-reminder">
      <button
        type="button"
        className="badge missed-reminder-badge"
        title={detail}
        onClick={(e) => {
          e.stopPropagation();
          setExpanded((v) => !v);
        }}
      >
        <span aria-hidden="true">⚠</span> {t("reminder.missed.badge")}
      </button>
      {expanded && <span className="missed-reminder-detail">{detail}</span>}
    </span>
  );
}
