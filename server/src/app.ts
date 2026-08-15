import fs from "node:fs";
import path from "node:path";
import express, { Express } from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import multer from "multer";
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
  /** Directory doctor photo uploads are written to (see POST /api/doctors/:id/photo). Only matters when db is set. */
  photosDir?: string;
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
    photosDir,
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

    // Only registered when photosDir is actually configured — without it
    // there's nowhere on disk this app can durably own the file, so the
    // route doesn't exist rather than silently falling back to the
    // process's cwd.
    if (photosDir) {
      fs.mkdirSync(photosDir, { recursive: true });
      // Writes straight to disk under photosDir; the doctor's photoPath
      // column (set below) just remembers the resulting filename.
      // Deliberately not routed through the sibling app's shared Attachment
      // system — see Doctors.ts on why a doctor's photo is this app's own
      // file, not a shared-system one.
      const upload = multer({
        storage: multer.diskStorage({
          destination: (_req, _file, cb) => cb(null, photosDir),
          filename: (req, file, cb) => cb(null, `${req.params.id}-${Date.now()}${path.extname(file.originalname)}`),
        }),
        limits: { fileSize: 8 * 1024 * 1024 },
        fileFilter: (_req, file, cb) => cb(null, file.mimetype.startsWith("image/")),
      });
      app.post("/api/doctors/:id/photo", upload.single("photo"), (req, res) => {
        // fileFilter rejecting the file and no file being attached at all
        // both surface here as a missing req.file — both are "no valid
        // photo was uploaded" from the caller's point of view.
        if (!req.file) return res.status(400).json({ error: "photo is required" });
        try {
          const previous = doctors.get(Number(req.params.id));
          const updated = doctors.setPhoto(Number(req.params.id), req.file.filename);
          // Now that the new file is safely recorded, remove the one it
          // replaces so this app's disk storage doesn't accumulate orphans.
          if (previous?.photoPath) fs.rmSync(path.join(photosDir, previous.photoPath), { force: true });
          res.json(updated);
        } catch (err) {
          // The file's already been written by multer before this handler
          // runs — clean it up rather than leaving an orphan for a doctor
          // that turned out not to exist.
          fs.rmSync(req.file.path, { force: true });
          if (err instanceof DoctorNotFoundError) return res.status(404).json({ error: "Not found" });
          throw err;
        }
      });
      // multer's own errors (e.g. fileSize over the limit) reject the
      // upload before the route handler above ever runs, so they need
      // their own translation to a 400 here instead of crashing to a 500.
      app.use("/api/doctors/:id/photo", (err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
        if (err instanceof multer.MulterError) return res.status(400).json({ error: err.message });
        next(err);
      });
    }
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
