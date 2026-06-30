#!/usr/bin/env bun
// sign-license.ts — ISSUER-SIDE license signer. NOT shipped to users.
//
// Reads the Ed25519 PRIVATE key (from --key-file or $TERMREEL_LICENSE_PRIVATE_KEY,
// a path to a PEM) and emits a signed termreel license key:
//   <base64url(payload)>.<base64url(ed25519-sig)>
//
// Used by the LemonSqueezy order webhook (Cloudflare Worker) or run manually at
// low volume off the order email. The private key must NEVER be committed.
//
// Usage:
//   TERMREEL_LICENSE_PRIVATE_KEY=/path/priv.pem \
//     bun scripts/sign-license.ts --email buyer@x.com --id ls_order_123
//   bun scripts/sign-license.ts --key-file priv.pem --email a@b.c --features hires,voices

import { parseArgs } from "node:util";
import { sign } from "node:crypto";
import { readFileSync } from "node:fs";
import { ALL_FEATURES, type Feature, type LicensePayload } from "../src/license.ts";

const { values } = parseArgs({
  options: {
    email: { type: "string" },
    id: { type: "string" },
    features: { type: "string" },     // comma list; default = all Pro features
    "key-file": { type: "string" },
    exp: { type: "string" },          // unix seconds; omit for perpetual
  },
});

function die(msg: string): never { console.error(`sign-license: ${msg}`); process.exit(1); }

const keyPath = values["key-file"] || process.env.TERMREEL_LICENSE_PRIVATE_KEY;
if (!keyPath) die("need --key-file <priv.pem> or $TERMREEL_LICENSE_PRIVATE_KEY");
if (!values.email) die("need --email <buyer@email>");

const privateKey = readFileSync(keyPath, "utf8");

const features: Feature[] = values.features
  ? (values.features.split(",").map((s) => s.trim()).filter(Boolean) as Feature[])
  : [...ALL_FEATURES];

const bad = features.filter((f) => !ALL_FEATURES.includes(f));
if (bad.length) die(`unknown feature(s): ${bad.join(", ")}`);

const payload: LicensePayload = {
  email: values.email,
  tier: "pro",
  features,
  iat: Math.floor(Date.now() / 1000),
  exp: values.exp ? Number(values.exp) : null,
  id: values.id || "manual",
};

const body = Buffer.from(JSON.stringify(payload), "utf8");
const sig = sign(null, body, privateKey); // Ed25519
const key = `${body.toString("base64url")}.${sig.toString("base64url")}`;

console.log(key);
