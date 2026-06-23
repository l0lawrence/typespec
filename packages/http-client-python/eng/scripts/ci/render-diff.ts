/* eslint-disable no-console */
/**
 * Renders an HTML diff between the **assets baseline** (the last accepted
 * regeneration output, restored from the assets repo) and the **current**
 * `tests/generated` output (produced by `npm run regenerate` beforehand).
 *
 * Output (default `temp/diff-site/`):
 *   - index.html      A self-contained, side-by-side HTML diff (diff2html).
 *   - summary.json    { changed, filesChanged, additions, deletions } for the
 *                     PR-comment step to consume.
 *
 * Restoring the baseline is an anonymous clone of the public assets repo, so
 * this needs no token. If assets.json has no Tag yet (not bootstrapped), the
 * whole current output is treated as "added".
 *
 * Usage:
 *   tsx ./eng/scripts/ci/render-diff.ts [--output <dir>] [--generated <dir>] [--title <t>]
 */

import { execFileSync } from "child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { cp, mkdtemp } from "fs/promises";
import { createRequire } from "module";
import { tmpdir } from "os";
import { dirname, join, resolve } from "path";
import pc from "picocolors";
import { fileURLToPath } from "url";
import { parseArgs } from "util";

import { FLAVORS, readAssetsConfig, restoreFullBaseline } from "./assets.js";

// diff2html is CommonJS; load via createRequire for ESM.
const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { html: diff2html } = require("diff2html") as typeof import("diff2html");

const argv = parseArgs({
  args: process.argv.slice(2),
  options: {
    output: { type: "string", short: "o" },
    generated: { type: "string", short: "g" },
    title: { type: "string", short: "t" },
    help: { type: "boolean", short: "h" },
  },
});

if (argv.values.help) {
  console.log(`
${pc.bold("Usage:")} tsx render-diff.ts [options]

Renders an HTML diff of the current tests/generated output vs the assets baseline.

${pc.bold("Options:")}
  -o, --output <dir>     Output directory (default: temp/diff-site).
  -g, --generated <dir>  Current generated dir (default: tests/generated).
  -t, --title <text>     Title shown on the diff page.
  -h, --help             Show this help.
`);
  process.exit(0);
}

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = resolve(SCRIPT_DIR, "../../../");
const GENERATED_DIR = argv.values.generated
  ? resolve(argv.values.generated)
  : resolve(PACKAGE_ROOT, "tests/generated");
const OUTPUT_DIR = argv.values.output
  ? resolve(argv.values.output)
  : resolve(PACKAGE_ROOT, "temp/diff-site");
const TITLE = argv.values.title ?? "Python emitter — generated test diff";

// diff2html builds the entire page as a single in-memory string. Side-by-side
// HTML is ~10-20x the size of the raw unified diff, and V8 caps a string at
// ~512MB, so a very large diff throws `RangeError: Invalid string length`.
// Above this raw-diff size we skip inline rendering and link to diff.txt instead.
const MAX_INLINE_DIFF_BYTES = 12 * 1024 * 1024;

interface DiffSummary {
  changed: boolean;
  filesChanged: number;
  additions: number;
  deletions: number;
  baselineTag: string;
  note?: string;
}

function git(args: string[], cwd: string, allowFail = false): string {
  try {
    return execFileSync("git", args, {
      cwd,
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf8",
      maxBuffer: 256 * 1024 * 1024,
    });
  } catch (err) {
    if (allowFail) {
      const e = err as { stdout?: string };
      return e.stdout ?? "";
    }
    throw err;
  }
}

/** Parses `git diff --numstat` output into aggregate counts. */
function parseNumstat(numstat: string): { files: number; additions: number; deletions: number } {
  let files = 0;
  let additions = 0;
  let deletions = 0;
  for (const line of numstat.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const [add, del] = trimmed.split("\t");
    files += 1;
    // Binary files report "-" for counts.
    if (add !== "-") additions += Number(add) || 0;
    if (del !== "-") deletions += Number(del) || 0;
  }
  return { files, additions, deletions };
}

