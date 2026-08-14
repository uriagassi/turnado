import { Request, Response, NextFunction } from "express";

/**
 * Raw config shape: username -> locale. Its keys double as the security
 * allow-list, per the app's spec (issue #2) — see the AllowList class
 * below, which wraps this so that overload doesn't leak into every call
 * site as a bare Record<string, string>.
 */
export type AllowListConfig = Record<string, string>;

/**
 * Wraps the config-driven username->locale map so its two concerns —
 * "is this username allowed to call the API" and "what locale does this
 * user get" — each have their own named accessor. Without this, two
 * unrelated modules (AllowList.ts's own middleware and i18n/locale.ts)
 * each reached into the same raw Record for a different meaning, which
 * code review flagged as a primitive-obsession/data-clump smell. The one
 * underlying config value stays single per spec — this only encapsulates
 * how it's read, not the config shape itself.
 */
export class AllowList {
  private readonly usernameToLocale: Readonly<AllowListConfig>;

  constructor(usernameToLocale: AllowListConfig) {
    this.usernameToLocale = usernameToLocale;
  }

  isAllowed(username: string | undefined): boolean {
    return username !== undefined && Object.prototype.hasOwnProperty.call(this.usernameToLocale, username);
  }

  localeFor(username: string | undefined): string | undefined {
    return username !== undefined ? this.usernameToLocale[username] : undefined;
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
