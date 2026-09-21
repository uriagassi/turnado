import { useState } from "react";
import { useTranslation } from "react-i18next";

/**
 * Persistent "possibly a duplicate" marker for issue #12's AC — same
 * click-to-expand shape as MissedReminderBadge (hover via `title`, tap via
 * click-to-expand), but styled with the neutral `.linked-badge` gray rather
 * than a warning color: "visually calmer than the missed-reminder marker",
 * per the AC, since this is a heads-up rather than something that failed.
 */
export function SimilarTaskBadge() {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const detail = t("task.duplicate.detail");

  return (
    <span className="similar-task">
      <button
        type="button"
        className="badge linked-badge similar-task-badge"
        title={detail}
        onClick={(e) => {
          e.stopPropagation();
          setExpanded((v) => !v);
        }}
      >
        <span aria-hidden="true">≈</span> {t("task.duplicate.badge")}
      </button>
      {expanded && <span className="similar-task-detail">{detail}</span>}
    </span>
  );
}
