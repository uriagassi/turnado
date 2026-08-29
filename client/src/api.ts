export interface UserInfo {
  userId: string;
  userName: string;
  locale: string;
}

export interface AuthClientData {
  handler: string;
  loginHref?: string;
  logoutHref?: string;
}

export type UserResult = { status: "ok"; user: UserInfo } | { status: "not-authorized" } | { status: "unauthenticated" };

// The Synology SSO redirect (SignInScreen's loginHref) comes back with the
// token as a URL fragment — `#access_token=...` — not a query string.
// Browsers never send a fragment to the server, so the server-side
// SimpleOAuth handler (which checks query/body/header/cookie) never sees a
// query-string token here; it has to be read client-side and forwarded
// explicitly, same as the sibling document-archive app's own client does.
// Captured once at module load, before anything else touches the URL, and
// the fragment is then stripped from the visible URL/history so a refresh
// doesn't keep re-exposing the raw token in the address bar.
function accessTokenFromHash(): string | null {
  if (!window.location.hash) return null;
  const token = new URLSearchParams(window.location.hash.slice(1)).get("access_token");
  if (token) history.replaceState(null, "", window.location.pathname + window.location.search);
  return token;
}

const hashAccessToken = accessTokenFromHash();

export async function fetchAuthInfo(): Promise<AuthClientData> {
  const res = await fetch("/auth", { credentials: "same-origin" });
  return res.json();
}

export async function fetchCurrentUser(): Promise<UserResult> {
  // Propagate the page's own query string so a self-testing `?lang=he`
  // override reaches the server's locale resolution.
  const res = await fetch("/api/user" + window.location.search, {
    credentials: "same-origin",
    headers: hashAccessToken ? { "x-access-token": hashAccessToken } : undefined,
  });
  if (res.status === 403) return { status: "not-authorized" };
  if (res.status === 401) return { status: "unauthenticated" };
  if (!res.ok) throw new Error(`Unexpected /api/user status ${res.status}`);
  const user = (await res.json()) as UserInfo;
  return { status: "ok", user };
}

export interface DoctorInput {
  name: string;
  specialty?: string;
  clinic?: string;
  phone?: string;
  address?: string;
  email?: string;
  notes?: string;
}

export interface Doctor extends DoctorInput {
  id: number;
  photoPath: string | null;
}

export type AppointmentStatus = "planned" | "done" | "cancelled" | "postponed";

/** Issue #10: why a logged reminder ended up "missed" rather than sent — mirrors the server's ReminderLog.MissedReason. */
export type MissedReason = "send failed" | "window closed before delivery";

export interface AppointmentInput {
  doctorId?: number | null;
  dateTime: string;
  location?: string;
  notes: string;
}

export interface Appointment extends AppointmentInput {
  id: number;
  doctorId: number | null;
  status: AppointmentStatus;
  summary: string | null;
  /** Issue #10: null unless this appointment has a currently-missed reminder — see server's app.ts withMissedReminder(). */
  missedReminder: MissedReason | null;
}

export type TaskType = "test" | "doctor_visit" | "form_17" | "general_approval";
export type TaskStatus = "open" | "in-progress" | "done";

export interface TaskInput {
  type: TaskType;
  title: string;
  status?: TaskStatus;
  dueDate?: string | null;
  doctorId?: number | null;
  sourceAppointmentId?: number | null;
  pendingAppointmentId?: number | null;
  requiresAdvanceScheduling?: boolean;
  recurrenceWindow?: string | null;
  approximateDateWindow?: string | null;
  institution?: string | null;
  department?: string | null;
  healthFund?: string | null;
  codeNumber?: string | null;
  codeName?: string | null;
  issuingBody?: string | null;
  purpose?: string | null;
}

export interface Task extends TaskInput {
  id: number;
  status: TaskStatus;
  doctorId: number | null;
  dueDate: string | null;
  sourceAppointmentId: number | null;
  pendingAppointmentId: number | null;
  requiresAdvanceScheduling: boolean;
  recurrenceWindow: string | null;
  approximateDateWindow: string | null;
  institution: string | null;
  department: string | null;
  healthFund: string | null;
  codeNumber: string | null;
  codeName: string | null;
  issuingBody: string | null;
  purpose: string | null;
  createdAt: string;
  updatedAt: string;
  /** Issue #10: null unless this task has a currently-missed reminder — see server's app.ts withMissedReminder(). */
  missedReminder: MissedReason | null;
}

