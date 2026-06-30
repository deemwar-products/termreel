// parse.ts — turn a `.reel` script into a `Script`.
//
// The format is line-based and deliberately tiny:
//
//   # comments start with hash
//   name: my-demo            ← metadata keys (before the first `run:`)
//   title: My Demo
//   voice: Charon
//
//   run: echo "hello world"  ← each `run:` opens a new beat
//   say: First, a greeting.  ← attaches to the current beat
//   caption: echo → stdout
//   hold: 3
//
//   run: ls -la
//   say: Then we list the directory.
//
// Long `say`/`caption` values may continue on following indented lines.

import type { Script, Step } from "./types.ts";

const META_KEYS = new Set([
  "name", "title", "subtitle", "intro", "outro", "outroSubtitle", "outroSay",
  "voice", "theme", "fontSize", "typingSpeed", "width", "height", "shell", "replay", "setup",
]);
// keys that accumulate into an array when repeated
const LIST_KEYS = new Set(["setup"]);
const STEP_KEYS = new Set(["run", "say", "caption", "hold"]);

const NUMERIC = new Set(["fontSize", "width", "height", "hold"]);
const BOOLEAN = new Set(["replay"]);

function coerce(key: string, value: string): string | number | boolean {
  if (NUMERIC.has(key)) {
    const n = Number(value);
    if (Number.isNaN(n)) throw new Error(`termreel: "${key}" must be a number, got "${value}"`);
    return n;
  }
  if (BOOLEAN.has(key)) {
    if (value === "true" || value === "false") return value === "true";
    throw new Error(`termreel: "${key}" must be true or false, got "${value}"`);
  }
  return value;
}

/** Parse `.reel` text into a validated Script. */
export function parseReel(text: string): Script {
  const meta: Record<string, string | number | boolean> = {};
  const steps: Step[] = [];
  let current: Step | null = null;
  // Track the last key we wrote (for continuation lines), and where it lives.
  let lastKey: string | null = null;
  let lastScope: "meta" | "step" | null = null;

  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trimEnd();
    if (!line.trim()) { lastKey = null; continue; }
    if (line.trim().startsWith("#")) continue;

    // Continuation: an indented line with no `key:` prefix appends to the last value.
    const isIndented = /^\s/.test(raw);
    const m = line.match(/^\s*([A-Za-z][A-Za-z0-9]*)\s*:\s?(.*)$/);
    const looksLikeKey = m && (META_KEYS.has(m[1]) || STEP_KEYS.has(m[1]));

    if (isIndented && lastKey && !looksLikeKey && !LIST_KEYS.has(lastKey)) {
      const cont = line.trim();
      if (lastScope === "meta") meta[lastKey] = `${meta[lastKey]} ${cont}`;
      else if (current) (current as any)[lastKey] = `${(current as any)[lastKey]} ${cont}`;
      continue;
    }

    if (!m) throw new Error(`termreel: cannot parse line ${i + 1}: "${line.trim()}"`);
    const key = m[1];
    const value = m[2];

    if (key === "run") {
      if (!value.trim()) throw new Error(`termreel: empty "run:" on line ${i + 1}`);
      current = { run: value };
      steps.push(current);
      lastKey = "run";
      lastScope = "step";
      continue;
    }

    if (STEP_KEYS.has(key)) {
      if (!current) throw new Error(`termreel: "${key}:" on line ${i + 1} appears before any "run:"`);
      (current as any)[key] = coerce(key, value);
      lastKey = key;
      lastScope = "step";
      continue;
    }

    if (META_KEYS.has(key)) {
      // Metadata is document-level; it may appear anywhere (e.g. `outro:` at the
      // end of a script reads naturally after the beats).
      if (LIST_KEYS.has(key)) {
        if (!Array.isArray(meta[key])) meta[key] = [] as unknown as string;
        (meta[key] as unknown as string[]).push(value);
      } else {
        meta[key] = coerce(key, value);
      }
      lastKey = key;
      lastScope = "meta";
      continue;
    }

    throw new Error(`termreel: unknown key "${key}:" on line ${i + 1}`);
  }

  if (!meta.name) throw new Error('termreel: missing required "name:"');
  if (steps.length === 0) throw new Error("termreel: a script needs at least one \"run:\" beat");

  return { ...(meta as object), steps } as Script;
}
