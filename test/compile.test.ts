import { test, expect } from "bun:test";
import { compile, vhsType, holdSeconds } from "../src/compile.ts";
import type { Script } from "../src/types.ts";

const base: Script = {
  name: "demo",
  title: "Demo",
  subtitle: "sub",
  intro: "Welcome.",
  steps: [
    { run: "echo hi", say: "Say hi.", caption: "prints hi" },
    { run: "ls -la", say: "List files." },
  ],
  outro: "Bye",
  outroSay: "Thanks.",
};

test("vhsType switches quote style around literal quotes (no escaping)", () => {
  // no quotes → a single Type
  expect(vhsType("ls -la")).toEqual(['Type "ls -la"']);
  // a double quote → split, second chunk single-quoted, types verbatim
  expect(vhsType('echo "hi"')).toEqual(['Type "echo "', `Type '"hi"'`]);
  // a single quote → wrapped in double quotes
  expect(vhsType("echo 'hi'")).toEqual([`Type "echo 'hi'"`]);
  // reconstructs exactly for a mixed command
  const cmd = `git commit -m "fix: it's done"`;
  const typed = vhsType(cmd).map((l) => l.slice(6, -1)).join("");
  expect(typed).toBe(cmd);
});

test("holdSeconds estimates from narration and clamps", () => {
  expect(holdSeconds({ run: "x" })).toBe(2); // no narration
  expect(holdSeconds({ run: "x", hold: 7 })).toBe(7); // explicit wins
  const long = "word ".repeat(60).trim();
  expect(holdSeconds({ run: "x", say: long })).toBe(12); // clamped
});

test("outroSubtitle flows onto the outro card (the visible end-card CTA)", () => {
  // Story B (#3398): a deemwar.com/contact CTA must be able to render visibly on
  // the end card. The outro card is style 'close', whose subtitle auto-demo draws
  // as a code-chip pill — so outroSubtitle must reach card.subtitle verbatim.
  const sb = compile({ ...base, outroSubtitle: "deemwar.com/contact" });
  const outro = sb.cards.find((c) => c.id === "outro");
  expect(outro).toBeDefined();
  expect(outro!.style).toBe("close");
  expect(outro!.subtitle).toBe("deemwar.com/contact");
});

test("no outroSubtitle ⇒ outro card has no subtitle (no CTA leaks into user demos)", () => {
  const sb = compile(base); // base has outro/outroSay but no outroSubtitle
  const outro = sb.cards.find((c) => c.id === "outro");
  expect(outro).toBeDefined();
  expect(outro!.subtitle).toBeUndefined();
});

test("timeline: intro card, one vhs per beat, outro card", () => {
  const sb = compile(base);
  expect(sb.timeline).toEqual(["card:intro", "vhs:s0", "vhs:s1", "card:outro"]);
  expect(sb.vhs).toHaveLength(2);
  expect(sb.size).toBe("1280x720");
});

test("renders at a VHS-reliable size + framerate (the sync fix)", () => {
  const sb = compile(base);
  expect(sb.size).toBe("1280x720");
  expect(sb.vhs[0].settings.Framerate).toBe(24);
  expect(sb.vhs[0].settings.Width).toBe(1280);
});

test("cards are sized to their narration so the voice fits", () => {
  // intro "Welcome." = 1 word → floor 3s; outro "Thanks." = 1 word → 3s
  expect(compile(base).cards.find((c) => c.id === "intro")!.duration).toBe(3);
  // a longer outro line stretches the card past the 3s floor
  const sb = compile({ ...base, outroSay: "Narrated and captioned terminal demos from one tiny file today" });
  expect(sb.cards.find((c) => c.id === "outro")!.duration).toBeGreaterThan(3);
});

test("hold is sized to the narration (the timer)", () => {
  const sb = compile({ name: "x", steps: [{ run: "pwd", say: "one two three four five six seven eight" }] });
  // 8 words → ceil(8/2.5)+1 = 5s hold
  expect(sb.vhs[0].lines).toContain("Sleep 5s");
});

test("voiceover parts pin to each segment", () => {
  const sb = compile(base);
  expect(sb.voiceover?.parts).toEqual([
    { at: "card:intro", text: "Welcome." },
    { at: "vhs:s0", text: "Say hi." },
    { at: "vhs:s1", text: "List files." },
    { at: "card:outro", text: "Thanks." },
  ]);
});

test("caption defaults to say when not given, explicit caption wins", () => {
  const sb = compile(base);
  expect(sb.captions[0]).toEqual({ segment: "vhs:s0", text: "prints hi", from: 0.4 });
  expect(sb.captions[1]).toEqual({ segment: "vhs:s1", text: "List files.", from: 0.4 });
});

test("empty caption suppresses the caption", () => {
  const sb = compile({ name: "x", steps: [{ run: "pwd", say: "hi", caption: "" }] });
  expect(sb.captions).toHaveLength(0);
});

test("replay re-runs prior commands hidden, then clears, per beat", () => {
  const sb = compile(base);
  const s1 = sb.vhs[1].lines;
  expect(s1[0]).toBe("Hide");
  expect(s1).toContain('Type "echo hi"'); // prior command replayed
  expect(s1).toContain('Type "clear"');
  expect(s1).toContain("Show");
  // the visible current command comes after Show
  expect(s1.indexOf("Show")).toBeLessThan(s1.indexOf('Type "ls -la"'));
  // first beat has no replay block
  expect(sb.vhs[0].lines[0]).toBe('Type "echo hi"');
});

test("replay:false makes each beat independent", () => {
  const sb = compile({ ...base, replay: false });
  expect(sb.vhs[1].lines).not.toContain("Hide");
  expect(sb.vhs[1].lines[0]).toBe('Type "ls -la"');
});

test("setup lines run hidden before every beat", () => {
  const sb = compile({ name: "x", setup: ["cd /tmp", "export PATH=/bin"], steps: [{ run: "pwd" }, { run: "ls" }] });
  // even beat 0 (no replay) gets a hidden setup block
  const s0 = sb.vhs[0].lines;
  expect(s0[0]).toBe("Hide");
  expect(s0).toContain('Type "cd /tmp"');
  expect(s0).toContain('Type "export PATH=/bin"');
  expect(s0).toContain("Show");
  expect(s0.indexOf("Show")).toBeLessThan(s0.indexOf('Type "pwd"'));
  // beat 1: setup AND replay both present
  const s1 = sb.vhs[1].lines;
  expect(s1).toContain('Type "cd /tmp"');
  expect(s1).toContain('Type "pwd"'); // replayed prior
});

test("no cards when no title/outro — pure terminal", () => {
  const sb = compile({ name: "x", steps: [{ run: "pwd" }] });
  expect(sb.cards).toHaveLength(0);
  expect(sb.timeline).toEqual(["vhs:s0"]);
  expect(sb.voiceover).toBeUndefined();
});

test("name is slugified for the output folder", () => {
  const sb = compile({ name: "My Cool Demo!", steps: [{ run: "pwd" }] });
  expect(sb.name).toBe("my-cool-demo");
});

test("voice and theme flow through when set", () => {
  const sb = compile({ ...base, voice: "Kore", theme: "/abs/theme.json" });
  expect(sb.voiceover?.voice).toBe("Kore");
  expect(sb.theme).toBe("/abs/theme.json");
});
