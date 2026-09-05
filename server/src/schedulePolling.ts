/**
 * Runs `fn` immediately, then every `intervalMs` after that — issue #10's
 * AC: "a single hourly poll ... runs once immediately on server startup."
 * Kept separate from index.ts so the run-immediately-then-recur behavior is
 * actually tested (with fake timers) rather than trusted by inspection —
 * index.ts's own call site stays untested, same as its other wiring. Lives
 * at the top level (not under reminders/) because it's no longer
 * reminders-specific — index.ts also uses it for the periodic WAL
 * checkpoint (see docs/adr/0001-wal-checkpoint-strategy.md).
 */
export function schedulePolling(fn: () => Promise<void>, intervalMs: number): { stop: () => void } {
  // A rejected tick (e.g. a real SMTP failure ReminderService didn't itself
  // catch) must not become an unhandled rejection or silently end future
  // ticks — logged the same way ReminderService's own genuine-failure catch
  // is, not swallowed.
  const run = () => {
    fn().catch((err) => console.error("Scheduled poll failed:", err));
  };
  run();
  const handle = setInterval(run, intervalMs);
  return { stop: () => clearInterval(handle) };
}
