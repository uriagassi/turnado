import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Deliberately reuses the client's own locale catalogs rather than growing a
// second, server-side copy: this app has exactly one set of user-facing
// strings, the client's `i18next` resources under client/src/locales/, and
// server-generated text (reminder emails, issue #10) is the first thing
// that needs to render any of it outside the browser. Read via fs at module
// load rather than a static JSON import so the cross-workspace reach here
// is explicit at the point of use, not hidden behind an import statement
// that looks like it's pulling from this package — the server runs from
// source via `tsx` with no build step (see server/package.json), so the
// relative path is stable either way; this is a readability choice, not a
// runtime-compatibility one.
const localesDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../client/src/locales",
);

const FALLBACK_LOCALE = "en";

function loadCatalog(locale: string): Record<string, string> {
  return JSON.parse(readFileSync(path.join(localesDir, `${locale}.json`), "utf-8"));
}

const catalogs: Record<string, Record<string, string>> = {
  en: loadCatalog("en"),
  he: loadCatalog("he"),
};

/**
 * Looks up `key` in `locale`'s catalog, falling back to English if the
 * locale or the key isn't found there (mirrors the client i18next config's
 * own `fallbackLng: "en"`), and finally to the bare key if English doesn't
 * have it either — better a visible missing-translation marker in an email
 * than a thrown error mid-send.
 */
export function translate(locale: string, key: string, params?: Record<string, string>): string {
  const catalog = catalogs[locale] ?? catalogs[FALLBACK_LOCALE];
  const text = catalog[key] ?? catalogs[FALLBACK_LOCALE][key] ?? key;
  if (!params) return text;
  return Object.entries(params).reduce(
    (result, [name, value]) => result.replaceAll(`{{${name}}}`, value),
    text,
  );
}
