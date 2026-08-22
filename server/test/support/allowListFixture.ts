import type { AllowListConfig } from "../../src/auth/AllowList.js";

/**
 * One allow-listed user ("alice"), for the route-test suites that only
 * need some valid entry to get past the allow-list middleware — not about
 * locale or email specifically. Centralizing this here means a future
 * AllowListEntry field only needs a default in one place, not in every
 * route-test file that builds a request-ready app (issue #10 review).
 */
export function singleUserAllowList(): AllowListConfig {
  return { alice: { locale: "en", email: "alice@example.com" } };
}

/**
 * Two allow-listed users (alice/bob) with distinct locales, for tests that
 * exercise locale resolution or per-user allow-list behavior specifically.
 */
export function twoUserAllowList(): AllowListConfig {
  return {
    alice: { locale: "en", email: "alice@example.com" },
    bob: { locale: "he", email: "bob@example.com" },
  };
}
