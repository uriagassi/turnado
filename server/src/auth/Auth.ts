import { Request, Response, NextFunction } from "express";

// Duplicated (deliberately, not extracted into a shared package) from the
// sibling document-archive app's own SSO validation code — see
// docs/agents/domain.md's provenance note. Kept small and independent.

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

    if (req.cookies?.["x-token-user"]) {
      req.user_name = req.cookies["x-token-user"];
      return next();
    }

    try {
      this.authHandler.authorize(req, res, (data) => {
        req.user_id = data.user_id;
        req.user_name = data.user_name;
        res.cookie("x-token-user", data.user_name, {
          maxAge: 50000,
          secure: true,
          httpOnly: true,
          sameSite: "lax",
        });
        return next();
      });
    } catch (err) {
      console.error(err);
      return res.status(401).send("Invalid Token");
    }
  }
}
