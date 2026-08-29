// Issue #36: the security-prompts wizard step suggests a cookie secret
// default rather than leaving "REPLACE_ME" for the deployer to notice and
// fix themselves — the field genuinely must not ship as the placeholder,
// and a strong random default is ordinary security hygiene, not a value
// paperless.node or any other source could pre-fill. Kept as its own pure
// function (rather than inline in the step) so the reuse-vs-regenerate
// decision is unit-tested like the rest of this module's logic.
import crypto from "node:crypto";

/** The bytes-to-hex-chars ratio (2 hex chars per byte) means 32 bytes gives a 64-char secret — plenty for signing session cookies. */
function generateRandomSecret(): string {
  return crypto.randomBytes(32).toString("hex");
}

/** Picks what to propose as the cookie-secret prompt's default: the existing one, if it's a real value someone already set — otherwise a freshly generated random secret, so the wizard never re-proposes the "REPLACE_ME" placeholder. `generate` is injectable for tests; defaults to a real random secret. */
export function pickCookieSecretDefault(
  currentValue: string | undefined,
  generate: () => string = generateRandomSecret
): string {
  if (currentValue && currentValue !== "REPLACE_ME") return currentValue;
  return generate();
}
