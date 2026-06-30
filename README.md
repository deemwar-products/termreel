# termreel

**Narrated, captioned terminal demos — from a tiny script.**

[asciinema](https://asciinema.org) and [VHS](https://github.com/charmbracelet/vhs)
record a *silent* terminal. Great for a GIF — useless the moment you want to
*explain* what's happening. `termreel` adds the missing half: a **spoken voiceover**
and **burned-in captions**, synced to each command, rendered to an `.mp4` you can
drop in a README, a Show HN, or a launch tweet.

```
 asciinema / VHS  →  silent terminal clip
 termreel            →  the same clip, narrated + captioned, as an mp4
```

You write a few lines. termreel records the terminal, speaks your narration, burns
the captions, and hands you a finished video.

---

## 30-second tour

```sh
termreel init greeting        # writes greeting.reel — edit it
termreel build greeting.reel # → greeting.mp4  (narrated + captioned)
```

A `.reel` script is just **a command and what to say over it**, one beat at a time:

```termreel
name: greeting
title: Saying hello
intro: Here's a thirty-second tour.

run: echo "hello, world"
say: First, a friendly greeting.
caption: echo writes to standard output

run: ls -la
say: Then we list the directory.

outro: That's the whole idea.
outroSay: Narrated terminal demos, from a tiny script.
```

That's it. Every `run:` is one beat; `say:` is spoken, `caption:` is shown on
screen (it defaults to whatever you `say`). Run `termreel build greeting.reel` and
you get a finished `greeting.mp4`.

---

## Why it exists

A silent screencast makes the viewer *guess*. Narration + captions is what turns
a recording into a **demo** — and nothing in the terminal-recording world does it
for you. termreel makes the narrated, captioned cut the default, not a video-editing
chore.

- **Tiny input.** A command + a sentence per beat. No timeline editor, no DAW.
- **Synced by construction.** Each beat is its own segment, so the right sentence
  is spoken and captioned over the right command — never drifting.
- **Stateful demos stay honest.** `cd`, `export`, files you create — termreel
  replays earlier commands off-camera so later beats run with real state, while
  the camera only shows the current command on a clean screen.
- **Headless.** No screen, no GUI — renders on a CI box or a server.

---

## Install

**Prerequisites**

| To… | You need |
|---|---|
| **author** a `.reel` — `init`, `compile`, `build --dry-run` | [Bun](https://bun.sh) ≥ 1.1 (bundled into the Homebrew build — nothing else) |
| **render** the mp4 — `termreel build` | Bun **plus** the render stack: the auto-demo toolkit (`AUTODEMO_HOME`), a `GEMINI_API_KEY`, and [`vhs`](https://github.com/charmbracelet/vhs) + `ffmpeg` |

**Homebrew** — a self-contained binary, no Bun needed at runtime:

```sh
brew install deemwar-products/oss/termreel
```

**npm or Bun** — the CLI runs on Bun, so Bun must be installed:

```sh
npm install -g @deemwar-products/termreel        # needs Bun on your machine
# …or run from source:
git clone https://github.com/deemwar-products/termreel && cd termreel
bun link                                   # puts `termreel` on your PATH
```

```sh
termreel --help
```

> ### ⚠️ `termreel build` (the actual render) needs more than Bun
>
> `init`, `compile`, and `build --dry-run` work standalone — they need **only Bun**,
> no API key, nothing external. They author and validate your `.reel`.
>
> **Rendering an mp4 is the heavy part.** `termreel build` (without `--dry-run`) shells
> out to the **deemwar [auto-demo](https://deemwar.com) toolkit** and will **fail
> without** all of:
>
> - the **auto-demo** toolkit on disk — set `AUTODEMO_HOME=/path/to/auto-demo` (or pass `--produce <path>`). It is **not** bundled or on npm.
> - a **`GEMINI_API_KEY`** — for the voiceover (Gemini TTS).
> - [`vhs`](https://github.com/charmbracelet/vhs) and `ffmpeg` on your `PATH`.
>
> So you can try the authoring flow with zero setup; you only need the render stack
> when you actually want the video.

```sh
export AUTODEMO_HOME=/path/to/auto-demo     # required for `build` — or pass --produce <path>
export GEMINI_API_KEY=...                   # required for `build` — the voiceover
```

---

## Commands

| command | what it does |
|---|---|
| `termreel init [name]` | scaffold a starter `<name>.reel` |
| `termreel compile <file>` | compile to the storyboard JSON (`--out` to a file) |
| `termreel build <file>` | render the narrated, captioned `.mp4` |

`termreel build` options:

| flag | meaning |
|---|---|
| `-o, --out <file>` | where to write the mp4 (default `./<name>.mp4`) |
| `--dry-run` | validate + print the render plan, don't render |
| `--plain` | skip the house style (no brand theme / default voice) |
| `--produce <path>` | path to the auto-demo `produce.ts` |
| `--workdir <dir>` | render scratch dir (default `./artifacts/<name>`) |

---

## The script format

A `.reel` file is line-based: `key: value`, with `run:` opening each beat.

**Document keys** (anywhere): `name` (required), `title`, `subtitle`, `intro`,
`outro`, `outroSubtitle`, `outroSay`, `voice`, `theme`, `fontSize`, `typingSpeed`,
`width`, `height`, `shell`, `replay`, `setup` (repeatable — hidden per-beat setup
like `cd`/`export`).

**Beat keys** (after a `run:`): `say`, `caption`, `hold` (seconds to hold; default
is estimated from the narration length).

Long `say:`/`caption:` values can continue on indented following lines.

---

## Safety

**Treat a `.reel` from someone else like a shell script — read it before you
build.** A `.reel` runs its own `run:` commands in a real terminal, and any
`setup:` lines run **hidden** (off-camera, before each beat) by design. termreel
never invents commands — it only types what the file's author wrote — but that
means building an untrusted `.reel` runs *their* commands on *your* machine, just
like piping a stranger's script into your shell. Skim it first.

## Pro

The CLI is **free and open (MIT)** — the `.reel` format, the narration + captions
(the whole point), 1080p output, and demos up to 8 beats are yours forever, for
personal, open-source, educational, and internal use. You can self-host the entire
render stack with your own keys and never need us.

A one-time **$49 lifetime Pro** license adds the polish + the rights to sell your work:

| | Free | Pro — $49 once |
|---|---|---|
| Narration + captions | ✅ | ✅ |
| Resolution | up to 1080p | **4K / custom** |
| Voice | default Gemini | **premium voices + branded clone** |
| Brand theme | default | **custom** |
| Length | up to 8 beats / 90s | **unlimited** |
| Watermark | tasteful outro badge | **removable** |
| Usage | personal / OSS / internal | **commercial + white-label** |

```sh
termreel license activate <key>     # install your Pro key
termreel license status             # show your tier + entitlements
termreel license deactivate         # revert to free
```

Pro funds maintenance and the AI-voice/render API bills. Grab a license at
**[deemwar.com/contact](https://deemwar.com/contact)**.

## License

The **termreel CLI is MIT** (see `LICENSE`). A **Pro license** (above) grants
additional features and commercial-use rights; free-tier output is for personal,
open-source, educational, and internal use.

---

<div align="center">

**`termreel` is built by [Deemwar](https://deemwar.com).** We build small, sharp
tools and ship production AI systems for teams that move fast.

Need a polished terminal demo, an internal tool, or an AI feature built right?
### → [deemwar.com/contact](https://deemwar.com/contact)

</div>
