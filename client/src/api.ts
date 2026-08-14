export interface UserInfo {
  user_id: string;
  user_name: string;
  locale: string;
}

export interface AuthClientData {
  handler: string;
  login_href?: string;
  logout_href?: string;
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

export interface HomeData {
  nextAppointment: unknown;
  openItems: unknown[];
  recentDocuments: unknown[];
}

export async function fetchHome(): Promise<HomeData> {
  const res = await fetch("/api/home", { credentials: "same-origin" });
  if (!res.ok) throw new Error(`Unexpected /api/home status ${res.status}`);
  return res.json();
}
