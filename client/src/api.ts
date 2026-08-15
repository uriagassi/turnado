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

export async function fetchAuthInfo(): Promise<AuthClientData> {
  const res = await fetch("/auth", { credentials: "same-origin" });
  return res.json();
}

export async function fetchCurrentUser(): Promise<UserResult> {
  // Propagate the page's own query string so a self-testing `?lang=he`
  // override reaches the server's locale resolution.
  const res = await fetch("/api/user" + window.location.search, { credentials: "same-origin" });
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
}

export interface HomeData {
  nextAppointment: Appointment | null;
  openItems: Task[];
  recentDocuments: unknown[];
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
