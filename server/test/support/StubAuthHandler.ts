import { Request, Response } from "express";
import { IAuthHandler, IUserData } from "../../src/auth/Auth.js";

/**
 * Test double for IAuthHandler. With no fixed user configured, calling
 * authorize() throws — used to prove a request was actually satisfied by
 * the `turnado-x-token-user` cookie shortcut rather than a fresh handshake.
 * With a fixed user configured, it authorizes as that user with no
 * network call, for exercising the first-time-login handshake path.
 */
export class StubAuthHandler implements IAuthHandler {
  constructor(private readonly fixedUser?: IUserData) {}

  clientData(): { handler: string } {
    return { handler: "StubAuthHandler" };
  }

  authorize(_req: Request, _res: Response, callback: (data: IUserData) => void): void {
    if (!this.fixedUser) {
      throw new Error("StubAuthHandler.authorize() should not be called in this test");
    }
    callback(this.fixedUser);
  }
}
