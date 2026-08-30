import { IAuthHandler, IUserData } from "./Auth.js";
import { setAuthCookie, ACCESS_TOKEN_COOKIE_NAME } from "./cookies.js";
import https from "node:https";
import axios from "axios";
import { Request, Response } from "express";

/**
 * Shared OAuth-token-exchange plumbing for the household-NAS SSO —
 * duplicated from the sibling document-archive app (see Auth.ts).
 */
export abstract class SimpleOAuth implements IAuthHandler {
  authorize(req: Request, res: Response, callback: (data: IUserData) => void) {
    const tok =
      req.query?.token ||
      req.body?.token ||
      req.headers["x-access-token"] ||
      req.signedCookies?.[ACCESS_TOKEN_COOKIE_NAME];
    if (!tok) {
      // No token yet is the *normal* first-visit state (before the user
      // has followed the SSO login link) — 401 so the client treats it
      // as "not signed in yet" (show the sign-in link), not 403 "signed
      // in but rejected" (which api.ts maps to a hard not-authorized
      // screen, skipping the login link entirely).
      return res.status(401).send("Not supported for unknown users or in Incognito Mode (no cookies)");
    }
    // Passed through as-is: this is a bearer token/JWT, not free text —
    // mutating its characters (as string-sanitizer used to) corrupts it.
    // The one place it needs URL-encoding is where oAuthUrl() embeds it
    // in a query string; it's kept raw everywhere else so it round-trips
    // correctly through the x-access-token cookie below.
    const token = tok as string;
    const agent = new https.Agent({ rejectUnauthorized: this.shouldRejectUnauthorized() });
    axios
      .get(this.oAuthUrl(token), { httpsAgent: agent })
      .then((response) => {
        if (!response.data.data) {
          console.error(response.data);
          return res.status(401).send("Invalid Token");
        }
        setAuthCookie(res, ACCESS_TOKEN_COOKIE_NAME, token);
        callback(response.data.data);
      })
      .catch((error) => {
        console.error(error);
        return res.status(401).send("Invalid Token");
      });
  }

  abstract clientData(): { handler: string; loginHref: string; logoutHref: string };

  abstract oAuthUrl(token: string): string;

  shouldRejectUnauthorized(): boolean {
    return false;
  }
}
