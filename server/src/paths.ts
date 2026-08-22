import path from "node:path";

/** Expands a leading `~` to the current user's home directory (config paths like `db.path`/`doctors.photosDir` are written this way for portability across machines). Shared by index.ts and scripts/adoptDocuments.ts (issue #14) — was a private index.ts helper until a second call site needed it. */
export function expandHome(p: string): string {
  if (p.startsWith("~")) {
    return path.join(process.env.HOME ?? process.env.USERPROFILE ?? "", p.slice(1));
  }
  return p;
}
