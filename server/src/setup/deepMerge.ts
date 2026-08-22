/**
 * Recursively merges plain-object config trees, `patch` values winning
 * over `base`. Arrays and primitives are replaced wholesale, not merged —
 * config/local.json and config/default.json never hold arrays that need
 * element-wise merging (i18n.supportedLocales is the one array in this
 * app's config shape, and it's always set as a whole, not patched).
 *
 * Shared by detectPaperlessNode.ts (merging a detected paperless.node
 * install's own default.json + local.json, same semantics as the `config`
 * npm package) and localConfigFile.ts (merging a wizard step's answers
 * into this app's existing config/local.json).
 */
export type ConfigTree = { [key: string]: ConfigValue };
export type ConfigValue = string | number | boolean | ConfigTree | undefined;

function isPlainObject(value: unknown): value is ConfigTree {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function deepMerge<T extends ConfigTree>(base: T, patch: ConfigTree): T {
  const result: ConfigTree = { ...base };
  for (const [key, patchValue] of Object.entries(patch)) {
    const baseValue = result[key];
    result[key] =
      isPlainObject(baseValue) && isPlainObject(patchValue)
        ? deepMerge(baseValue, patchValue)
        : patchValue;
  }
  return result as T;
}
