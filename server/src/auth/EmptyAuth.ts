import { Request, Response } from "express";
import { IAuthHandler, IUserData } from "./Auth.js";
import config from "../config.js";

/**
 * Local-dev auth handler: skips the real SSO handshake entirely and
 * always "authorizes" as a fixed configured username, so the allow-list
 * and locale mechanisms can be exercised without a NAS to talk to.
 * Never used in production — selected via config's `auth.handler`.
 */
export class AuthHandler implements IAuthHandler {
  clientData() {
    return { handler: "EmptyAuth" };
  }

  authorize(_req: Request, _res: Response, callback: (data: IUserData) => void): void {
    const userName = config.has("auth.devUserName") ? (config.get("auth.devUserName") as string) : "dev-user";
    callback({ user_id: userName, user_name: userName });
  }
}
