# Handover: issue #14 "Existing document adoption tool" — COMPLETE

**Branch:** `document-adoption-issue-14` (branched off `main`; not pushed, not yet merged)
**GitHub issue:** [uriagassi/turnado#14](https://github.com/uriagassi/turnado/issues/14) (`ready-for-agent`)
**Workflow:** built with `/tdd` — one seam at a time, red→green, `/code-review` (Standards + Spec) after each slice, plus a final whole-branch pass.

## What the ticket wants

Historical medical documents already sitting in the household's shared document archive become reviewable and promotable into this app's Document model, as a one-time, stoppable working session — not a permanent app feature, not a blind automated script. Full AC is in the issue. **All of it is implemented.**

## Decisions made this session (not spelled out in the bare issue text — authoritative)

Confirmed with the user before writing any tests:

1. **Ownership signal**: the existing archive tags a Note's owner with a `"person/<display name>"` tag, predating this app. `AllowListEntry` gained an optional `personTagName` field (username → that display name); `AllowList.personTagNames()` returns the in-scope set. Tag names are globally unique in the shared `Tags` table (a real unique index), so a person tag is matched by bare name, not by parent path.
2. **Adoption target**: promoting a Note moves it into this app's dedicated Medical notebook (`Notes.notebookId = medicalNotebookId`) — same place `Documents.create()` already writes to — rather than leaving it in its original notebook. This is what makes `Documents.get()`/`list()`/`search()` (all notebookId-filtered) find an adopted Note at all.
3. **Delivery**: a CLI script (`scripts/adoptDocuments.ts`, run via `npx tsx`), not an in-app screen — matches the issue's explicit "script/CLI or minimal internal screen" choice and this repo's existing `scripts/seedDemo.ts` convention.
4. **Type guessing**: keyword-matching the title (bilingual en/he), defaulting to `"other"` — the AC only specifies the doctor-guess mechanism explicitly, not the type-guess one.

## What's done — all 7 seams

1. **`AllowList.personTagName`** ([server/src/auth/AllowList.ts](../server/src/auth/AllowList.ts)) — config field + `personTagNames()` accessor.
2. **`DocumentAdoption.discoverCandidates()`** ([server/src/documents/DocumentAdoption.ts](../server/src/documents/DocumentAdoption.ts)) — unions the "medical" tag-subtree source (via `SharedTags.descendantIds()`, recursive) and the title-keyword source, filtered to in-scope owners and not-yet-adopted Notes, newest-first.
3. **Proposal logic** — `guessDocumentType()` ([server/src/documents/guessDocumentType.ts](../server/src/documents/guessDocumentType.ts)), `guessDoctorFromTitle()` ([server/src/documents/guessDoctor.ts](../server/src/documents/guessDoctor.ts)), and `DocumentAdoption.guessDoctorId()` (existing doctor-tag wins first, else title parsing).
4. **`Documents.adopt()`** ([server/src/documents/Documents.ts](../server/src/documents/Documents.ts)) — the commit primitive: moves the Note into the Medical notebook, tags its type, writes `DocumentMeta`, syncs the doctor's transitive tag. Guards against an unknown noteId or a Note already adopted.
5. **`scripts/adoptDocuments.ts`** — the reviewer-facing CLI loop. Per candidate: shows title/date, proposes type + doctor, lets the reviewer accept/override/skip/quit at every prompt, commits immediately per candidate (so quitting mid-session loses nothing already confirmed). Orchestration glue only, untested by design (same convention as `index.ts`) — every primitive it drives is unit-tested.

Along the way: `SharedTags` gained a tested `descendantIds()` method (moved out of `DocumentAdoption` after review flagged a third call site reaching into the shared `Tags` table directly); `expandHome()` was extracted from `index.ts` into `src/paths.ts` for the script to reuse; the type-guess and candidate-discovery keyword lists were unified (`guessDocumentType.ts` exports `ALL_TYPE_KEYWORD_TERMS`) after a whole-branch review caught them drifting apart.

Full suite: **240/240 green**, typecheck clean (one pre-existing unrelated `heic-convert` error, not touched by this work — same as every prior issue's handover notes).

## Before this ships

- **`config/local.json` needs real `personTagName` values.** Both `config/default.json` placeholders are `"REPLACE_ME"`; until the two allow-listed users' entries get the actual `"person/<display name>"` tag names used in the real archive, `scripts/adoptDocuments.ts` finds no candidates (verified: it exits safely with no writes in this state, not an error).
- Run `npx tsx scripts/adoptDocuments.ts` from the repo root once that's filled in. It's interactive and manual — no server wiring, no scheduled job.

## Resuming

Nothing left to implement. Not yet pushed or opened as a PR — confirm with the user before doing so (same as issue #10's handover).
