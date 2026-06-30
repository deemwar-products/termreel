#!/usr/bin/env bun
// termreel — narrated, captioned terminal demos.
//
//   asciinema/VHS record a SILENT terminal. termreel adds the voice and the captions.
//
// Write a tiny .reel script (a command + what to say per beat); termreel compiles it
// to an auto-demo storyboard and renders a narrated + captioned mp4.
//
//   termreel init [name]              scaffold a starter script
//   termreel compile <script.reel>   emit the storyboard JSON (no render)
//   termreel build <script.reel>     render the narrated, captioned mp4
//
// See `termreel --help`.

import { parseArgs } from "node:util";
import { existsSync, mkdirSync, copyFileSync, writeFileSync, readFileSync } from "node:fs";
import { resolve, join, basename, dirname } from "node:path";
import { parseReel } from "../src/parse.ts";
import { compile } from "../src/compile.ts";
import { locateProduce, render } from "../src/render.ts";
import { activate, deactivate, loadLicense, loadEntitlements } from "../src/license.ts";
import { applyTier, watermarkEnabled } from "../src/tier.ts";

const VERSION = "0.1.0";

const HELP = `termreel ${VERSION} — narrated, captioned terminal demos

asciinema/VHS record a silent terminal. termreel adds the voice and the captions.

USAGE
  termreel init [name]              write a starter <name>.reel you can edit
  termreel compile <file.reel>     compile to a storyboard JSON (prints, or --out)
  termreel build   <file.reel>     render the narrated + captioned .mp4
  termreel license <activate|status|deactivate> [key]

BUILD OPTIONS
  -o, --out <file>     copy the finished mp4 here (default: ./<name>.mp4)
      --plain          skip the deemwar house style (no theme/voice defaults)
      --dry-run        validate + print the render plan, but don't render
      --produce <path> path to the auto-demo produce.ts (else $AUTODEMO_HOME / PATH)
      --workdir <dir>  render scratch dir (default: ./artifacts/<name>)

COMPILE OPTIONS
  -o, --out <file>     write the storyboard JSON here instead of stdout

PRO
  The CLI is free and open (MIT). A one-time $49 Pro license unlocks 4K, premium
  AI voices, custom brand themes, unlimited length, watermark removal + commercial
  use. Free renders up to 1080p / 8 beats. Manage your license:
    termreel license activate <key>     install a Pro license key
    termreel license status             show your tier + entitlements
    termreel license deactivate         revert to the free tier

A .reel script:
  name: my-demo
  title: My Demo
  run: echo "hello, world"
  say: First, a friendly greeting.
  caption: echo writes to stdout

  run: ls -la
  say: Then we list the directory.

SAFETY
  A .reel runs its own run:/setup: commands in a real terminal (setup: runs
  hidden). Treat a .reel from someone else like a shell script — read it before
  you build.

Docs: https://github.com/deemwar-products/termreel   ·   built by deemwar.com
`;

function fail(msg: string): never {
  console.error(`termreel: ${msg}`);
  process.exit(1);
}

const { values: flags, positionals } = parseArgs({
  args: process.argv.slice(2),
  allowPositionals: true,
  options: {
    help: { type: "boolean", short: "h" },
    version: { type: "boolean", short: "v" },
    out: { type: "string", short: "o" },
    plain: { type: "boolean", default: false },
    "dry-run": { type: "boolean", default: false },
    produce: { type: "string" },
    workdir: { type: "string" },
  },
});

if (flags.version) { console.log(VERSION); process.exit(0); }
const cmd = positionals[0];
if (flags.help || !cmd) { console.log(HELP); process.exit(cmd ? 0 : 0); }

function loadScript(file: string) {
  if (!file) fail("expected a .reel file");
  const path = resolve(file);
  if (!existsSync(path)) fail(`no such file: ${file}`);
  try {
    return parseReel(readFileSync(path, "utf8"));
  } catch (e) {
    fail((e as Error).message);
  }
}

/**
 * Apply the active license tier to a script before compiling. Prints any free-tier
 * warnings to stderr (so piped storyboard JSON on stdout stays clean) and returns
 * the tier-adjusted script. Missing/invalid license → free tier, never fails.
 */
function gateScript(script: ReturnType<typeof loadScript>) {
  const ent = loadEntitlements();
  const { script: adjusted, warnings } = applyTier(script, ent);
  for (const w of warnings) console.error(`termreel: ${w}`);
  return adjusted;
}

