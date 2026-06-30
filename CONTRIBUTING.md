# Contributing to termreel

Thanks for helping out! `termreel` — narrated, captioned terminal-demo videos from a tiny .reel — is a small, **MIT, zero-dependency**
CLI that runs on [Bun](https://bun.sh). Contributions that keep it small, honest,
and well-tested are very welcome.

## Quick start

```sh
git clone https://github.com/deemwar-products/termreel && cd termreel
bun test                 # the whole suite
bun bin/termreel.ts --help  # run the CLI
```

## Ground rules

- **Test-first.** Every change ships with a test. CI runs `bun test` on your PR.
- **Zero runtime dependencies.** Don't add a package to `dependencies`; the tool
  must run on Bun alone. (Dev-only tooling is fine to discuss in an issue first.)
- **One thing per PR.** No drive-by refactors — they make review hard.
- **Match the local style.** Read a nearby file and mirror it.
- **Don't weaken the safety contract.** This tool prints a load-bearing
  "best-effort / not a guarantee" style disclaimer and documents its Known
  Limitations honestly. A PR must not overclaim what the tool guarantees or remove
  that disclaimer.

## Good first contributions

- A new detection rule / supported format (with a fixture + test).
- A failing-input fixture that exposes a real gap (even without a fix).
- Docs: a clearer README example, a fixed typo.

## Opening a PR

1. Branch off `main` (`feat/...` or `fix/...`).
2. `bun test` green + a new/updated test for your change.
3. Open the PR; fill in the template. CI must pass.
4. Be kind in review — see `CODE_OF_CONDUCT.md`.

Security issues: **do not** open a public issue — see `SECURITY.md`.
Built by [deemwar](https://deemwar.com/contact).
