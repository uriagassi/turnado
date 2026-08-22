/** The subset of Doctor fields title-parsing actually needs — decoupled from the full Doctor shape so callers (DocumentAdoption) don't have to construct one. */
export interface NamedDoctor {
  id: number;
  name: string;
}

/**
 * Fallback half of the doctor guess the AC calls for (issue #14): "an
 * attempt at parsing the free-text title" when the candidate carries no
 * existing doctor-tag (see DocumentAdoption.ts, which tries the tag first).
 * A plain substring match, same "cheap heuristic, human confirms" spirit
 * as guessDocumentType.ts — the first known doctor whose name appears in
 * the title wins.
 */
export function guessDoctorFromTitle<T extends NamedDoctor>(title: string, doctors: T[]): T | null {
  return doctors.find((d) => title.includes(d.name)) ?? null;
}
