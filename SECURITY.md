# Security Policy

`termreel` is a defensive dev tool (narrated, captioned terminal-demo videos from a tiny .reel). It runs locally, is read-only on its
input unless you ask it to write, and makes **zero network calls**.

## Reporting a vulnerability

**Please do not open a public GitHub issue for a security problem.** If you've found
a way the tool leaks/mishandles a secret, corrupts output, or executes something it
shouldn't, report it privately:

- **https://deemwar.com/contact** — say it's a security report for `termreel`.

We'll acknowledge within a few days and keep you posted on the fix. Responsible
disclosure is appreciated and credited (with your permission).

## Scope / non-issues

- The tool is **best-effort**, not a guarantee — a documented Known Limitation
  (e.g. a secret split across events/nodes, or shell that the README itself runs) is
  not a vulnerability; it's in the README. A *new* miss outside the documented limits
  is worth reporting.
