# Handover: issue #10 "Reminders"

**Branch:** `reminders-issue-10` (branched off `main`, not pushed)
**Latest commit:** `7af6548` — "Reminders (#10): email content builder with server-side localization"
**GitHub issue:** [uriagassi/turnado#10](https://github.com/uriagassi/turnado/issues/10) (assigned, `ready-for-agent`)
**Workflow:** built with `/tdd` — one seam at a time, red→green, `/code-review` (Standards + Spec axes) after each slice.

## What the ticket wants

A user gets a one-day-ahead email reminder for anything with a date (appointment, or task due date), with a visible "missed" marker in the app if a reminder ever failed to go out. Full AC is in the issue; email delivery (sending, not content), UI marker, and poll wiring are not yet touched — see "What's left" below.

## Decisions made this session (not fully spelled out in the bare issue text)

These are as authoritative as the issue itself — a future session shouldn't re-litigate them without cause:

1. **Mail transport:** nodemailer + Gmail SMTP via the existing `mail.*` config block in `config/default.json`. Gmail requires a 16-char **App Password** (2FA must be on) as `mail.pass`, not the real account password — plain SMTP auth with the account password is blocked by Google. `mail.host` should be `smtp.gmail.com`, `mail.port` 587 (STARTTLS).
2. **Recipients:** not a single household `mail.to`. Instead, `security.allowList` was widened from `{username: locale}` to `{username: {locale, email}}` — every allow-listed user gets their own reminder emails at their own address (`AllowList.emailFor()`). The reminder service (not yet built) should iterate every allow-listed user and email each.
3. **Timezone:** "due tomorrow" is computed via an explicit household timezone (`config/reminders.timezone`, default `"Asia/Jerusalem"`), not the server process's own tz and not per-recipient — the dedup key `(itemType, itemId, targetDate)` has no per-user slot, so one shared "today" has to apply to everyone. See `dueReminders.ts`'s JSDoc for the reasoning. The same household timezone is used to render an appointment's date/time in the reminder email body (seam 4) — but not a task's due date, see decision 4.
4. **`Task.dueDate` needs no remodeling** — confirmed already a bare `YYYY-MM-DD` string end-to-end (`client/src/screens/TaskFormScreen.tsx` uses `<input type="date">`), no time-of-day component to worry about. Only the appointment side (real date+time) and the `now` reference needed timezone-awareness. Seam 4 formats a task's due date as UTC, not the household timezone, precisely because there's no time-of-day component to convert — converting a bare calendar date through a timezone would risk shifting the displayed day.
5. **`ReminderLog` can't derive "window closed before delivery" on its own** — that missed-reason applies to items the log never saw a single attempt for (server down for the item's entire 1-day-ahead window), and by the time such an item's date has passed, `selectDueReminders` no longer surfaces it, so no row was ever created. Seam 5 (`ReminderService`) will have to detect that case itself — cross-referencing live appointments/tasks against the log — and call `ReminderLog.markMissed(..., "window closed before delivery")` directly. `ReminderLog.sweepMissed()` only auto-derives the other reason, "send failed", for rows it already has (a pending row implies at least one attempt). Confirmed with the user before writing seam 3's tests.
6. **Reminder emails are localized (en/he), reusing the client's locale catalogs** — not English-only. No server-side translation mechanism existed before seam 4; `server/src/i18n/translate.ts` reads `client/src/locales/{en,he}.json` directly via `fs` (cross-workspace, but stable since the server runs from source via `tsx` with no build step) rather than growing a second copy of the app's strings. Confirmed with the user before writing seam 4's tests, alongside the content-builder's input shape (see seam 4 below).

## What's done (seams 1–4 of the plan)

