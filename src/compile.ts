// compile.ts — Script → auto-demo storyboard.
//
// Each beat becomes its OWN VHS segment so the narration (a per-segment
// voiceover part) and the caption pin exactly to that beat — that is the whole
// point: asciinema/VHS give you a silent clip; termreel gives you a clip where the
// right sentence is spoken and captioned over the right command.
//
// To keep multi-step demos honest, prior commands are replayed *hidden* and the
// screen is cleared before each beat, so shell state (cwd, env, files) carries
// across beats while the camera only ever shows the current command on a clean
// screen. `replay: false` opts out (independent beats).

import type { Script, Step, Storyboard, Card, VhsSeg, Caption, Voiceover } from "./types.ts";

const QUOTES = ['"', "'", "`"];

/**
 * VHS `Type` takes a quoted string but has NO escape syntax — you cannot put a
 * `"` inside a `"..."`. It does, however, accept `"`, `'`, or backtick quoting.
 * So we emit one or more `Type` directives, switching the quote char around any
 * literal quote in the command. Consecutive `Type`s type onto the same line, so
 * `echo "hi"` becomes `Type "echo "` + `Type '"hi"'` — typed verbatim.
 */
export function vhsType(s: string): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < s.length) {
    const q = QUOTES.find((c) => c !== s[i])!; // s[i] can't equal all three quotes
    let j = i;
    while (j < s.length && s[j] !== q) j++;
    out.push(`Type ${q}${s.slice(i, j)}${q}`);
    i = j;
  }
  return out;
}

/** A typed-and-entered command, as VHS tape lines. */
function typeCmd(cmd: string, sleep?: string): string[] {
  const out = [...vhsType(cmd), "Enter"];
  if (sleep) out.push(`Sleep ${sleep}`);
  return out;
}

/** Rough spoken length of some narration, ~150 wpm + a breath. 0 → no narration. */
export function narrationSeconds(text?: string): number {
  const words = (text ?? "").trim().split(/\s+/).filter(Boolean).length;
  return words === 0 ? 0 : Math.ceil(words / 2.5) + 1;
}

/**
 * Seconds to hold a beat — this is the narration-sync timer, the whole point of
 * the tool: the on-screen hold is sized to fit the spoken line so the picture
 * never outruns the voice. Explicit `hold` wins; otherwise estimate from `say`.
 */
export function holdSeconds(step: Step): number {
  if (typeof step.hold === "number") return step.hold;
  return Math.min(12, Math.max(2, narrationSeconds(step.say) || 2));
}

/** A title card holds at least 3s, longer if its narration needs it. */
function cardDuration(say?: string): number {
  return Math.min(12, Math.max(3, narrationSeconds(say) || 3));
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export function compile(script: Script): Storyboard {
  // 720p by default: VHS reliably honors `Sleep` here, whereas at 1080p it drops
  // frames and emits clips SHORTER than the hold — which is what makes narration
  // overrun. Native 720p keeps the sync timer honest. (Override via width/height.)
  const width = script.width ?? 1280;
  const height = script.height ?? 720;
  const replay = script.replay !== false;

  const settings: Record<string, string | number> = {
    FontSize: script.fontSize ?? 28,
    Width: width,
    Height: height,
    // A fixed, modest framerate so VHS captures every frame and `Sleep` lands.
    Framerate: 24,
    TypingSpeed: script.typingSpeed ?? "60ms",
    Padding: 40,
  };

  const cards: Card[] = [];
  const vhs: VhsSeg[] = [];
  const captions: Caption[] = [];
  const parts: Voiceover["parts"] = [];
  const timeline: string[] = [];

  // ---- intro card ----
  if (script.title || script.subtitle) {
    cards.push({
      id: "intro",
      title: script.title ?? script.name,
      subtitle: script.subtitle,
      style: "brand",
      duration: cardDuration(script.intro),
    });
    timeline.push("card:intro");
    if (script.intro) parts.push({ at: "card:intro", text: script.intro });
  }

  // ---- one VHS segment per beat ----
  const setup = script.setup ?? [];
  script.steps.forEach((step, i) => {
    const id = `s${i}`;
    const lines: string[] = [];

    const replayPrior = replay && i > 0;
    if (setup.length || replayPrior) {
      lines.push("Hide");
      for (const cmd of setup) lines.push(...typeCmd(cmd, "200ms"));
      if (replayPrior) {
        for (let j = 0; j < i; j++) lines.push(...typeCmd(script.steps[j].run, "300ms"));
      }
      lines.push(...typeCmd("clear", "200ms"));
      lines.push("Show");
    }

    lines.push(...typeCmd(step.run, `${holdSeconds(step)}s`));

    vhs.push({ id, settings, shell: script.shell, lines });
    timeline.push(`vhs:${id}`);

    if (step.say) parts.push({ at: `vhs:${id}`, text: step.say });

    const capText = step.caption !== undefined ? step.caption : step.say;
    if (capText) captions.push({ segment: `vhs:${id}`, text: capText, from: 0.4 });
  });

  // ---- outro card ----
  if (script.outro || script.outroSubtitle || script.outroSay) {
    cards.push({
      id: "outro",
      title: script.outro ?? "Thanks for watching.",
      subtitle: script.outroSubtitle,
      style: "close",
      duration: cardDuration(script.outroSay),
    });
    timeline.push("card:outro");
    if (script.outroSay) parts.push({ at: "card:outro", text: script.outroSay });
  }

  const storyboard: Storyboard = {
    name: slug(script.name),
    size: `${width}x${height}`,
    fps: 30,
    cards,
    vhs,
    captions,
    timeline,
  };

  if (script.theme) storyboard.theme = script.theme;
  if (parts.length) {
    storyboard.voiceover = { engine: "gemini", parts };
    if (script.voice) storyboard.voiceover.voice = script.voice;
  }

  return storyboard;
}
