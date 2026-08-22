import { Request, Response, NextFunction } from "express";

/**
 * Raw config shape: username -> {locale, email}. Its keys double as the
 * security allow-list, per the app's spec (issue #2) — see the AllowList
 * class below, which wraps this so that overload doesn't leak into every
 * call site as a bare Record<string, AllowListEntry>.
 *
 * `email` was added for issue #10 (Reminders): each allow-listed user gets
 * their own reminder emails there, rather than a single household-wide
 * address, so it lives right next to the locale it's already keyed the
 * same way as.
 */
export interface AllowListEntry {
  locale: string;
  email: string;
}

export type AllowListConfig = Record<string, AllowListEntry>;

/**
 * Wraps the config-driven username->entry map so its three concerns —
 * "is this username allowed to call the API", "what locale does this user
 * get", and "what address does this user's reminder email go to" (issue
 * #10) — each have their own named accessor. Without this, unrelated
 * modules (AllowList.ts's own middleware, i18n/locale.ts, and eventually
 * the reminder sender) would each reach into the same raw Record for a
 * different meaning, which code review flagged as a primitive-obsession/
 * data-clump smell. The one underlying config value stays single per spec
 * — this only encapsulates how it's read, not the config shape itself.
 */
export class AllowList {
  private readonly entries: Readonly<AllowListConfig>;

  constructor(entries: AllowListConfig) {
    this.entries = entries;
  }

  isAllowed(username: string | undefined): boolean {
    return username !== undefined && Object.prototype.hasOwnProperty.call(this.entries, username);
  }

  localeFor(username: string | undefined): string | undefined {
    return username !== undefined ? this.entries[username]?.locale : undefined;
  }

  emailFor(username: string | undefined): string | undefined {
    return username !== undefined ? this.entries[username]?.email : undefined;
  }
}

/**
 * Enforced on top of (not instead of) the underlying SSO validation in
 * Auth.ts, on every route in this app: a validated SSO identity that
 * isn't one of the exactly-two configured usernames gets a clean
 * "not authorized" response instead of reaching any route handler.
 *
 * Requests Auth.ts already left public (no req.userName set — static
 * assets, the SPA shell, /auth) pass through untouched.
 */
export function allowListMiddleware(allowList: AllowList) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.userName) return next();
    if (!allowList.isAllowed(req.userName)) {
      return res.status(403).json({ error: "Not authorized" });
    }
    return next();
  };
}
