import { CalendarCheck, ClipboardCheck, FileText, Pin, TestTube } from "lucide-react";
import type { TaskType } from "../api";

const ICONS = {
  test: TestTube,
  doctor_visit: CalendarCheck,
  form_17: FileText,
  general_approval: ClipboardCheck,
} as const;

export function TaskIcon({ type }: { type: TaskType }) {
  const Icon = ICONS[type] ?? Pin;
  return <Icon aria-hidden="true" size={22} />;
}