**Seam 1 — `selectDueReminders`** ([server/src/reminders/dueReminders.ts](../server/src/reminders/dueReminders.ts), [server/test/dueReminders.test.ts](../server/test/dueReminders.test.ts), 7 tests)
Pure function `(appointments, tasks, now, timezone) → DueReminder[]`, each `{itemType, itemId, targetDate}` — the exact dedup-key shape the AC calls for. Covers: planned appointment / open-or-in-progress task exactly one day out; excludes same-day, two-days-out, wrong status (cancelled/done), a task with no due date; and a dedicated timezone-boundary regression test (an item that's "tomorrow" in Asia/Jerusalem but not in UTC).

**Seam 2 — `AllowList` widening** ([server/src/auth/AllowList.ts](../server/src/auth/AllowList.ts), [server/test/allowList.test.ts](../server/test/allowList.test.ts))
`AllowListConfig` is now `Record<string, {locale, email}>`; `AllowList` gained `emailFor()` alongside the existing `isAllowed()`/`localeFor()` (behavior unchanged for every existing caller — verified in review). `config/default.json`'s `security.allowList` entries got `"email": "REPLACE_ME"` placeholders — **need real addresses before this goes live**. Six test fixture files were migrated to the new shape; a shared `test/support/allowListFixture.ts` (`singleUserAllowList()`, `twoUserAllowList()`) was extracted afterward to stop the same one-line edit needing six files.

Seams 1–2 passed `/code-review` (Standards + Spec) with fixes applied: `AllowList`'s class docstring updated to mention all three concerns, and the fixture-duplication smell resolved via the helper above.

**Seam 3 — `ReminderLog`** ([server/src/reminders/ReminderLog.ts](../server/src/reminders/ReminderLog.ts), [server/test/reminderLog.test.ts](../server/test/reminderLog.test.ts), 12 tests)
DB-backed dedup/retry/missed ledger, keyed on `(itemType, itemId, targetDate)`, same constructor-owns-its-table pattern as `Tasks`/`Appointments`. Public seam, confirmed with the user before writing tests:
- `find`, `markFailed` (creates-or-increments `attempts`, stays `pending`), `markSent` (terminal), `markMissed(reason)` (terminal, explicit reason).
- `sweepMissed(today)` auto-transitions past-due `pending` rows to `missed`/`"send failed"` — the one reason this log can derive from its own data.
- `"window closed before delivery"` is left to seam 5 to detect and call `markMissed()` for directly — see decision 5 above.
- `pending()`/`missed()` are the read seams seam 5 (send loop) and seam 6 (route marker) will consume.
- Every write is guarded (`WHERE status = 'pending'` on the upsert) so `sent`/`missed` are actually terminal — a stray call on an already-terminal key is a no-op, not a silent flip back.

Passed `/code-review` (Standards + Spec) with fixes applied: `id` field added to `ReminderLogEntry` (was missing despite the row having one — a Tasks.ts convention mismatch), the terminal-status guard above (a real bug the Spec review caught — nothing previously stopped a terminal row from being overwritten), the write-then-refetch duplication collapsed into one `runAndFetch` helper, and a multi-retry-then-missed test added to close a partial-coverage gap. Judgement-call smells left alone: the three near-identical upsert SQL strings, and the `(itemType, itemId, targetDate)` data clump repeated across 4 method signatures — introducing a `ReminderKey` type would touch a signature the user had just confirmed, so left for a future slice if it starts to actually hurt.

**Seam 4 — email content builder** ([server/src/reminders/reminderEmail.ts](../server/src/reminders/reminderEmail.ts), [server/src/i18n/translate.ts](../server/src/i18n/translate.ts), [server/test/reminderEmail.test.ts](../server/test/reminderEmail.test.ts), [server/test/translate.test.ts](../server/test/translate.test.ts), 10 tests)
`buildReminderEmail(item: ReminderEmailItem, locale, timezone) → {subject, body}`, pure. `ReminderEmailItem` carries the actual `Appointment`/`Task` record plus a caller-resolved `doctorName: string | null` — doctor lookup by id stays in the service layer (seam 5), same division of labor `dueReminders.ts` already uses for the DB itself. Appointment body: doctor/date+time (household timezone)/location (omitted if unset, not shown as "null")/notes. Task body: type/description/due date (UTC, see decision 4)/doctor. Throws loudly if handed a task with no due date, rather than silently formatting the Unix epoch — that case should be structurally unreachable once seam 5 exists (per decision 4/seam 1's AC), so a thrown error surfaces a caller bug instead of masking it. `translate.ts` (decision 6) does i18next-style `{{var}}` interpolation with an English fallback, reading `client/src/locales/{en,he}.json`; 5 new keys added to both catalogs under a `reminder.*` prefix, reusing existing `appointmentForm.*`/`taskForm.*`/`taskDetail.*`/`task.type.*` keys for anything already labeled elsewhere in the app.

Passed `/code-review` (Standards + Spec) with fixes applied: extracted the doctor-fallback and `label: value` line-building duplication into two small helpers, trimmed a comment that overstated the case against a static JSON import, and fixed two real bugs the Spec review caught — a null `appointment.location` rendering the literal string `"Location: null"`, and a `task.dueDate!` non-null assertion that would have silently formatted the Unix epoch instead of failing loudly.

Full suite: **171/171 green**, typecheck clean (one pre-existing unrelated `heic-convert` error, not touched by this work).

## What's left (seams 5–7, per the plan confirmed with the user)

5. **`ReminderService.runOnce()`** — orchestrates seams 1(done)+3(done)+4(done): derive due items, resolve each item's doctor name via `Doctors`, check the log for dedup, call an injected mailer (nodemailer wrapper per decision 1) for every allow-listed user's email (per decision 2) with the content from `buildReminderEmail` (locale per-recipient via `AllowList.localeFor()`), update the log via `markSent`/`markFailed`. Also: sweep past-due entries (`ReminderLog.sweepMissed()`), and separately detect+mark the "window closed before delivery" case per decision 5 (items whose date has passed with zero log history — needs a query beyond `selectDueReminders`, likely a small addition alongside it or a new function in `dueReminders.ts`). Mailer and clock injected so this is testable without real SMTP or real time.
6. **Route-level exposure of the "missed" marker** — e.g. `GET /api/appointments`/`/api/tasks` (or `/api/home`) including a `missedReminder` flag + reason, sourced from `ReminderLog.missed()`, tested via `supertest` like the existing `*Routes.test.ts` files.
7. **Server wiring + client badge** — hourly `setInterval` + run-on-startup in `index.ts`/`app.ts`, and a small marker component in the client, tappable/hoverable for the exact reason. Mostly glue, minimal new tests expected.

## Before this ships

- Fill in real email addresses in `config/local.json` (gitignored) for `security.allowList.*.email` and the `mail.*` SMTP block — `config/default.json` only has placeholders.
- Generate a Gmail App Password for whichever account sends the mail.
- Add `nodemailer` (+ `@types/nodemailer`) as a server dependency when building seam 5 — not yet added.

## Resuming

Pick up with `/tdd` — seam 5 (`ReminderService.runOnce()`) is next. The seam-by-seam plan above was confirmed with the user; no need to re-ask about mail transport, recipients, timezone, the "window closed before delivery" split, or email localization (decisions 1–6 above are settled). Re-run `/code-review` (fixed point: `main`, or `origin/main` if still unpushed) after each new slice, same as seams 1–4.
