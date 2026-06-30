# termreel — narrated, captioned terminal demos from a tiny script.
#
# Approach: standalone compiled binary. Bun is a BUILD-ONLY dependency — we compile
# bin/termreel.ts into a self-contained `termreel` executable, so the installed tool
# needs no Bun (or Node) at runtime.
class Termreel < Formula
  desc "Add narration and captions to silent terminal recordings"
  homepage "https://github.com/deemwar-products/termreel"
  url "https://github.com/deemwar-products/termreel/archive/refs/tags/v0.1.0.tar.gz"
  sha256 "68be8f3fefc61bb470262fda6e11b404fdec4ab218740ddc22d925da360baf9d"
  license "MIT"

  depends_on "bun" => :build

  def install
    system "bun", "build", "--compile", "bin/termreel.ts", "--outfile", "termreel"
    bin.install "termreel"
  end

  def caveats
    <<~EOS
      The `termreel build` command (which renders the narrated, captioned .mp4)
      additionally needs the deemwar auto-demo toolkit and a few render tools that
      are NOT installed by this formula — they are only required for `build`, not
      for `init` or `compile`:

        * the auto-demo toolkit  — set AUTODEMO_HOME=/path/to/auto-demo
                                   (or pass `--produce <path>` to `termreel build`)
        * GEMINI_API_KEY         — for the text-to-speech narration
        * vhs                    — `brew install vhs`
        * ffmpeg                 — `brew install ffmpeg`

      `termreel init` and `termreel compile` work out of the box with no extra setup.
    EOS
  end

  test do
    # The compiled binary must report its version with no Bun on PATH.
    assert_match "0.1.0", shell_output("#{bin}/termreel --version")

    # Real round-trip: scaffold a script, then compile it to a storyboard JSON.
    system bin/"termreel", "init", "sample"
    assert_path_exists testpath/"sample.reel"
    compiled = shell_output("#{bin}/termreel compile sample.reel")
    assert_match "\"name\": \"sample\"", compiled

    # `build` without the auto-demo toolkit must fail with a clear, actionable error.
    output = shell_output("#{bin}/termreel build sample.reel 2>&1", 1)
    assert_match "auto-demo", output
  end
end
