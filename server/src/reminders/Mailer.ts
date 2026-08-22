import nodemailer from "nodemailer";
import type { ReminderEmailContent } from "./reminderEmail.js";

/** What ReminderService sends through — one email per due item, per recipient. */
export interface Mailer {
  send(to: string, content: ReminderEmailContent): Promise<void>;
}

/**
 * The slice of nodemailer's Transporter this adapter actually calls,
 * narrowed so tests can inject a stub instead of a real SMTP connection —
 * this repo has no live SMTP credentials in CI (issue #10, decision 1).
 */
export interface MailTransport {
  sendMail(options: { from: string; to: string; subject: string; text: string }): Promise<unknown>;
}

export interface MailTransportConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
}

/**
 * Thin Mailer adapter over nodemailer + Gmail SMTP (issue #10, decision 1).
 * The transport is injected rather than built internally, so this class
 * stays testable with a stub — see createNodemailerTransport() below for
 * the real one, built once at server startup from config's mail.* block.
 */
export class NodemailerMailer implements Mailer {
  private readonly transport: MailTransport;
  private readonly from: string;

  constructor(transport: MailTransport, from: string) {
    this.transport = transport;
    this.from = from;
  }

  /** Plain-text only (reminderEmail.ts never produces HTML) — propagates a transport failure rather than swallowing it, since ReminderService's markFailed/retry logic depends on seeing it. */
  async send(to: string, content: ReminderEmailContent): Promise<void> {
    await this.transport.sendMail({ from: this.from, to, subject: content.subject, text: content.body });
  }
}

/**
 * Builds the real nodemailer transport from config's mail.* block — Gmail
 * requires STARTTLS on port 587 with an app password, not implicit TLS
 * (issue #10, decision 1), hence `secure: false` even though this isn't a
 * cleartext connection.
 */
export function createNodemailerTransport(config: MailTransportConfig): MailTransport {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: false,
    auth: { user: config.user, pass: config.pass },
  });
}
