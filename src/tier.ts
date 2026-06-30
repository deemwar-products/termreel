// tier.ts — apply free-tier limits to a Script based on Pro entitlements.
//
// This is the single gating point. It is a PURE function: it returns a tier-adjusted
// copy of the script plus a list of human-readable warnings. It never mutates input
// and never throws — over-limit requests DEGRADE to the free tier with a clear note,
// they don't abort the render. (Funnel rule: free sells function, Pro sells polish.)

import type { Script } from "./types.ts";
import { FREE_LIMITS, PREMIUM_VOICES, type Entitlements } from "./license.ts";

const PRO = "  → Pro unlocks this: the CLI is free; Pro ($49, once) adds HD, premium voices, your brand, longer demos, and a commercial license.";

export interface TierResult {
  script: Script;
  warnings: string[];
}

/** Is this voice one of the Pro-reserved premium/branded voices? */
export function isPremiumVoice(voice: string): boolean {
  return PREMIUM_VOICES.has(voice.trim().toLowerCase()) || PREMIUM_VOICES.has(voice.trim());
}

/**
 * Clamp `script` to free limits unless the matching entitlement is present.
 * Levers: resolution (hires), voice (voices), theme (themes), length (longform).
 * Watermark + commercial rights are handled at the build/render layer, not here.
 */
export function applyTier(script: Script, ent: Entitlements): TierResult {
  const warnings: string[] = [];
  const out: Script = { ...script };
  let nudged = false;

  // ---- resolution ----
  if (!ent.has("hires")) {
    const w = out.width ?? 1280;
    const h = out.height ?? 720;
    if (w > FREE_LIMITS.maxWidth || h > FREE_LIMITS.maxHeight) {
      out.width = Math.min(w, FREE_LIMITS.maxWidth);
      out.height = Math.min(h, FREE_LIMITS.maxHeight);
      warnings.push(
        `${w}x${h} is a Pro resolution — rendering at ${out.width}x${out.height} (free is up to 1080p).`
      );
      nudged = true;
    }
  }

  // ---- voice ----
  if (!ent.has("voices") && out.voice && isPremiumVoice(out.voice)) {
    warnings.push(`voice "${out.voice}" is a premium/branded voice (Pro) — using the default free voice.`);
    delete out.voice;
    nudged = true;
  }

  // ---- theme ----
  if (!ent.has("themes") && out.theme) {
    warnings.push(`custom brand themes are Pro — using the default theme.`);
    delete out.theme;
    nudged = true;
  }

  // ---- length ----
  if (!ent.has("longform") && Array.isArray(out.steps) && out.steps.length > FREE_LIMITS.maxBeats) {
    const dropped = out.steps.length - FREE_LIMITS.maxBeats;
    out.steps = out.steps.slice(0, FREE_LIMITS.maxBeats);
    warnings.push(
      `free demos are capped at ${FREE_LIMITS.maxBeats} beats — dropping the last ${dropped} (Pro is unlimited).`
    );
    nudged = true;
  }

  if (nudged) warnings.push(PRO);
  return { script: out, warnings };
}

/** Free tier always carries the "Made with termreel" outro badge; Pro can remove it. */
export function watermarkEnabled(ent: Entitlements): boolean {
  return !ent.has("nowatermark");
}
