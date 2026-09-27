import i18n from "i18next";

/**
 * Completion celebration (issue #13): a "DONE" rubber stamp slams down where
 * the user marked something done, with a small puff of confetti and a
 * stamp "thunk". Chosen from the celebration-lab prototype over confetti,
 * emoji, check-burst and firework variants. It is the same effect at the
 * same intensity for every appointment and task — callers never pass
 * anything about the item itself.
 *
 * Deliberately dependency-free: the stamp and confetti are plain DOM nodes
 * animated by CSS (see the .celebration-* rules in index.css) in a fixed,
 * pointer-events:none layer, and the sound is synthesized with Web Audio.
 */

export interface CelebrationPoint {
  x: number;
  y: number;
}

/** The subset of a MouseEvent this module reads — `detail` is 0 for keyboard-triggered clicks. */
export interface PointerLike {
  clientX: number;
  clientY: number;
  detail: number;
}

const STAMP_MS = 1700;
const CONFETTI_MS = 1100;
/** When the stamp's slam-down animation lands — the thunk and confetti fire on impact, not on click. */
const IMPACT_MS = 220;
const CONFETTI_COUNT = 22;
/** Keeps the stamp's centre far enough from the viewport edge that it isn't clipped. */
const EDGE_MARGIN = 72;
const CONFETTI_COLORS = [
  "var(--color-primary)",
  "var(--color-green)",
  "var(--color-amber)",
  "var(--color-purple)",
  "var(--color-red)",
];

/**
 * Where the effect should land: the pointer position for a real click,
 * otherwise the anchor's centre (keyboard activation, a <select>'s change,
 * a checkbox's change — none of which carry a meaningful pointer position).
 */
export function celebrationPoint(anchor: Element, event?: PointerLike): CelebrationPoint {
  if (event && event.detail > 0) return { x: event.clientX, y: event.clientY };
  const rect = anchor.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

/**
 * Runs `save` and celebrates at `anchor` once it resolves, so a failed save
 * never celebrates. The point is captured — and audio unlocked — up front,
 * synchronously inside the user's gesture: after the await the anchor may
 * have re-rendered or unmounted, and browsers (iOS Safari especially) only
 * let audio start from within a gesture.
 */
export async function celebrateAfter(anchor: Element, event: PointerLike | undefined, save: () => unknown): Promise<void> {
  const point = celebrationPoint(anchor, event);
  unlockAudio();
  await save();
  celebrate(point);
}

export function celebrate(point: CelebrationPoint): void {
  const layer = getLayer();
  const reduceMotion = prefersReducedMotion();
  const x = clamp(point.x, EDGE_MARGIN, window.innerWidth - EDGE_MARGIN);

  const stamp = document.createElement("span");
  stamp.className = "celebration-stamp";
  stamp.textContent = i18n.t("celebration.stamp");
  stamp.style.left = `${x}px`;
  stamp.style.top = `${point.y}px`;
  layer.appendChild(stamp);
  window.setTimeout(() => stamp.remove(), STAMP_MS);

  window.setTimeout(() => {
    playThunk();
    if (!reduceMotion) confettiPuff(layer, { x, y: point.y });
  }, reduceMotion ? 0 : IMPACT_MS);
}

function confettiPuff(layer: HTMLElement, point: CelebrationPoint): void {
  for (let i = 0; i < CONFETTI_COUNT; i++) {
    const piece = document.createElement("span");
    piece.className = "celebration-confetti";
    // Fan out upward in a ~120° cone, then fall past the start point.
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * ((Math.PI * 2) / 3);
    const distance = 30 + Math.random() * 45;
    const dx = Math.cos(angle) * distance;
    const peak = Math.sin(angle) * distance;
    piece.style.left = `${point.x}px`;
    piece.style.top = `${point.y}px`;
    piece.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    piece.style.setProperty("--dx", `${dx.toFixed(1)}px`);
    piece.style.setProperty("--peak", `${peak.toFixed(1)}px`);
    piece.style.setProperty("--fall", `${(peak + 40 + Math.random() * 40).toFixed(1)}px`);
    piece.style.setProperty("--spin", `${Math.round((Math.random() - 0.5) * 720)}deg`);
    layer.appendChild(piece);
    window.setTimeout(() => piece.remove(), CONFETTI_MS);
  }
}

function getLayer(): HTMLElement {
  let layer = document.getElementById("celebration-layer");
  if (!layer) {
    layer = document.createElement("div");
    layer.id = "celebration-layer";
    layer.className = "celebration-layer";
    layer.setAttribute("aria-hidden", "true");
    document.body.appendChild(layer);
  }
  return layer;
}

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function clamp(value: number, min: number, max: number): number {
  return max < min ? value : Math.min(Math.max(value, min), max);
}

// --- Sound -----------------------------------------------------------------

let audioContext: AudioContext | null = null;

function unlockAudio(): void {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    audioContext ??= new Ctor();
    if (audioContext.state === "suspended") void audioContext.resume();
  } catch {
    audioContext = null;
  }
}

/** A low, quickly-dropping sine "thud" plus a short burst of filtered noise for the paper slap. */
function playThunk(): void {
  const ctx = audioContext;
  if (!ctx) return;
  try {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(55, t + 0.12);
    oscGain.gain.setValueAtTime(0.0001, t);
    oscGain.gain.exponentialRampToValueAtTime(0.5, t + 0.005);
    oscGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    osc.connect(oscGain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.2);

    const length = Math.floor(ctx.sampleRate * 0.06);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3;
    const noise = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const noiseGain = ctx.createGain();
    noise.buffer = buffer;
    filter.type = "bandpass";
    filter.frequency.value = 900;
    filter.Q.value = 0.8;
    noiseGain.gain.value = 0.5;
    noise.connect(filter).connect(noiseGain).connect(ctx.destination);
    noise.start(t);
  } catch {
    // Audio is a nicety — never let it break marking something done.
  }
}
