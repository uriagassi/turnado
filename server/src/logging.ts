/**
 * Prefixes every console.log/warn/error call with an ISO timestamp. NAS logs
 * (forever's turnado.txt/.out.txt) have none by default, making it hard to
 * tell when a line like "Reminder send failed..." actually happened. Wired
 * once at startup (index.ts) instead of at each call site, so future
 * console.* calls get a timestamp too without anyone remembering to add one.
 */
export function installTimestampedConsole(clock: () => Date = () => new Date()): void {
  for (const method of ["log", "warn", "error"] as const) {
    const original = console[method].bind(console);
    console[method] = (...args: unknown[]) => original(`[${clock().toISOString()}]`, ...args);
  }
}
