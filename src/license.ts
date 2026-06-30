// license.ts — termreel Pro licensing.
//
// termreel is open source, so this verification code is PUBLIC. We don't pretend
// otherwise: this is an honor-system + signed-key + commercial-terms model, not DRM.
// A Pro license is an Ed25519-signed token; the CLI embeds only the PUBLIC key and
// verifies signatures locally (zero network, works offline / in CI). The private
// signing key never ships — it lives with the issuer (see scripts/sign-license.ts).
//
// Any malformed / expired / invalid / missing key resolves to the FREE tier. This
// module NEVER throws on bad input — licensing must never break a render.

import { verify } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync, chmodSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";

/** Pro entitlements. Each maps to one gated lever in tier.ts. */
export type Feature =
  | "hires"       // resolution above 1080p (4K / custom)
  | "voices"      // premium voices, incl. the branded ElevenLabs clone
  | "themes"      // custom brand themes
  | "longform"    // beats / duration above the free cap
  | "nowatermark" // remove the "Made with termreel" outro badge
  | "commercial"; // commercial + white-label usage rights (legal, not a render gate)

export const ALL_FEATURES: Feature[] = [
  "hires", "voices", "themes", "longform", "nowatermark", "commercial",
];

export interface LicensePayload {
  email: string;
  tier: string;          // "pro"
  features: Feature[];
  iat: number;           // issued-at, unix seconds
  exp: number | null;    // expiry unix seconds; null = perpetual (one-time license)
  id: string;            // issuer order id, for support/audit
}

export type Entitlements = Set<Feature>;

/** Free-tier limits. Free is genuinely useful — these are nudges, not crippleware. */
export const FREE_LIMITS = {
  maxWidth: 1920,
  maxHeight: 1080,
  maxBeats: 8,
  maxSeconds: 90,
} as const;

/**
 * Voices reserved for Pro. The free tier gets the default Gemini voice (and the
 * free Gemini set); these premium/branded voices require the "voices" entitlement.
 */
export const PREMIUM_VOICES = new Set<string>([
  "muthu-english",                 // deemwar branded ElevenLabs clone (alias)
  "KUuOXc3i6FSizlq3R9X9",          // …its ElevenLabs voice_id
  "elevenlabs",                    // any elevenlabs-engine voice
]);

/** The production Ed25519 public key. Its private counterpart lives in the vault. */
export const PUBLIC_KEY =
  "-----BEGIN PUBLIC KEY-----\n" +
  "MCowBQYDK2VwAyEAsPQ3lHqKbF2xWF54OMBXoZuqYZ2ZFEdvrxpKYexZFlE=\n" +
  "-----END PUBLIC KEY-----\n";

/**
 * Verify a signed license key: `<base64url(payload)>.<base64url(ed25519-sig)>`.
 * Returns the payload on a valid, unexpired signature; otherwise null (never throws).
 */
export function verifyLicense(key: string, publicKey: string = PUBLIC_KEY): LicensePayload | null {
  try {
    const trimmed = (key ?? "").trim();
    const dot = trimmed.indexOf(".");
    if (dot <= 0) return null;
    const body = trimmed.slice(0, dot);
    const sig = trimmed.slice(dot + 1);
    if (!body || !sig) return null;

    const payloadBytes = Buffer.from(body, "base64url");
    const sigBytes = Buffer.from(sig, "base64url");
    // Ed25519: algorithm must be null.
    const ok = verify(null, payloadBytes, publicKey, sigBytes);
    if (!ok) return null;

    const data = JSON.parse(payloadBytes.toString("utf8")) as LicensePayload;
    if (data.tier !== "pro") return null;
    if (typeof data.exp === "number" && Date.now() / 1000 > data.exp) return null; // expired
    if (!Array.isArray(data.features)) return null;
    return data;
  } catch {
    return null; // malformed input → free tier
  }
}

/** Path to the stored license file (XDG-aware). */
export function licensePath(): string {
  const base = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
  return join(base, "termreel", "license.json");
}

interface StoredLicense {
  key: string;
  activatedAt: string;
  email: string;
}

/** Read + verify the installed license. Returns the payload or null (free). */
export function loadLicense(): LicensePayload | null {
  try {
    const p = licensePath();
    if (!existsSync(p)) return null;
    const stored = JSON.parse(readFileSync(p, "utf8")) as StoredLicense;
    return verifyLicense(stored.key);
  } catch {
    return null;
  }
}

/** The active entitlement set. Empty set = free tier. */
export function loadEntitlements(): Entitlements {
  const lic = loadLicense();
  return new Set(lic?.features ?? []);
}

/** Activate a key: verify, then persist to the license file (0600). Throws on invalid. */
export function activate(key: string): LicensePayload {
  const payload = verifyLicense(key);
  if (!payload) throw new Error("invalid license key");
  const p = licensePath();
  mkdirSync(dirname(p), { recursive: true });
  const stored: StoredLicense = {
    key: key.trim(),
    activatedAt: new Date().toISOString(),
    email: payload.email,
  };
  writeFileSync(p, JSON.stringify(stored, null, 2) + "\n");
  try { chmodSync(p, 0o600); } catch { /* best-effort on non-POSIX */ }
  return payload;
}

/** Remove the local license (revert to free). Returns true if a file was removed. */
export function deactivate(): boolean {
  const p = licensePath();
  if (!existsSync(p)) return false;
  rmSync(p);
  return true;
}
