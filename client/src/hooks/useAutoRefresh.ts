import { useEffect } from "react";

/**
 * Keeps a data-fetching callback current without user action: reruns it
 * periodically and whenever the window regains focus (e.g. the user
 * switches back to this tab after time away). The home screen's manual
 * refresh control (see HomeScreen) calls the same callback directly —
 * this hook only owns the two automatic triggers.
 */
export function useAutoRefresh(onRefresh: () => void, intervalMs: number): void {
  useEffect(() => {
    const interval = setInterval(onRefresh, intervalMs);
    window.addEventListener("focus", onRefresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onRefresh);
    };
  }, [onRefresh, intervalMs]);
}
