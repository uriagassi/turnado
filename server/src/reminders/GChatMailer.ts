import type { Mailer } from "./Mailer.js";
import type { ReminderEmailContent } from "./reminderEmail.js";

export interface GChatConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

type Fetch = typeof fetch;

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CHAT_API = "https://chat.googleapis.com/v1";

/**
 * Mailer that DMs the recipient in Google Chat as the sender account behind
 * the refresh token (user OAuth, no Chat app hosting). Any failure — recipient
 * outside the Workspace domain, no DM possible, API down — rejects, so
 * FallbackMailer can fall back to email.
 */
export class GChatMailer implements Mailer {
  private accessToken: { value: string; expiresAt: number } | null = null;
  private readonly dmSpaces = new Map<string, string>();

  constructor(
    private readonly config: GChatConfig,
    private readonly fetchImpl: Fetch = fetch,
    private readonly now: () => number = Date.now,
  ) {}

  async send(to: string, content: ReminderEmailContent): Promise<void> {
    const space = await this.dmSpaceFor(to);
    await this.api(`${space}/messages`, { text: `*${content.subject}*\n${content.body}` });
  }

  private async dmSpaceFor(email: string): Promise<string> {
    const cached = this.dmSpaces.get(email);
    if (cached) return cached;

    const found = await this.request(
      `${CHAT_API}/spaces:findDirectMessage?name=${encodeURIComponent(`users/${email}`)}`,
    );
    const space = found.ok
      ? ((await found.json()) as { name: string })
      : await this.api("spaces:setup", {
          space: { spaceType: "DIRECT_MESSAGE" },
          memberships: [{ member: { name: `users/${email}`, type: "HUMAN" } }],
        });
    this.dmSpaces.set(email, space.name);
    return space.name;
  }

  private async api(path: string, body: unknown): Promise<{ name: string }> {
    const res = await this.request(`${CHAT_API}/${path}`, { method: "POST", body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`Google Chat ${path} failed: ${res.status} ${await res.text()}`);
    return (await res.json()) as { name: string };
  }

  private async request(url: string, init: RequestInit = {}): Promise<Response> {
    return this.fetchImpl(url, {
      ...init,
      headers: { authorization: `Bearer ${await this.token()}`, "content-type": "application/json" },
    });
  }

  private async token(): Promise<string> {
    if (this.accessToken && this.accessToken.expiresAt > this.now()) return this.accessToken.value;

    const res = await this.fetchImpl(TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        refresh_token: this.config.refreshToken,
        grant_type: "refresh_token",
      }),
    });
    if (!res.ok) throw new Error(`Google OAuth refresh failed: ${res.status} ${await res.text()}`);
    const { access_token, expires_in } = (await res.json()) as { access_token: string; expires_in: number };
    this.accessToken = { value: access_token, expiresAt: this.now() + (expires_in - 60) * 1000 };
    return access_token;
  }
}

/** Tries `primary`; if it throws, logs and sends through `fallback` instead. */
export class FallbackMailer implements Mailer {
  constructor(
    private readonly primary: Mailer,
    private readonly fallback: Mailer,
  ) {}

  async send(to: string, content: ReminderEmailContent): Promise<void> {
    try {
      await this.primary.send(to, content);
    } catch (err) {
      console.warn(`Primary channel failed for ${to}, falling back:`, err);
      await this.fallback.send(to, content);
    }
  }
}
