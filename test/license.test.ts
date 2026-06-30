import { test, expect, describe } from "bun:test";
import { generateKeyPairSync, sign } from "node:crypto";
import { verifyLicense, type LicensePayload, type Feature } from "../src/license.ts";
import { applyTier, watermarkEnabled, isPremiumVoice } from "../src/tier.ts";
import type { Script } from "../src/types.ts";

// An ephemeral keypair so we can sign test licenses without the production private key.
const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const PUB = publicKey.export({ type: "spki", format: "pem" }).toString();

function signKey(p: Partial<LicensePayload>): string {
  const payload: LicensePayload = {
    email: "buyer@example.com",
    tier: "pro",
    features: ["hires", "voices", "themes", "longform", "nowatermark", "commercial"],
    iat: Math.floor(Date.now() / 1000),
    exp: null,
    id: "test",
    ...p,
  };
  const body = Buffer.from(JSON.stringify(payload), "utf8");
  const sig = sign(null, body, privateKey);
  return `${body.toString("base64url")}.${sig.toString("base64url")}`;
}

describe("verifyLicense", () => {
  test("accepts a valid, perpetual Pro key", () => {
    const lic = verifyLicense(signKey({}), PUB);
    expect(lic).not.toBeNull();
    expect(lic!.email).toBe("buyer@example.com");
    expect(lic!.features).toContain("voices");
  });

  test("rejects a tampered payload", () => {
    const key = signKey({});
    const [body, sig] = key.split(".");
    // flip a byte in the payload, keep the original signature
    const mangled = Buffer.from(body, "base64url");
    mangled[5] ^= 0xff;
    const bad = `${mangled.toString("base64url")}.${sig}`;
    expect(verifyLicense(bad, PUB)).toBeNull();
  });

  test("rejects a key signed by a different key", () => {
    const other = generateKeyPairSync("ed25519");
    const body = Buffer.from(JSON.stringify({ email: "x", tier: "pro", features: [], iat: 0, exp: null, id: "z" }));
    const sig = sign(null, body, other.privateKey);
    const key = `${body.toString("base64url")}.${sig.toString("base64url")}`;
    expect(verifyLicense(key, PUB)).toBeNull();
  });

  test("rejects an expired key", () => {
    const past = Math.floor(Date.now() / 1000) - 60;
    expect(verifyLicense(signKey({ exp: past }), PUB)).toBeNull();
  });

  test("accepts a future-dated expiry", () => {
    const future = Math.floor(Date.now() / 1000) + 3600;
    expect(verifyLicense(signKey({ exp: future }), PUB)).not.toBeNull();
  });

  test("rejects a non-pro tier", () => {
    expect(verifyLicense(signKey({ tier: "free" as string }), PUB)).toBeNull();
  });

  test("returns null (never throws) on malformed input", () => {
    for (const junk of ["", "nope", "a.b.c", "....", "abc.", ".abc", "💥"]) {
      expect(verifyLicense(junk, PUB)).toBeNull();
    }
  });
});

const baseScript = (over: Partial<Script> = {}): Script => ({
  name: "demo",
  steps: [{ run: "echo hi" }],
  ...over,
});

const FREE = new Set<Feature>();
const PRO = new Set<Feature>(["hires", "voices", "themes", "longform", "nowatermark", "commercial"]);

describe("applyTier — free tier clamps", () => {
  test("clamps 4K resolution to 1080p", () => {
    const { script, warnings } = applyTier(baseScript({ width: 3840, height: 2160 }), FREE);
    expect(script.width).toBe(1920);
    expect(script.height).toBe(1080);
    expect(warnings.some((w) => w.includes("Pro resolution"))).toBe(true);
  });

  test("drops a premium/branded voice", () => {
    const { script, warnings } = applyTier(baseScript({ voice: "muthu-english" }), FREE);
    expect(script.voice).toBeUndefined();
    expect(warnings.some((w) => w.includes("premium"))).toBe(true);
  });

  test("keeps a non-premium voice", () => {
    const { script } = applyTier(baseScript({ voice: "Charon" }), FREE);
    expect(script.voice).toBe("Charon");
  });

  test("drops a custom theme", () => {
    const { script, warnings } = applyTier(baseScript({ theme: "/my/brand.json" }), FREE);
    expect(script.theme).toBeUndefined();
    expect(warnings.some((w) => w.includes("themes are Pro"))).toBe(true);
  });

  test("caps demos at 8 beats", () => {
    const steps = Array.from({ length: 12 }, (_, i) => ({ run: `echo ${i}` }));
    const { script, warnings } = applyTier(baseScript({ steps }), FREE);
    expect(script.steps.length).toBe(8);
    expect(warnings.some((w) => w.includes("8 beats"))).toBe(true);
  });

  test("passes a within-limits free script through unchanged", () => {
    const { script, warnings } = applyTier(baseScript({ width: 1280, height: 720 }), FREE);
    expect(warnings.length).toBe(0);
    expect(script.steps.length).toBe(1);
  });

  test("does not mutate the input script", () => {
    const input = baseScript({ width: 3840, height: 2160 });
    applyTier(input, FREE);
    expect(input.width).toBe(3840); // original untouched
  });
});

describe("applyTier — Pro entitlements pass through", () => {
  test("Pro keeps 4K, premium voice, theme, and all beats", () => {
    const steps = Array.from({ length: 12 }, (_, i) => ({ run: `echo ${i}` }));
    const { script, warnings } = applyTier(
      baseScript({ width: 3840, height: 2160, voice: "muthu-english", theme: "/b.json", steps }),
      PRO,
    );
    expect(script.width).toBe(3840);
    expect(script.voice).toBe("muthu-english");
    expect(script.theme).toBe("/b.json");
    expect(script.steps.length).toBe(12);
    expect(warnings.length).toBe(0);
  });
});

describe("watermark + voice helpers", () => {
  test("free keeps the watermark, Pro nowatermark removes it", () => {
    expect(watermarkEnabled(FREE)).toBe(true);
    expect(watermarkEnabled(PRO)).toBe(false);
  });
  test("isPremiumVoice flags branded voices, not free ones", () => {
    expect(isPremiumVoice("muthu-english")).toBe(true);
    expect(isPremiumVoice("KUuOXc3i6FSizlq3R9X9")).toBe(true);
    expect(isPremiumVoice("Charon")).toBe(false);
  });
});
