import { useEffect, useState } from "react";

const QUERY = "(min-width: 768px)";

const matches = () => typeof window.matchMedia === "function" && window.matchMedia(QUERY).matches;

export function useWideLayout(): boolean {
  const [wide, setWide] = useState(matches);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia(QUERY);
    const onChange = () => setWide(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return wide;
}
