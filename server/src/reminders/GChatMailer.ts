import type { Mailer } from "./Mailer.js";
import type { ReminderEmailContent } from "./reminderEmail.js";

export interface GChatConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

/** A refresh token without its client id/secret can only fail on every send, so fail at startup instead. */
export function requireGChatCredentials(config: GChatConfig): GChatConfig {
  if (!config.clientId || !config.clientSecret) {
    throw new Error("gchat.refreshToken is set but gchat.clientId / gchat.clientSecret are missing");
  }
  return config;
}

type Fetch = typeof fetch;

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CHAT_API = "https://chat.googleapis.com/v1";
const REQUEST_TIMEOUT_MS = 15_000;

/**
 * Mailer that DMs the recipient in Google Chat as the sender account behind
 * the refresh token (user OAuth, no Chat app hosting). Any failure — recipient
 * outside the Workspace domain, no DM possible, API down — rejects, so
 * FallbackMailer can fall back to email.
 */
export class GChatMailer implements Mailer {
  private accessToken: { value: string; expiresAt: number } | null = null;
  private refreshing: Promise<string> | null = null;
  private readonly dmSpaces = new Map<string, string>();

  constructor(
    private readonly config: GChatConfig,
    private readonly fetchImpl: Fetch = fetch,
    private readonly now: () => number = Date.now,
  ) {}

  async send(to: string, content: ReminderEmailContent): Promise<void> {
    const space = await this.dmSpaceFor(to);
    try {
      await this.post(`${space}/messages`, { text: `*${content.subject}*\n${content.body}` });
    } catch (err) {
      if (err instanceof ChatApiError && err.status === 404) this.dmSpaces.delete(to);
      throw err;
    }
  }

  private async dmSpaceFor(email: string): Promise<string> {
    const cached = this.dmSpaces.get(email);
    if (cached) return cached;

    const found = await this.request(
      `${CHAT_API}/spaces:findDirectMessage?name=${encodeURIComponent(`users/${email}`)}`,
    );
    // Only "no DM yet" falls through to setup; auth/quota/server errors must surface.
    if (!found.ok && found.status !== 404) throw await ChatApiError.from("spaces:findDirectMessage", found);
    const space = found.ok
      ? ((await found.json()) as { name: string })
      : await this.post("spaces:setup", {
          space: { spaceType: "DIRECT_MESSAGE" },
          memberships: [{ member: { name: `users/${email}`, type: "HUMAN" } }],
        });
    this.dmSpaces.set(email, space.name);
    return space.name;
  }

  private async post(path: string, body: unknown): Promise<{ name: string }> {
    const res = await this.request(`${CHAT_API}/${path}`, { method: "POST", body: JSON.stringify(body) });
    if (!res.ok) throw await ChatApiError.from(path, res);
    return (await res.json()) as { name: string };
  }

  private async request(url: string, init: RequestInit = {}): Promise<Response> {
    return this.fetchImpl(url, {
      ...init,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { authorization: `Bearer ${await this.token()}`, "content-type": "application/json" },
    });
  }

  private token(): Promise<string> {
    if (this.accessToken && this.accessToken.expiresAt > this.now()) return Promise.resolve(this.accessToken.value);
    this.refreshing ??= this.refresh().finally(() => {
      this.refreshing = null;
    });
    return this.refreshing;
  }

  private async refresh(): Promise<string> {
    const res = await this.fetchImpl(TOKEN_URL, {
      method: "POST",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        refresh_token: this.config.refreshToken,
        grant_type: "refresh_token",
      }),
    });
    if (!res.ok) throw await ChatApiError.from("oauth refresh", res);
    const { access_token, expires_in } = (await res.json()) as { access_token: string; expires_in: number };
    this.accessToken = { value: access_token, expiresAt: this.now() + (expires_in - 60) * 1000 };
    return access_token;
  }
}

class ChatApiError extends Error {
  constructor(
    label: string,
    readonly status: number,
    detail: string,
  ) {
    super(`Google Chat ${label} failed: ${status} ${detail}`);
  }

  static async from(label: string, res: Response): Promise<ChatApiError> {
    return new ChatApiError(label, res.status, await res.text());
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