async function main(): Promise<void> {
  // Validate current output exists.
  for (const flavor of FLAVORS) {
    if (!existsSync(join(GENERATED_DIR, flavor))) {
      console.error(
        pc.red(
          `Missing ${join(GENERATED_DIR, flavor)}. Run "npm run regenerate" before render-diff.`,
        ),
      );
      process.exit(1);
    }
  }

  const config = readAssetsConfig(PACKAGE_ROOT);
  const baselineTag = config?.tag ?? "";

  const workDir = await mkdtemp(join(tmpdir(), "typespec-diff-"));
  const baselineDir = join(workDir, "baseline");
  const currentDir = join(workDir, "current");

  try {
    // "current" = freshly regenerated output.
    await cp(GENERATED_DIR, currentDir, { recursive: true });

    // "baseline" = last accepted output from the assets repo (empty if no tag).
    mkdirSync(baselineDir, { recursive: true });
    let note: string | undefined;
    if (config && config.tag) {
      console.log(pc.cyan(`Restoring baseline ${config.assetsRepo}@${config.tag}...`));
      await restoreFullBaseline(config, baselineDir);
    } else {
      note =
        "No baseline tag is configured in assets.json yet; the entire current output is shown as added.";
      console.warn(pc.yellow(note));
    }

    // git diff --no-index returns exit code 1 when there are differences.
    const diffText = git(
      [
        "-c",
        "core.quotepath=false",
        "diff",
        "--no-index",
        "--no-color",
        "--",
        "baseline",
        "current",
      ],
      workDir,
      true,
    );
    const numstat = git(
      [
        "-c",
        "core.quotepath=false",
        "diff",
        "--no-index",
        "--numstat",
        "--",
        "baseline",
        "current",
      ],
      workDir,
      true,
    );
    const counts = parseNumstat(numstat);

    const summary: DiffSummary = {
      changed: diffText.trim().length > 0,
      filesChanged: counts.files,
      additions: counts.additions,
      deletions: counts.deletions,
      baselineTag,
      note,
    };

    rmSync(OUTPUT_DIR, { recursive: true, force: true });
    mkdirSync(OUTPUT_DIR, { recursive: true });
    writeFileSync(join(OUTPUT_DIR, "summary.json"), JSON.stringify(summary, null, 2) + "\n");
    // Always persist the raw unified diff so a too-large diff is still viewable.
    if (summary.changed) {
      writeFileSync(join(OUTPUT_DIR, "diff.txt"), diffText);
    }
    writeFileSync(join(OUTPUT_DIR, "index.html"), renderHtml(diffText, summary));

    console.log(
      pc.green(
        `Diff rendered to ${OUTPUT_DIR} ` +
          `(${summary.filesChanged} files, +${summary.additions}/-${summary.deletions}).`,
      ),
    );
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

/** Builds a self-contained HTML page embedding the diff2html CSS + fragment. */
function renderHtml(diffText: string, summary: DiffSummary): string {
  const cssPath = require.resolve("diff2html/bundles/css/diff2html.min.css");
  const css = readFileSync(cssPath, "utf8");

  const diffBytes = Buffer.byteLength(diffText, "utf8");
  const tooLarge = diffBytes > MAX_INLINE_DIFF_BYTES;

  let body: string;
  if (!summary.changed) {
    body = `<div class="no-changes">✅ No differences from the baseline.</div>`;
  } else if (tooLarge) {
    body = oversizedNotice(diffBytes);
  } else {
    try {
      body = diff2html(diffText, {
        drawFileList: true,
        matching: "lines",
        outputFormat: "side-by-side",
      });
    } catch (err) {
      // Most commonly `RangeError: Invalid string length` for very large diffs.
      console.warn(pc.yellow(`Inline diff rendering failed (${err}); falling back to raw diff.`));
      body = oversizedNotice(diffBytes);
    }
  }

  const noteHtml = summary.note ? `<p class="note">⚠️ ${escapeHtml(summary.note)}</p>` : "";
  const tagLine = summary.baselineTag
    ? `Baseline tag: <code>${escapeHtml(summary.baselineTag)}</code>`
    : "Baseline: <em>none (not bootstrapped)</em>";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(TITLE)}</title>
<style>
${css}
body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
header { padding: 16px 20px; background: #24292f; color: #fff; }
header h1 { margin: 0 0 6px; font-size: 18px; }
header .meta { font-size: 13px; opacity: 0.85; }
header code { background: rgba(255,255,255,0.15); padding: 1px 5px; border-radius: 4px; }
.note { color: #9a6700; background: #fff8c5; margin: 12px 20px; padding: 10px 14px; border-radius: 6px; }
.no-changes { margin: 40px 20px; font-size: 16px; color: #1a7f37; }
.content { padding: 12px; }
</style>
</head>
<body>
<header>
  <h1>${escapeHtml(TITLE)}</h1>
  <div class="meta">${tagLine} &nbsp;·&nbsp; ${summary.filesChanged} files changed &nbsp;·&nbsp; <span style="color:#3fb950">+${summary.additions}</span> / <span style="color:#f85149">-${summary.deletions}</span></div>
</header>
${noteHtml}
<div class="content">
${body}
</div>
</body>
</html>
`;
}

function oversizedNotice(diffBytes: number): string {
  const mb = (diffBytes / (1024 * 1024)).toFixed(1);
  return `<div class="no-changes">
  ⚠️ The diff is too large to render inline (${mb} MB).
  <br />Download the raw unified diff instead: <a href="diff.txt">diff.txt</a>.
</div>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

main().catch((err) => {
  console.error(pc.red(`Fatal error: ${err?.stack ?? err}`));
  process.exit(1);
});
