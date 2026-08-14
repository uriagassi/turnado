import express, { Express } from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import type { Database } from "better-sqlite3";
import { Auth, IAuthHandler } from "./auth/Auth.js";
import { allowListMiddleware } from "./auth/AllowList.js";
import { resolveLocale } from "./i18n/locale.js";

export interface AppOptions {
  authHandler: IAuthHandler;
  /** Username -> locale. Also doubles as the security allow-list: its keys are the only permitted usernames. */
  allowList: Record<string, string>;
  supportedLocales?: string[];
  fallbackLocale?: string;
  /** The shared DB connection (WAL + busy_timeout already applied — see db.ts). Not queried by any route yet; later tickets build on it. */
  db?: Database;
  /** Built client (client/dist) to serve as the SPA shell. Omitted in tests that only exercise the API. */
  clientDistPath?: string;
}

export function createApp(options: AppOptions): Express {
  const { authHandler, allowList, supportedLocales = ["en", "he"], fallbackLocale = "en", db, clientDistPath } =
    options;

  const app = express();
  app.locals.db = db;
  app.use(helmet());
  app.use(cookieParser());

  const auth = new Auth(authHandler);
  app.use((req, res, next) => auth.auth(req, res, next));
  app.use(allowListMiddleware(new Set(Object.keys(allowList))));

  app.get("/api/user", (req, res) => {
    res.json({
      user_id: req.user_id,
      user_name: req.user_name,
      locale: resolveLocale({
        userName: req.user_name,
        queryLocale: req.query.lang as string | undefined,
        allowList,
        supportedLocales,
        fallbackLocale,
      }),
    });
  });

  // Empty home screen: no appointments/tasks/documents exist yet at this
  // stage of the build (issues #4/#5/#6 populate these).
  app.get("/api/home", (_req, res) => {
    res.json({ nextAppointment: null, openItems: [], recentDocuments: [] });
  });

  app.get("/api/logout", (req, res) => {
    for (const c in req.cookies) {
      res.clearCookie(c);
    }
    res.json("OK");
  });

  if (clientDistPath) {
    app.use(express.static(clientDistPath));
    // SPA fallback: any non-API GET (client-side routes) serves the shell.
    app.get(/^(?!\/api).*/, (_req, res) => {
      res.sendFile("index.html", { root: clientDistPath });
    });
  }

  return app;
}
