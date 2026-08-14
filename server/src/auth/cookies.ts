import { Response, CookieOptions } from "express";
import config from "../config.js";

// Shared options for the two identity cookies this app sets (Auth.ts's
// SSO-session shortcut and SimpleOAuth.ts's cached OAuth token). Signed,
// so cookie-parser rejects a client-forged or tampered value instead of
// handing it back as trusted input — see config's `security.cookieSecret`,
// applied once via cookieParser(secret) in app.ts.
const AUTH_COOKIE_OPTIONS: Omit<CookieOptions, "secure"> = {
  httpOnly: true,
  sameSite: "lax",
  signed: true,
};

/**
 * `secure` can't just be hardcoded true: config's https.use (see
 * index.ts) defaults to false, and that's how this app's own README runs
 * it for local dev — a Secure cookie is silently dropped by the browser
 * over a plain-HTTP connection, which would otherwise break auth in
 * exactly that documented setup.
 */
function cookiesAreSecure(): boolean {
  return config.has("https.use") && config.get("https.use") === true;
}

/**
 * How long a client can go without a fresh SSO handshake. Both auth
 * cookies (Auth.ts's own signed session and SimpleOAuth.ts's cached
 * OAuth access token) share this one value deliberately — they exist to
 * back each other up (the session shortcut avoids re-running the
 * handshake at all; the cached token, once the session expires, avoids
 * the browser-redirect part of a fresh one). A previous version let them
 * drift out of sync (50 seconds vs. this value), which defeated the
 * session shortcut almost immediately — flagged independently by two
 * code reviews.
 */
export const AUTH_COOKIE_MAX_AGE_MS = 5_000_000; // ~83 minutes

export function setAuthCookie(res: Response, name: string, value: string, maxAge: number = AUTH_COOKIE_MAX_AGE_MS): void {
  res.cookie(name, value, { ...AUTH_COOKIE_OPTIONS, secure: cookiesAreSecure(), maxAge });
}
