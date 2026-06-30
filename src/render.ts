// render.ts — locate the auto-demo `produce.ts` and drive it.
//
// termreel does not re-implement the render pipeline; it compiles a storyboard and
// hands it to the deemwar auto-demo toolkit (VHS + Gemini TTS + ffmpeg). We keep
// the dependency explicit and overridable so the tool stays portable.

import { existsSync } from "node:fs";
import { resolve, join } from "node:path";

/** Find produce.ts: --produce flag → $AUTODEMO_HOME → PATH. */
export function locateProduce(explicit?: string): string | null {
  const candidates: string[] = [];
  if (explicit) candidates.push(resolve(explicit));
  if (process.env.AUTODEMO_HOME) candidates.push(join(process.env.AUTODEMO_HOME, "bin", "produce.ts"));
  for (const c of candidates) if (existsSync(c)) return c;

  // last resort: on PATH
  const which = Bun.spawnSync(["which", "produce.ts"]);
  if (which.exitCode === 0) {
    const p = which.stdout.toString().trim();
    if (p && existsSync(p)) return p;
  }
  return null;
}

export interface RenderOpts {
  producePath: string;
  storyboardPath: string;
  workdir: string;
  house: boolean;
  /** Burn the "Made with termreel" outro badge. Free: true. Pro (nowatermark): false. */
  watermark?: boolean;
}

/** Run produce.ts; streams its output to our stdout. Returns the final.mp4 path on success. */
export async function render(opts: RenderOpts): Promise<string> {
  const args = [opts.producePath, opts.storyboardPath, "--workdir", opts.workdir];
  if (opts.house) args.push("--house");
  // Pro can drop the watermark; produce.ts honors --no-watermark.
  if (opts.watermark === false) args.push("--no-watermark");

  const proc = Bun.spawn(["bun", ...args], { stdout: "inherit", stderr: "inherit" });
  const code = await proc.exited;
  if (code !== 0) throw new Error(`produce.ts exited with code ${code}`);

  const out = join(opts.workdir, "final.mp4");
  if (!existsSync(out)) throw new Error(`render finished but ${out} is missing`);
  return out;
}
