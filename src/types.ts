// types.ts — the termreel script model.
//
// A `.reel` script is the friendly authoring format. It is parsed into a
// `Script`, then compiled into an auto-demo `storyboard` JSON that `produce.ts`
// turns into a narrated + captioned mp4.

/** One beat of the demo: a command, what the narrator says, and the on-screen caption. */
export interface Step {
  /** The command to type into the terminal (shown on camera). */
  run: string;
  /** Narration spoken over this beat (Gemini TTS). Optional → silent beat. */
  say?: string;
  /** On-screen lower-third caption. Defaults to `say` when omitted; set to "" to suppress. */
  caption?: string;
  /** Seconds to hold after the command runs. Omitted → estimated from `say` length. */
  hold?: number;
}

export interface Script {
  /** Output slug → artifacts/<name>/final.mp4. Required. */
  name: string;
  /** Intro card headline. */
  title?: string;
  /** Intro card subtitle. */
  subtitle?: string;
  /** Narration spoken over the intro card. */
  intro?: string;
  /** Outro card headline (defaults to a sign-off when omitted but an outro is wanted). */
  outro?: string;
  /** Outro card subtitle. */
  outroSubtitle?: string;
  /** Narration spoken over the outro card. */
  outroSay?: string;

  /** TTS voice. Omitted → the house voice (Charon) via --house. */
  voice?: string;
  /** Path to a brand theme JSON (absolute). Omitted → deemwar via --house. */
  theme?: string;

  // VHS terminal look.
  fontSize?: number;
  typingSpeed?: string;
  width?: number;
  height?: number;
  shell?: string;

  /**
   * Commands run *hidden* at the start of every beat (before replay), e.g. `cd`,
   * `export PATH=...`, aliases — so the on-camera commands stay clean. Repeat the
   * `setup:` key for several lines.
   */
  setup?: string[];

  /**
   * Replay prior commands hidden (then `clear`) before each beat so shell state
   * (cwd, env, created files) carries across beats while each beat shows a clean
   * single command. Default true. Set false for independent beats.
   */
  replay?: boolean;

  steps: Step[];
}

// ---- storyboard shapes (subset of the auto-demo storyboard we emit) ----

export interface Storyboard {
  name: string;
  size: string;
  fps: number;
  theme?: string;
  cards: Card[];
  vhs: VhsSeg[];
  captions: Caption[];
  voiceover?: Voiceover;
  timeline: string[];
}

export interface Card {
  id: string;
  title: string;
  subtitle?: string;
  style: "brand" | "stakes" | "close";
  duration: number;
}

export interface VhsSeg {
  id: string;
  settings: Record<string, string | number>;
  shell?: string;
  lines: string[];
}

export interface Caption {
  segment: string;
  text: string;
  from?: number;
  to?: number;
}

export interface Voiceover {
  engine: string;
  voice?: string;
  parts: { at: string; text: string }[];
}
