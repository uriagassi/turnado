// Small readline/promises helpers shared by the wizard's steps (issue #36).
// Same "Enter accepts the bracketed default" convention as
// scripts/adoptDocuments.ts and paperless.node's own setup_wizard — showing
// a proposed value as the default and letting Enter take it (or any other
// input override it) is how "the deployer can accept, edit, or reject a
// detected default" (issue #36's AC) is satisfied, without a separate
// per-field confirm prompt.
import type { Interface } from "node:readline/promises";

/** Asks `question`, showing `defaultValue` in brackets; an empty (Enter-only) answer falls back to it. */
export async function ask(rl: Interface, question: string, defaultValue: string): Promise<string> {
  const answer = (await rl.question(`${question} [${defaultValue}] `)).trim();
  return answer.length > 0 ? answer : defaultValue;
}

/** Same as ask(), but parses the answer as a number; a non-numeric answer is treated as declining and falls back to defaultValue. */
export async function askNumber(rl: Interface, question: string, defaultValue: number): Promise<number> {
  const answer = await ask(rl, question, String(defaultValue));
  const parsed = Number(answer);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

/** Asks a Y/N question; an empty answer falls back to defaultYes. */
export async function askYesNo(rl: Interface, question: string, defaultYes: boolean): Promise<boolean> {
  const answer = (await rl.question(`${question} [${defaultYes ? "Y/n" : "y/N"}] `)).trim().toUpperCase();
  if (answer === "") return defaultYes;
  return answer === "Y";
}
