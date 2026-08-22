// One-time, stoppable review session for adopting historical medical
// documents already sitting in the shared document archive into this app's
// Document model (issue #14). Not a permanent screen — run manually:
//
//   npx tsx scripts/adoptDocuments.ts
//
// Every discovery/guessing/commit primitive this script drives is already
// unit-tested (DocumentAdoption, guessDocumentType, guessDoctorFromTitle,
// Documents.adopt); this file is orchestration glue only — same convention
// as server/src/index.ts's own untested wiring.
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import config from "../server/src/config.js";
import { createDb } from "../server/src/db.js";
import { expandHome } from "../server/src/paths.js";
import { AllowList, type AllowListConfig } from "../server/src/auth/AllowList.js";
import { Documents, VALID_DOCUMENT_TYPES, type DocumentType } from "../server/src/documents/Documents.js";
import { DocumentAdoption } from "../server/src/documents/DocumentAdoption.js";
import { guessDocumentType } from "../server/src/documents/guessDocumentType.js";
import { Doctors } from "../server/src/doctors/Doctors.js";
import { isolate } from "./terminalText.js";

/**
 * Thrown by checkControlAnswer() to unwind reviewOne() when the reviewer
 * quits, skips, or gives unparseable input at any of its three prompts —
 * so every prompt is a real stopping/skip point, not just the first one.
 * Declared before the main flow's loop below, which is what actually
 * triggers reviewOne() — a `class` isn't hoisted the way a `function`
 * declaration is, so this has to already be defined by the time it's
 * first needed, not merely declared somewhere later in the file.
 */
class ReviewControl extends Error {
  constructor(public readonly action: "quit" | "skip") {
    super(action);
  }
}

/** `q`/`s` are recognized at every prompt in reviewOne(), not only the first — issue #14 review: "stop at any point" should hold mid-candidate too. */
function checkControlAnswer(answer: string): void {
  if (answer === "q") throw new ReviewControl("quit");
  if (answer === "s") throw new ReviewControl("skip");
}

const dbPath = expandHome(config.get<string>("db.path"));
const db = createDb(dbPath, config.get<number>("db.busyTimeoutMs"));

const allowListConfig = config.get<AllowListConfig>("security.allowList");
const allowList = new AllowList(allowListConfig);
const personTagNames = allowList.personTagNames();

if (personTagNames.length === 0) {
  console.error(
    "No security.allowList entry has a personTagName configured — nothing is in scope. " +
      "Set personTagName (the archive's \"person/<name>\" tag for that user) in config/local.json first.",
  );
  db.close();
  process.exit(1);
}

const doctorsParentTagName = config.has("doctors.parentTagName")
  ? config.get<string>("doctors.parentTagName")
  : "medical/doctors";
const documents = new Documents(db, {
  medicalNotebookId: config.has("notebook.medicalNotebookId")
    ? config.get<number>("notebook.medicalNotebookId")
    : undefined,
  medicalNotebookName: config.has("notebook.medicalNotebookName")
    ? config.get<string>("notebook.medicalNotebookName")
    : "Medical",
  documentTypeParentTagName: config.has("documents.documentTypeParentTagName")
    ? config.get<string>("documents.documentTypeParentTagName")
    : "medical/document-type",
  doctorsParentTagName,
  specialtyParentTagName: config.has("documents.specialtyParentTagName")
    ? config.get<string>("documents.specialtyParentTagName")
    : "medical/specialty",
});
const doctors = new Doctors(db, doctorsParentTagName);
const adoption = new DocumentAdoption(db, personTagNames);

const candidates = adoption.discoverCandidates();
if (candidates.length === 0) {
  console.log("No candidates found — nothing to review.");
  db.close();
  process.exit(0);
}

const doctorNamesById = new Map(doctors.list().map((d) => [d.id, d.name]));
console.log("Known doctors:");
if (doctors.list().length === 0) {
  console.log("  (none)");
} else {
  // One doctor per line, not one comma-joined line — a Hebrew name mixed
  // inline with "id=", ",", and an English name right after it is exactly
  // the kind of bidi-adjacent-to-ASCII-punctuation line terminals mangle
  // worst (see terminalText.ts).
  for (const d of doctors.list()) {
    console.log(`  ${d.id}: ${isolate(d.name)}`);
  }
}
console.log(`\n${candidates.length} candidate document(s) to review, newest first.\n`);

const rl = readline.createInterface({ input: stdin, output: stdout });

let confirmed = 0;
let skipped = 0;

for (const [index, candidate] of candidates.entries()) {
  const guessedType = guessDocumentType(candidate.title);
  const guessedDoctorId = adoption.guessDoctorId(candidate.noteId, candidate.title);
  const guessedDoctorName = guessedDoctorId !== null ? doctorNamesById.get(guessedDoctorId) : undefined;

  console.log(`\n[${index + 1}/${candidates.length}] Note #${candidate.noteId} (${candidate.createTime})`);
  // No quote marks wrapped directly around the title — with RTL text those
  // routinely get mirrored to the wrong side by the terminal instead of
  // framing it cleanly (see terminalText.ts).
  console.log(`  Title: ${isolate(candidate.title)}`);
  console.log(`  Proposed type: ${guessedType}`);
  console.log(`  Proposed doctor: ${guessedDoctorName ? isolate(guessedDoctorName) : "(none)"}`);

  let quit = false;
  try {
    const typeAnswer = (
      await rl.question(
        `  Type [Enter=${guessedType}, or one of ${[...VALID_DOCUMENT_TYPES].join("/")}, s=skip, q=quit]: `,
      )
    ).trim();
    checkControlAnswer(typeAnswer);
    const type: DocumentType = typeAnswer === "" ? guessedType : (typeAnswer as DocumentType);
    if (!VALID_DOCUMENT_TYPES.has(type)) {
      console.log(`  Unrecognized type "${typeAnswer}" — skipping this candidate.`);
      throw new ReviewControl("skip");
    }

    const doctorAnswer = (
      await rl.question(`  Doctor id [Enter=${guessedDoctorId ?? "none"}, or a doctor id, "none", s, q]: `)
    ).trim();
    checkControlAnswer(doctorAnswer);
    let doctorId: number | null;
    if (doctorAnswer === "") {
      doctorId = guessedDoctorId;
    } else if (doctorAnswer === "none") {
      doctorId = null;
    } else if (Number.isFinite(Number(doctorAnswer))) {
      doctorId = Number(doctorAnswer);
    } else {
      console.log(`  Unrecognized doctor id "${doctorAnswer}" — skipping this candidate.`);
      throw new ReviewControl("skip");
    }

    const dateAnswer = (
      await rl.question(`  Document date [YYYY-MM-DD, Enter to leave blank, s, q]: `)
    ).trim();
    checkControlAnswer(dateAnswer);
    const documentDate = dateAnswer === "" ? null : dateAnswer;

    const adopted = documents.adopt(candidate.noteId, { type, doctorId, documentDate });
    console.log(`  Adopted as Document #${adopted.id}.`);
    confirmed++;
  } catch (err) {
    if (err instanceof ReviewControl) {
      if (err.action === "quit") quit = true;
      else skipped++;
    } else {
      console.log(`  Failed to adopt: ${(err as Error).message}`);
      skipped++;
    }
  }
  if (quit) break;
}

console.log(`\nDone for this session: ${confirmed} adopted, ${skipped} skipped. Re-run to continue with the rest.`);
rl.close();
db.close();
