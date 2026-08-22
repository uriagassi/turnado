import type { DocumentType } from "./Documents.js";

interface TypeKeywordGroup {
  terms: string[];
  type: DocumentType;
}

/**
 * Terms → DocumentType, checked in order (first match wins) against a
 * candidate's free-text title. Bilingual (en/he), same scope as
 * DocumentAdoption.ts's title-keyword candidate-discovery scan, which
 * reuses ALL_TYPE_KEYWORD_TERMS below rather than hand-maintaining its own
 * separate list (issue #14 review — the two lists drifted out of sync
 * when each slice grew its own). Deliberately a plain substring match,
 * not NLP — a human confirms or corrects every guess before anything
 * commits, so a wrong guess costs one click, not a bad write.
 */
const TYPE_KEYWORD_GROUPS: TypeKeywordGroup[] = [
  { terms: ["form 17", "טופס 17"], type: "Form 17" },
  { terms: ["referral", "הפניה"], type: "referral" },
  { terms: ["approval", "אישור"], type: "approval" },
  { terms: ["invitation", "זימון"], type: "appointment invitation" },
  { terms: ["result", "blood test", "x-ray", "mri", "בדיקה", "רנטגן", "תוצא"], type: "test result" },
  { terms: ["letter", "מכתב"], type: "letter" },
];

/** Every term used to detect a specific document type, flattened — see DocumentAdoption.ts's DEFAULT_TITLE_KEYWORDS. */
export const ALL_TYPE_KEYWORD_TERMS: string[] = TYPE_KEYWORD_GROUPS.flatMap((g) => g.terms);

/** Proposes a DocumentType for an adoption candidate by keyword-matching its title (issue #14); defaults to "other" when nothing matches. */
export function guessDocumentType(title: string): DocumentType {
  const lowerTitle = title.toLowerCase();
  const group = TYPE_KEYWORD_GROUPS.find((g) => g.terms.some((term) => lowerTitle.includes(term.toLowerCase())));
  return group?.type ?? "other";
}
