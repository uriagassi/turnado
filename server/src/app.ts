import express, { Express } from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import type { Database } from "better-sqlite3";
import { Auth, IAuthHandler } from "./auth/Auth.js";
import { allowListMiddleware, AllowList, AllowListConfig } from "./auth/AllowList.js";
import { resolveLocale } from "./i18n/locale.js";
import { Doctors, DoctorNotFoundError, InvalidDoctorInputError } from "./doctors/Doctors.js";

export interface AppOptions {
  authHandler: IAuthHandler;
  allowList: AllowListConfig;
  /** Signs the auth cookies (see auth/cookies.ts) so a client can't forge req.userName by sending an arbitrary cookie. */
  cookieSecret: string;
  supportedLocales?: string[];
  fallbackLocale?: string;
  /** The shared DB connection (WAL + busy_timeout already applied — see db.ts). Only used by /api/doctors so far. */
  db?: Database;
  /** Shared tag every newly-created doctor tag nests under (see Doctors.ts). Only matters when db is set. */
  doctorsParentTagName?: string;
  /** Built client (client/dist) to serve as the SPA shell. Omitted in tests that only exercise the API. */
  clientDistPath?: string;
}

export function createApp(options: AppOptions): Express {
  const {
    authHandler,
    allowList: allowListConfig,
    cookieSecret,
    supportedLocales = ["en", "he"],
    fallbackLocale = "en",
    db,
    doctorsParentTagName = "Doctors",
    clientDistPath,
  } = options;
  const allowList = new AllowList(allowListConfig);

  const app = express();
  app.locals.db = db;
  app.use(helmet());
  app.use(express.json());
  app.use(cookieParser(cookieSecret));

  const auth = new Auth(authHandler);
  app.use((req, res, next) => auth.auth(req, res, next));
  app.use(allowListMiddleware(allowList));

  app.get("/api/user", (req, res) => {
    // Defensive: every current IAuthHandler sets req.userName before
    // calling next() for an /api/* request, so this is unreachable today
    // — but a future/misbehaving handler that doesn't would otherwise
    // leak a 200 with an empty identity instead of a clean 401.
    if (!req.userName) {
      return res.status(401).json({ error: "Unauthenticated" });
    }
    res.json({
      userId: req.userId,
      userName: req.userName,
      locale: resolveLocale({
        userName: req.userName,
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

  if (db) {
    const doctors = new Doctors(db, doctorsParentTagName);
    app.get("/api/doctors", (_req, res) => {
      res.json(doctors.list());
    });
    app.post("/api/doctors", (req, res) => {
      try {
        res.status(201).json(doctors.create(req.body));
      } catch (err) {
        if (err instanceof InvalidDoctorInputError) return res.status(400).json({ error: err.message });
        throw err;
      }
    });
    app.get("/api/doctors/:id", (req, res) => {
      const doctor = doctors.get(Number(req.params.id));
      if (!doctor) return res.status(404).json({ error: "Not found" });
      res.json(doctor);
    });
    app.put("/api/doctors/:id", (req, res) => {
      try {
        res.json(doctors.update(Number(req.params.id), req.body));
      } catch (err) {
        if (err instanceof DoctorNotFoundError) return res.status(404).json({ error: "Not found" });
        if (err instanceof InvalidDoctorInputError) return res.status(400).json({ error: err.message });
        throw err;
      }
    });
  }

  app.get("/api/logout", (req, res) => {
    // Both stores: the auth cookies (x-token-user, x-access-token) are
    // signed, so cookie-parser puts them in req.signedCookies, not
    // req.cookies — clearing only the latter left them behind.
    const cookieNames = new Set([...Object.keys(req.cookies ?? {}), ...Object.keys(req.signedCookies ?? {})]);
    for (const name of cookieNames) {
      res.clearCookie(name);
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
