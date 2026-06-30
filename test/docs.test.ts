// docs.test.ts — publish-polish doc contracts (#3398).
//
// These lock in three honesty/safety promises the README + CLI must keep, so a
// future edit can't silently drop them:
//   • the build-vs-standalone dependency split is stated LOUDLY (not buried),
//   • a "treat a third-party .reel like a shell script" safety note exists,
//   • both live in the shipped binary's --help, not just the README.

import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const readme = readFileSync(join(root, "README.md"), "utf8");
const bin = readFileSync(join(root, "bin", "termreel.ts"), "utf8");

test("README states the build vs standalone dependency split, loudly", () => {
  // the heavy deps are named...
  expect(readme).toContain("auto-demo");
  expect(readme).toContain("GEMINI_API_KEY");
  // ...and it's explicit that build is the ONLY part that needs them.
  expect(readme).toMatch(/init.*compile.*dry-run.*(only|no).*Bun/is);
  expect(readme).toMatch(/build[^\n]*needs/i);

  // Burial-resistance: the dependency callout must live UP-FRONT in Install, not
  // be tucked away after the rest of the docs. A bare `.includes()` of the tokens
  // would pass even if they were buried — so assert ORDERING. (The whole point of
  // Story A: this defect was that the deps were disclosed-but-buried.)
  const commands = readme.indexOf("## Commands");
  const deps = readme.indexOf("GEMINI_API_KEY");
  expect(deps).toBeGreaterThan(-1);
  expect(commands).toBeGreaterThan(-1);
  expect(deps).toBeLessThan(commands); // deps disclosed before the command reference
});

test("README carries the third-party .reel safety note", () => {
  expect(readme).toMatch(/like a shell script/i);
  expect(readme).toMatch(/setup:/); // calls out the hidden off-camera commands
});

test("the shipped --help carries the same safety note", () => {
  expect(bin).toMatch(/like a shell script/i);
});