export type DocumentType =
  | "test result"
  | "letter"
  | "referral"
  | "appointment invitation"
  | "Form 17"
  | "approval"
  | "other";

/** Declaration order — the canonical grouping/display order for document types (mirrors server's VALID_DOCUMENT_TYPES). */
export const DOCUMENT_TYPES: DocumentType[] = [
  "test result",
  "letter",
  "referral",
  "appointment invitation",
  "Form 17",
  "approval",
  "other",
];

export interface UploadedFile {
  fileName: string;
  uniqueFilename: string;
  mime: string;
  hash: string;
  size: number;
}

export interface MedicalDocument {
  id: number;
  notebookId: number;
  title: string;
  type: DocumentType;
  documentDate: string | null;
  doctorId: number | null;
  notes: string | null;
  file: UploadedFile;
  appointmentIds: number[];
  taskIds: number[];
  createdAt: string;
  updatedAt: string;
}

export interface HomeData {
  nextAppointment: Appointment | null;
  openItems: Task[];
  recentDocuments: MedicalDocument[];
}

export async function fetchHome(): Promise<HomeData> {
  const res = await fetch("/api/home", { credentials: "same-origin" });
  if (!res.ok) throw new Error(`Unexpected /api/home status ${res.status}`);
  return res.json();
}

export async function fetchTasks(filter?: { doctorId?: number; status?: TaskStatus }): Promise<Task[]> {
  const params = new URLSearchParams();
  if (filter?.doctorId !== undefined) params.set("doctorId", String(filter.doctorId));
  if (filter?.status !== undefined) params.set("status", filter.status);
  const qs = params.toString() ? `?${params.toString()}` : "";
  const res = await fetch(`/api/tasks${qs}`, { credentials: "same-origin" });
  if (!res.ok) throw new Error(`Unexpected /api/tasks status ${res.status}`);
  return res.json();
}

export async function createTask(input: TaskInput): Promise<Task> {
  const res = await fetch("/api/tasks", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Unexpected POST /api/tasks status ${res.status}`);
  return res.json();
}

export async function updateTask(id: number, input: TaskInput): Promise<Task> {
  const res = await fetch(`/api/tasks/${id}`, {
    method: "PUT",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Unexpected PUT /api/tasks/${id} status ${res.status}`);
  return res.json();
}

export async function setTaskStatus(id: number, status: TaskStatus): Promise<Task> {
  const res = await fetch(`/api/tasks/${id}/status`, {
    method: "PUT",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error(`Unexpected PUT /api/tasks/${id}/status status ${res.status}`);
  return res.json();
}

export async function setTaskPendingAppointment(id: number, pendingAppointmentId: number | null): Promise<Task> {
  const res = await fetch(`/api/tasks/${id}/pending-appointment`, {
    method: "PUT",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pendingAppointmentId }),
  });
  if (!res.ok) throw new Error(`Unexpected PUT /api/tasks/${id}/pending-appointment status ${res.status}`);
  return res.json();
}

export async function fetchDoctors(): Promise<Doctor[]> {
  const res = await fetch("/api/doctors", { credentials: "same-origin" });
  if (!res.ok) throw new Error(`Unexpected /api/doctors status ${res.status}`);
  return res.json();
}

export async function createDoctor(input: DoctorInput): Promise<Doctor> {
  const res = await fetch("/api/doctors", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Unexpected POST /api/doctors status ${res.status}`);
  return res.json();
}

export async function updateDoctor(id: number, input: DoctorInput): Promise<Doctor> {
  const res = await fetch(`/api/doctors/${id}`, {
    method: "PUT",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Unexpected PUT /api/doctors/${id} status ${res.status}`);
  return res.json();
}

