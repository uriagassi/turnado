import { IAuthHandler, IUserData } from "./Auth.js";
import sanitizer from "string-sanitizer";
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
      req.query?.token || req.body?.token || req.headers["x-access-token"] || req.cookies?.["x-access-token"];
    if (!tok) {
      return res.status(403).send("Not supported for unknown users or in Incognito Mode (no cookies)");
    }
    const token = sanitizer.sanitize(tok as string);
    const agent = new https.Agent({ rejectUnauthorized: this.shouldRejectUnauthorized() });
    axios
      .get(this.oAuthUrl(token), { httpsAgent: agent })
      .then((response) => {
        if (!response.data.data) {
          console.error(response.data);
          return res.status(401).send("Invalid Token");
        }
        res.cookie("x-access-token", token, {
          maxAge: 5000000,
          secure: true,
          httpOnly: true,
          sameSite: "lax",
        });
        callback(response.data.data);
      })
      .catch((error) => {
        console.error(error);
        return res.status(401).send("Invalid Token");
      });
  }

  abstract clientData(): { handler: string; login_href: string; logout_href: string };

  abstract oAuthUrl(token: string): string;

  shouldRejectUnauthorized(): boolean {
    return false;
  }
}
