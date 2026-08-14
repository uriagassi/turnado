import { Request, Response, NextFunction } from "express";

/**
 * Enforced on top of (not instead of) the underlying SSO validation in
 * Auth.ts, on every route in this app: a validated SSO identity that
 * isn't one of the exactly-two configured usernames gets a clean
 * "not authorized" response instead of reaching any route handler.
 *
 * Requests Auth.ts already left public (no req.user_name set — static
 * assets, the SPA shell, /auth) pass through untouched.
 */
export function allowListMiddleware(allowedUsernames: ReadonlySet<string>) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user_name) return next();
    if (!allowedUsernames.has(req.user_name)) {
      return res.status(403).json({ error: "Not authorized" });
    }
    return next();
  };
}
