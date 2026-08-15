import { useTranslation } from "react-i18next";
import type { TaskStatus } from "../api";
import { taskStatusClass } from "../tasks/taskUtils";

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const { t } = useTranslation();

  const labelKey =
    status === "in-progress"
      ? "task.status.inprogress"
      : status === "done"
      ? "task.status.done"
      : "task.status.open";

  return <span className={taskStatusClass(status)}>{t(labelKey)}</span>;
}