export async function uploadDoctorPhoto(id: number, photo: File): Promise<Doctor> {
  const body = new FormData();
  body.append("photo", photo);
  const res = await fetch(`/api/doctors/${id}/photo`, { method: "POST", credentials: "same-origin", body });
  if (!res.ok) throw new Error(`Unexpected POST /api/doctors/${id}/photo status ${res.status}`);
  return res.json();
}

export async function fetchAppointments(): Promise<Appointment[]> {
  const res = await fetch("/api/appointments", { credentials: "same-origin" });
  if (!res.ok) throw new Error(`Unexpected /api/appointments status ${res.status}`);
  return res.json();
}

export async function createAppointment(input: AppointmentInput): Promise<Appointment> {
  const res = await fetch("/api/appointments", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Unexpected POST /api/appointments status ${res.status}`);
  return res.json();
}

export async function updateAppointment(id: number, input: AppointmentInput): Promise<Appointment> {
  const res = await fetch(`/api/appointments/${id}`, {
    method: "PUT",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Unexpected PUT /api/appointments/${id} status ${res.status}`);
  return res.json();
}

export async function setAppointmentStatus(id: number, status: AppointmentStatus): Promise<Appointment> {
  const res = await fetch(`/api/appointments/${id}/status`, {
    method: "PUT",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error(`Unexpected PUT /api/appointments/${id}/status status ${res.status}`);
  return res.json();
}

export async function setAppointmentSummary(id: number, summary: string): Promise<Appointment> {
  const res = await fetch(`/api/appointments/${id}/summary`, {
    method: "PUT",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ summary }),
  });
  if (!res.ok) throw new Error(`Unexpected PUT /api/appointments/${id}/summary status ${res.status}`);
  return res.json();
}

/** Query params GET /api/documents accepts — see server's DocumentSearchFilters for the search-dimension fields (doctorId/type/query/dateFrom/dateTo); taskId/appointmentId are single-purpose lookups it also supports. */
export interface DocumentQueryFilter {
  doctorId?: number;
  taskId?: number;
  appointmentId?: number;
  type?: DocumentType;
  query?: string;
  dateFrom?: string;
  dateTo?: string;
}

export async function fetchDocuments(filter?: DocumentQueryFilter): Promise<MedicalDocument[]> {
  const params = new URLSearchParams();
  if (filter?.doctorId !== undefined) params.set("doctorId", String(filter.doctorId));
  if (filter?.taskId !== undefined) params.set("taskId", String(filter.taskId));
  if (filter?.appointmentId !== undefined) params.set("appointmentId", String(filter.appointmentId));
  if (filter?.type !== undefined) params.set("type", filter.type);
  if (filter?.query !== undefined) params.set("query", filter.query);
  if (filter?.dateFrom !== undefined) params.set("dateFrom", filter.dateFrom);
  if (filter?.dateTo !== undefined) params.set("dateTo", filter.dateTo);
  const qs = params.toString() ? `?${params.toString()}` : "";
  const res = await fetch(`/api/documents${qs}`, { credentials: "same-origin" });
  if (!res.ok) throw new Error(`Unexpected /api/documents status ${res.status}`);
  return res.json();
}

/** Attaches an already-uploaded document to an appointment's checklist (issue #9's searchable picker) — unlike uploadDocument, no file involved, just linking an existing one. */
export async function attachAppointmentDocument(appointmentId: number, documentId: number): Promise<MedicalDocument> {
  const res = await fetch(`/api/appointments/${appointmentId}/documents/${documentId}`, {
    method: "PUT",
    credentials: "same-origin",
  });
  if (!res.ok) throw new Error(`Unexpected PUT /api/appointments/${appointmentId}/documents/${documentId} status ${res.status}`);
  return res.json();
}

export async function fetchDocument(id: number): Promise<MedicalDocument> {
  const res = await fetch(`/api/documents/${id}`, { credentials: "same-origin" });
  if (!res.ok) throw new Error(`Unexpected /api/documents/${id} status ${res.status}`);
  return res.json();
}

export async function uploadDocument(formData: FormData): Promise<MedicalDocument> {
  const res = await fetch("/api/documents", {
    method: "POST",
    credentials: "same-origin",
    body: formData,
  });
  if (!res.ok) throw new Error(`Unexpected POST /api/documents status ${res.status}`);
  return res.json();
}