const STARTER = (name: string) => `# ${name}.reel — a narrated, captioned terminal demo
# Each "run:" is one beat. "say:" is spoken; "caption:" is shown on screen.
# Render it:  termreel build ${name}.reel

name: ${name}
title: ${name}
subtitle: a narrated terminal demo
intro: Here's a thirty-second tour.

run: echo "hello, world"
say: We start with a friendly greeting.
caption: echo writes to standard output

run: ls -la
say: Then we list the current directory.
caption: ls -la — the long listing

outro: Thanks for watching.
outroSay: Made with termreel. Find us at deemwar dot com.
`;

async function main() {
  if (cmd === "init") {
    const name = (positionals[1] ?? "demo").replace(/\.reel$/, "");
    const file = `${name}.reel`;
    if (existsSync(file)) fail(`${file} already exists`);
    writeFileSync(file, STARTER(name));
    console.log(`wrote ${file}\n\nNext:\n  termreel build ${file}`);
    return;
  }

  if (cmd === "license") {
    const sub = positionals[1];
    if (sub === "activate") {
      const key = positionals[2];
      if (!key) fail("usage: termreel license activate <key>");
      let payload;
      try {
        payload = activate(key);
      } catch {
        fail("invalid license key — check for copy/paste errors, or buy at deemwar.com/contact");
      }
      console.log(
        `Pro activated for ${payload.email} — ${payload.features.join(", ")}.`
      );
      return;
    }
    if (sub === "status") {
      const lic = loadLicense();
      if (!lic) {
        console.log("Free tier — no Pro license installed.\n  Pro ($49, once) unlocks 4K, premium voices, brand themes, unlimited length, and commercial use → deemwar.com/contact");
        return;
      }
      console.log(
        `Pro — ${lic.email}\n  features: ${lic.features.join(", ")}\n  expires: ${lic.exp ? new Date(lic.exp * 1000).toISOString() : "never (lifetime)"}`
      );
      return;
    }
    if (sub === "deactivate") {
      console.log(deactivate() ? "Reverted to the free tier." : "No license installed — already on the free tier.");
      return;
    }
    fail("usage: termreel license <activate <key> | status | deactivate>");
  }

  if (cmd === "compile") {
    const script = gateScript(loadScript(positionals[1]));
    const sb = compile(script);
    const json = JSON.stringify(sb, null, 2);
    if (flags.out) {
      writeFileSync(resolve(flags.out), json + "\n");
      console.log(`wrote ${flags.out}`);
    } else {
      console.log(json);
    }
    return;
  }

  if (cmd === "build") {
    const file = positionals[1];
    const script = gateScript(loadScript(file));
    const sb = compile(script);

    const beats = sb.timeline.filter((t) => t.startsWith("vhs:")).length;
    const narrated = sb.voiceover?.parts.length ?? 0;
    const captioned = sb.captions.length;
    const outName = flags.out ?? `${sb.name}.mp4`;
    console.log(
      `termreel: "${sb.name}" — ${beats} command beat(s), ` +
      `${narrated} narrated, ${captioned} captioned → ${outName}`
    );

    if (flags["dry-run"]) {
      console.log("termreel: dry run — not rendering. Drop --dry-run to produce the mp4.");
      return;
    }

    const producePath = locateProduce(flags.produce);
    if (!producePath) {
      fail(
        "could not find the auto-demo produce.ts.\n" +
        "  Set AUTODEMO_HOME=/path/to/auto-demo, or pass --produce <path>.\n" +
        "  (termreel renders via the deemwar auto-demo toolkit: VHS + Gemini TTS + ffmpeg.)"
      );
    }

    const workdir = resolve(flags.workdir ?? join("artifacts", sb.name));
    mkdirSync(workdir, { recursive: true });
    const sbPath = join(workdir, "storyboard.json");
    writeFileSync(sbPath, JSON.stringify(sb, null, 2));

    console.log(`termreel: ${sb.timeline.length} segments → ${producePath}`);
    const finalMp4 = await render({
      producePath,
      storyboardPath: sbPath,
      workdir,
      house: !flags.plain,
      watermark: watermarkEnabled(loadEntitlements()),
    });

    const outPath = resolve(flags.out ?? `${sb.name}.mp4`);
    if (outPath !== finalMp4) {
      mkdirSync(dirname(outPath), { recursive: true });
      copyFileSync(finalMp4, outPath);
    }
    console.log(`\n✓ ${outPath}`);
    return;
  }

  fail(`unknown command "${cmd}" (try: init | compile | build, or --help)`);
}

// Only run the CLI when invoked directly (`bun bin/termreel.ts ...`), so the
// module can be imported by tests without self-executing.
if (import.meta.main) main().catch((e) => fail((e as Error).message));
