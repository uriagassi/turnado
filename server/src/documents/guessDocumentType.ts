import type { DocumentType } from "./Documents.js";

/**
 * Keyword → DocumentType, checked in order (first match wins) against a
 * candidate's free-text title. Bilingual (en/he), same scope as
 * DEFAULT_TITLE_KEYWORDS in DocumentAdoption.ts. Deliberately a plain
 * substring match, not NLP — a human confirms or corrects every guess
 * before anything commits (issue #14), so a wrong guess costs one click,
 * not a bad write.
 */
const TYPE_KEYWORDS: [pattern: RegExp, type: DocumentType][] = [
  [/form\s*17|טופס\s*17/i, "Form 17"],
  [/referral|הפניה/i, "referral"],
  [/approval|אישור/i, "approval"],
  [/invitation|זימון/i, "appointment invitation"],
  [/result|blood test|x-ray|mri|בדיקה|רנטגן|תוצא/i, "test result"],
  [/letter|מכתב/i, "letter"],
];

/** Proposes a DocumentType for an adoption candidate by keyword-matching its title (issue #14); defaults to "other" when nothing matches. */
export function guessDocumentType(title: string): DocumentType {
  for (const [pattern, type] of TYPE_KEYWORDS) {
    if (pattern.test(title)) return type;
  }
  return "other";
}
