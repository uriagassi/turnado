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
import { Appointments, AppointmentNotFoundError, InvalidAppointmentInputError } from "./appointments/Appointments.js";
import { selectHeroAppointment } from "./appointments/heroAppointment.js";
import { Tasks, TaskNotFoundError, InvalidTaskInputError, TaskStatus } from "./tasks/Tasks.js";
import {
  Documents,
  DocumentNotFoundError,
  InvalidDocumentInputError,
  DocumentCreateInput,
  DocumentSearchFilters,
  DocumentType,
  UploadedFile,
} from "./documents/Documents.js";
import crypto from "node:crypto";
import convert from "heic-convert";

async function normalizeImageBuffer(
  buffer: Buffer,
  filename: string,
  mimetype: string,
): Promise<{ buffer: Buffer; filename: string; mime: string }> {
  if (/\.(heic|heif)$/i.test(filename) || mimetype === "image/heic" || mimetype === "image/heif") {
    try {
      const converted = await convert({
        buffer,
        format: "JPEG",
        quality: 0.9,
      });
      const ext = path.extname(filename);
      const base = ext ? filename.slice(0, -ext.length) : filename;
      return {
        buffer: Buffer.from(converted),
        filename: `${base}.jpg`,
        mime: "image/jpeg",
      };
    } catch {
      // Fall back to original if conversion fails
    }
  }
  return { buffer, filename, mime: mimetype };
}

