import { Request, Response, NextFunction } from "express";
import { setAuthCookie } from "./cookies.js";

// Duplicated (deliberately, not extracted into a shared package) from the
// sibling document-archive app's own SSO validation code — see
// docs/agents/domain.md's provenance note. Kept small and independent.
//
// IUserData mirrors that external contract's own field names (user_id/
// user_name) as-is. Everything past this boundary — req.userId/
// req.userName, the rest of this app — uses this app's own camelCase
// convention instead; the translation happens once, right here.

export interface IAuthHandler {
  clientData(): { handler: string };

  authorize(req: Request, res: Response, callback: (data: IUserData) => void): void;
}

export interface IUserData {
  user_id: string;
  user_name: string;
}

export class Auth {
  private readonly authHandler: IAuthHandler;

  constructor(authHandler: IAuthHandler) {
    this.authHandler = authHandler;
  }

  auth(req: Request, res: Response, next: NextFunction) {
    if (req.path === "/auth") {
      return res.json(this.authHandler.clientData());
    }
    // The SPA shell and its static assets are public; this is a
    // client-side-routed app, so every non-API path just needs to serve
    // index.html regardless of auth state. The client makes its own
    // /api/user call and reacts to a 401/403 by showing the login link.
    // Only /api/* is guarded here.
    if (!req.path.startsWith("/api")) return next();

    // Signed, not just present: cookie-parser only populates
    // signedCookies for a value whose HMAC matches config's
    // security.cookieSecret, so a client can't just send an arbitrary
    // `x-token-user=someone` and be trusted as that user.
    const session = req.signedCookies?.["x-token-user"];
    if (session) {
      const identity = parseSession(session);
      if (identity) {
        req.userId = identity.userId;
        req.userName = identity.userName;
        return next();
      }
      // Malformed/stale cookie shape — fall through to a fresh handshake
      // rather than serving a request with half an identity.
    }

    try {
      this.authHandler.authorize(req, res, (data) => {
        req.userId = data.user_id;
        req.userName = data.user_name;
        setAuthCookie(res, "x-token-user", JSON.stringify({ userId: data.user_id, userName: data.user_name }));
        return next();
      });
    } catch (err) {
      console.error(err);
      return res.status(401).send("Invalid Token");
    }
  }
}

/**
 * The session cookie carries both userId and userName (not just the
 * name) so a request served by this shortcut reports the same identity
 * as a fresh handshake would — see the "userId missing on cookie-only
 * requests" fix. Guards against a cookie left over from an older,
 * differently-shaped version of this app. Exported for direct unit
 * testing rather than only indirectly through the cookie/signing machinery.
 */
export function parseSession(raw: string): { userId: string; userName: string } | undefined {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as Record<string, unknown>).userId === "string" &&
      typeof (parsed as Record<string, unknown>).userName === "string"
    ) {
      return parsed as { userId: string; userName: string };
    }
    return undefined;
  } catch {
    return undefined;
  }
}