export interface AppOptions {
  authHandler: IAuthHandler;
  allowList: AllowListConfig;
  /** Signs the auth cookies (see auth/cookies.ts) so a client can't forge req.userName by sending an arbitrary cookie. */
  cookieSecret: string;
  supportedLocales?: string[];
  fallbackLocale?: string;
  /** The shared DB connection (WAL + busy_timeout already applied — see db.ts). */
  db?: Database;
  /** Shared tag every newly-created doctor tag nests under (see Doctors.ts). Only matters when db is set. */
  doctorsParentTagName?: string;
  /** Directory doctor photo uploads are written to (see POST /api/doctors/:id/photo). Only matters when db is set. */
  photosDir?: string;
  /** Dedicated notebook ID for medical documents in the shared DB. */
  medicalNotebookId?: number;
  /** Dedicated notebook name (e.g. "Medical") for medical documents in the shared DB. */
  medicalNotebookName?: string;
  /** Parent tag for document types (e.g. medical/document-type). */
  documentTypeParentTagName?: string;
  /** Parent tag for specialties (e.g. medical/specialty). */
  specialtyParentTagName?: string;
  /** Directory where document attachments are stored. */
  attachmentsDir?: string;
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
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          "object-src": ["'self'", "blob:"],
          "frame-src": ["'self'", "blob:"],
          "img-src": ["'self'", "data:", "blob:"],
        },
      },
    }),
  );
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

  if (!db) {
    // No shared DB configured: openItems/recentDocuments still await
    // issues #5/#6, and there's nowhere to read an appointment from either.
    app.get("/api/home", (_req, res) => {
      res.json({ nextAppointment: null, openItems: [], recentDocuments: [] });
    });
  }

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
      // Serves back what the route below stores — "managed directly by this
      // app on disk" means this app is also the one returning the bytes,
      // not just recording where they went.
      app.use("/photos", express.static(photosDir));
      // Writes straight to disk under photosDir; the doctor's photoPath
      // column (set below) just remembers the resulting filename.
      // Deliberately not routed through the sibling app's shared Attachment
      // system — see Doctors.ts on why a doctor's photo is this app's own
      // file, not a shared-system one.
      const upload = multer({
        storage: multer.memoryStorage(),
        limits: { fileSize: 8 * 1024 * 1024 },
        fileFilter: (_req, file, cb) => {
          const isImage =
            file.mimetype.startsWith("image/") ||
            /\.(jpe?g|png|webp|gif|svg|avif|heic|heif|bmp|tiff)$/i.test(file.originalname);
          cb(null, isImage);
        },
      });
      app.post("/api/doctors/:id/photo", upload.single("photo"), async (req, res) => {
        // fileFilter rejecting the file and no file being attached at all
        // both surface here as a missing req.file — both are "no valid
        // photo was uploaded" from the caller's point of view.
        if (!req.file) return res.status(400).json({ error: "photo is required" });
        try {
          const normalized = await normalizeImageBuffer(req.file.buffer, req.file.originalname, req.file.mimetype);
          const ext = path.extname(normalized.filename) || ".jpg";
          const finalFilename = `${req.params.id}-${Date.now()}${ext}`;
          fs.writeFileSync(path.join(photosDir, finalFilename), normalized.buffer);

          const previous = doctors.get(Number(req.params.id));
          const updated = doctors.setPhoto(Number(req.params.id), finalFilename);
          // Now that the new file is safely recorded, remove the one it
          // replaces so this app's disk storage doesn't accumulate orphans.
          if (previous?.photoPath) fs.rmSync(path.join(photosDir, previous.photoPath), { force: true });
          res.json(updated);
        } catch (err) {
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

    const appointments = new Appointments(db);
    app.get("/api/appointments", (_req, res) => {
      res.json(appointments.list());
    });
    app.post("/api/appointments", (req, res) => {
      try {
        res.status(201).json(appointments.create(req.body));
      } catch (err) {
        if (err instanceof InvalidAppointmentInputError) return res.status(400).json({ error: err.message });
        throw err;
      }
    });
    app.get("/api/appointments/:id", (req, res) => {
      const appointment = appointments.get(Number(req.params.id));
      if (!appointment) return res.status(404).json({ error: "Not found" });
      res.json(appointment);
    });
    app.put("/api/appointments/:id", (req, res) => {
      try {
        const updated = appointments.update(Number(req.params.id), req.body);
        documents.syncDoctorTagsForAppointment(Number(req.params.id));
        res.json(updated);
      } catch (err) {
        if (err instanceof AppointmentNotFoundError) return res.status(404).json({ error: "Not found" });
        if (err instanceof InvalidAppointmentInputError) return res.status(400).json({ error: err.message });
        throw err;
      }
    });
    app.put("/api/appointments/:id/status", (req, res) => {
      try {
        res.json(appointments.setStatus(Number(req.params.id), req.body.status));
      } catch (err) {
        if (err instanceof AppointmentNotFoundError) return res.status(404).json({ error: "Not found" });
        throw err;
      }
    });
    app.put("/api/appointments/:id/summary", (req, res) => {
      try {
        res.json(appointments.setSummary(Number(req.params.id), req.body.summary));
      } catch (err) {
        if (err instanceof AppointmentNotFoundError) return res.status(404).json({ error: "Not found" });
        throw err;
      }
    });

    const tasks = new Tasks(db);
    app.get("/api/tasks", (req, res) => {
      const doctorId = req.query.doctorId !== undefined ? Number(req.query.doctorId) : undefined;
      const status = req.query.status as TaskStatus | undefined;
      res.json(tasks.list({ doctorId, status }));
    });
    app.post("/api/tasks", (req, res) => {
      try {
        res.status(201).json(tasks.create(req.body));
      } catch (err) {
        if (err instanceof InvalidTaskInputError) return res.status(400).json({ error: err.message });
        throw err;
      }
    });
    app.get("/api/tasks/:id", (req, res) => {
      const task = tasks.get(Number(req.params.id));
      if (!task) return res.status(404).json({ error: "Not found" });
      res.json(task);
    });
    app.put("/api/tasks/:id", (req, res) => {
      try {
        const updated = tasks.update(Number(req.params.id), req.body);
        documents.syncDoctorTagsForTask(Number(req.params.id));
        res.json(updated);
      } catch (err) {
        if (err instanceof TaskNotFoundError) return res.status(404).json({ error: "Not found" });
        if (err instanceof InvalidTaskInputError) return res.status(400).json({ error: err.message });
        throw err;
      }
    });
    app.put("/api/tasks/:id/status", (req, res) => {
      try {
        res.json(tasks.setStatus(Number(req.params.id), req.body.status));
      } catch (err) {
        if (err instanceof TaskNotFoundError) return res.status(404).json({ error: "Not found" });
        if (err instanceof InvalidTaskInputError) return res.status(400).json({ error: err.message });
        throw err;
      }
    });
    app.put("/api/tasks/:id/pending-appointment", (req, res) => {
      try {
        const taskId = Number(req.params.id);
        const pendingAppointmentId =
          req.body.pendingAppointmentId !== undefined && req.body.pendingAppointmentId !== null
            ? Number(req.body.pendingAppointmentId)
            : null;

        const appt = pendingAppointmentId ? appointments.get(pendingAppointmentId) ?? null : null;
        res.json(tasks.resolveWithAppointment(taskId, appt));
      } catch (err) {
        if (err instanceof TaskNotFoundError) return res.status(404).json({ error: "Not found" });
        throw err;
      }
    });

    const {
      medicalNotebookId = 0,
      medicalNotebookName,
      documentTypeParentTagName = "medical/document-type",
      specialtyParentTagName = "medical/specialty",
      attachmentsDir,
    } = options;

    if (attachmentsDir) {
      fs.mkdirSync(attachmentsDir, { recursive: true });
      app.use("/api/body/attachments", express.static(attachmentsDir));
      app.use("/attachments", express.static(attachmentsDir));
    }

    const documents = new Documents(db, {
      medicalNotebookId,
      medicalNotebookName,
      documentTypeParentTagName,
      doctorsParentTagName,
      specialtyParentTagName,
    });

    const docUpload = multer({
      storage: multer.memoryStorage(),
      limits: { fileSize: 20 * 1024 * 1024 },
    });

    app.post("/api/documents", docUpload.single("file"), async (req, res) => {
      if (!req.file) {
        return res.status(400).json({ error: "file is required" });
      }

      let originalName = req.file.originalname;
      try {
        const decoded = Buffer.from(req.file.originalname, "latin1").toString("utf8");
        if (!/[\uFFFD]/.test(decoded)) {
          originalName = decoded;
        }
      } catch {
        // keep originalName
      }

      const normalized = await normalizeImageBuffer(req.file.buffer, originalName, req.file.mimetype);

      const hash = crypto.createHash("sha256").update(normalized.buffer).digest("hex");
      const ext = path.extname(normalized.filename) || "";
      const baseSafeName = path.basename(normalized.filename, ext).replace(/[^a-zA-Z0-9_-]/g, "_");
      const uniqueFilename = `${hash}_${baseSafeName}${ext}`;

      if (attachmentsDir) {
        fs.writeFileSync(path.join(attachmentsDir, uniqueFilename), normalized.buffer);
      }

      const uploadedFile: UploadedFile = {
        fileName: normalized.filename,
        uniqueFilename,
        mime: normalized.mime || "application/octet-stream",
        hash,
        size: normalized.buffer.length,
      };

      const input: DocumentCreateInput = {
        title: req.body.title,
        type: req.body.type as DocumentType,
        documentDate: req.body.documentDate || null,
        doctorId: req.body.doctorId ? Number(req.body.doctorId) : null,
        notes: req.body.notes || null,
        appointmentIds: parseIdList(req.body.appointmentIds),
        taskIds: parseIdList(req.body.taskIds),
      };

      try {
        const created = documents.create(input, uploadedFile);
        if (created.type === "appointment invitation") {
          linkInvitationToFormSeventeen(created);
        }
        res.status(201).json(documents.get(created.id));
      } catch (err) {
        if (err instanceof InvalidDocumentInputError) return res.status(400).json({ error: err.message });
        throw err;
      }
    });

    // AC (#8): uploading an appointment-invitation document that's linked to
    // an appointment auto-creates the "Form 17 to obtain" task for it — no
    // separate manual step, and the task links back to the invitation.
    function linkInvitationToFormSeventeen(invitation: { id: number; appointmentIds: number[] }): void {
      for (const appointmentId of invitation.appointmentIds) {
        const appointment = appointments.get(appointmentId);
        if (!appointment) continue;
        const doctor = appointment.doctorId ? doctors.get(appointment.doctorId) : undefined;
        const form17Task = tasks.create({
          type: "form_17",
          title: doctor ? `Form 17 for ${doctor.name}` : "Form 17",
          doctorId: appointment.doctorId,
          sourceAppointmentId: appointment.id,
        });
        documents.linkTask(invitation.id, form17Task.id);
      }
    }

    app.get("/api/documents", (req, res) => {
      if (req.query.taskId !== undefined) {
        res.json(documents.listByTask(Number(req.query.taskId)));
      } else if (req.query.appointmentId !== undefined) {
        res.json(documents.listByAppointment(Number(req.query.appointmentId)));
      } else if (
        req.query.doctorId !== undefined ||
        req.query.type !== undefined ||
        req.query.query !== undefined ||
        req.query.dateFrom !== undefined ||
        req.query.dateTo !== undefined
      ) {
        const filters: DocumentSearchFilters = {
          doctorId: req.query.doctorId !== undefined ? Number(req.query.doctorId) : undefined,
          type: req.query.type as DocumentType | undefined,
          query: req.query.query as string | undefined,
          dateFrom: req.query.dateFrom as string | undefined,
          dateTo: req.query.dateTo as string | undefined,
        };
        res.json(documents.search(filters));
      } else {
        res.json(documents.list());
      }
    });

    app.get("/api/documents/:id", (req, res) => {
      const doc = documents.get(Number(req.params.id));
      if (!doc) return res.status(404).json({ error: "Not found" });
      res.json(doc);
    });

    app.get("/api/home", (_req, res) => {
      const openItems = tasks.list().filter((t) => t.status !== "done");
      res.json({
        nextAppointment: selectHeroAppointment(appointments.list(), new Date()),
        openItems,
        recentDocuments: documents.listRecent(5),
      });
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

function parseIdList(raw: unknown): number[] | undefined {
  if (!raw) return undefined;
  if (Array.isArray(raw)) return raw.map(Number);
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(Number);
    } catch {
      // Fall through to comma-separated string
    }
    return raw
      .split(",")
      .map((s: string) => Number(s.trim()))
      .filter((n: number) => !isNaN(n) && n > 0);
  }
  return undefined;
}

