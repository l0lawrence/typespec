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

// Each changed file is rendered as its own page, so we never build one giant
// HTML string (which throws `RangeError: Invalid string length` past ~512MB).
// A single file whose diff exceeds this is shown as a raw <pre> instead of a
// rich side-by-side render, to bound per-page memory/size.
const MAX_FILE_DIFF_BYTES = 2 * 1024 * 1024;

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
    writeSite(diffText, summary);

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

interface FileDiff {
  /** Display path (baseline/current prefixes stripped). */
  path: string;
  /** Raw unified-diff chunk for just this file. */
  chunk: string;
  additions: number;
  deletions: number;
  status: "added" | "removed" | "modified";
}

/** Splits a `git diff --no-index` blob into one chunk per file. */
function splitDiffByFile(diffText: string): FileDiff[] {
  const files: FileDiff[] = [];
  // Each file section begins with a line `diff --git a/... b/...`.
  const sections = diffText.split(/(?=^diff --git )/m).filter((s) => s.startsWith("diff --git "));
  for (const chunk of sections) {
    const lines = chunk.split("\n");
    let oldPath = "";
    let newPath = "";
    let additions = 0;
    let deletions = 0;
    for (const line of lines) {
      if (line.startsWith("--- ")) {
        oldPath = line.slice(4).trim();
      } else if (line.startsWith("+++ ")) {
        newPath = line.slice(4).trim();
      } else if (line.startsWith("+") && !line.startsWith("+++")) {
        additions += 1;
      } else if (line.startsWith("-") && !line.startsWith("---")) {
        deletions += 1;
      }
    }
    const strip = (p: string): string =>
      p
        .replace(/^["ab]\//, "")
        .replace(/^a\//, "")
        .replace(/^b\//, "")
        .replace(/^baseline\//, "")
        .replace(/^current\//, "");
    const isAdded = oldPath === "/dev/null";
    const isRemoved = newPath === "/dev/null";
    const display = strip(isAdded ? newPath : oldPath) || strip(newPath) || "(unknown)";
    files.push({
      path: display,
      chunk,
      additions,
      deletions,
      status: isAdded ? "added" : isRemoved ? "removed" : "modified",
    });
  }
  files.sort((a, b) => a.path.localeCompare(b.path));
  return files;
}

/** Writes the full multi-page diff site to OUTPUT_DIR. */
function writeSite(diffText: string, summary: DiffSummary): void {
  const cssPath = require.resolve("diff2html/bundles/css/diff2html.min.css");
  const sharedCss = readFileSync(cssPath, "utf8") + "\n" + SITE_CSS;
  writeFileSync(join(OUTPUT_DIR, "diff2html.css"), sharedCss);

  if (!summary.changed) {
    writeFileSync(
      join(OUTPUT_DIR, "index.html"),
      pageShell(
        TITLE,
        headerHtml(summary),
        `<div class="no-changes">✅ No differences from the baseline.</div>`,
        ".",
      ),
    );
    return;
  }

  // Keep a full raw diff available for download.
  writeFileSync(join(OUTPUT_DIR, "diff.txt"), diffText);

  const files = splitDiffByFile(diffText);
  const filesDir = join(OUTPUT_DIR, "files");
  mkdirSync(filesDir, { recursive: true });

  const pad = String(files.length).length;
  files.forEach((file, i) => {
    const name = `${String(i + 1).padStart(pad, "0")}.html`;
    writeFileSync(join(filesDir, name), renderFilePage(file, files, i));
  });

  writeFileSync(join(OUTPUT_DIR, "index.html"), renderIndexPage(files, summary, pad));
}

/** Index page: a searchable, navigable list of all changed files. */
function renderIndexPage(files: FileDiff[], summary: DiffSummary, pad: number): string {
  const rows = files
    .map((f, i) => {
      const href = `files/${String(i + 1).padStart(pad, "0")}.html`;
      const badge =
        f.status === "added"
          ? `<span class="st added">added</span>`
          : f.status === "removed"
            ? `<span class="st removed">removed</span>`
            : `<span class="st modified">modified</span>`;
      return `<tr data-path="${escapeHtml(f.path.toLowerCase())}">
  <td class="st-cell">${badge}</td>
  <td class="path-cell"><a href="${href}">${escapeHtml(f.path)}</a></td>
  <td class="num add">+${f.additions}</td>
  <td class="num del">-${f.deletions}</td>
</tr>`;
    })
    .join("\n");

  const body = `
<input id="filter" type="search" placeholder="Filter ${files.length} files…" autocomplete="off" />
<p class="hint">Click a file to view its side-by-side diff. <a href="diff.txt">Download the full raw diff</a>.</p>
<table class="file-list">
  <thead><tr><th></th><th>File</th><th class="num">+</th><th class="num">−</th></tr></thead>
  <tbody>
${rows}
  </tbody>
</table>
<script>
  const input = document.getElementById('filter');
  const rows = Array.from(document.querySelectorAll('tbody tr'));
  input.addEventListener('input', () => {
    const q = input.value.toLowerCase();
    for (const r of rows) {
      r.style.display = r.getAttribute('data-path').includes(q) ? '' : 'none';
    }
  });
</script>`;

  return pageShell(TITLE, headerHtml(summary), body, ".");
}

/** One page per changed file: rich side-by-side diff with prev/next nav. */
function renderFilePage(file: FileDiff, files: FileDiff[], index: number): string {
  const pad = String(files.length).length;
  const fileName = (i: number): string => `${String(i + 1).padStart(pad, "0")}.html`;
  const prev = index > 0 ? `<a href="${fileName(index - 1)}">← Prev</a>` : `<span class="muted">← Prev</span>`;
  const next =
    index < files.length - 1
      ? `<a href="${fileName(index + 1)}">Next →</a>`
      : `<span class="muted">Next →</span>`;

  const chunkBytes = Buffer.byteLength(file.chunk, "utf8");
  let diffBody: string;
  if (chunkBytes > MAX_FILE_DIFF_BYTES) {
    diffBody = `<div class="no-changes">⚠️ This file's diff is too large to render (${(
      chunkBytes /
      (1024 * 1024)
    ).toFixed(1)} MB). <a href="../diff.txt">View it in the raw diff</a>.</div>`;
  } else {
    try {
      diffBody = diff2html(file.chunk, {
        drawFileList: false,
        matching: "lines",
        outputFormat: "side-by-side",
      });
    } catch (err) {
      console.warn(pc.yellow(`Rendering ${file.path} failed (${err}); showing raw chunk.`));
      diffBody = `<pre class="raw">${escapeHtml(file.chunk)}</pre>`;
    }
  }

  const nav = `<nav class="filenav">
  <a href="../index.html">☰ All files</a>
  <span class="spacer"></span>
  ${prev} <span class="counter">${index + 1} / ${files.length}</span> ${next}
</nav>`;

  const header = `<header>
  <h1>${escapeHtml(file.path)}</h1>
  <div class="meta"><span class="add">+${file.additions}</span> / <span class="del">-${file.deletions}</span> · ${file.status}</div>
</header>`;

  return pageShell(`${file.path} · ${TITLE}`, header + nav, diffBody, "..", nav);
}

function headerHtml(summary: DiffSummary): string {
  const tagLine = summary.baselineTag
    ? `Baseline tag: <code>${escapeHtml(summary.baselineTag)}</code>`
    : "Baseline: <em>none (not bootstrapped)</em>";
  const noteHtml = summary.note ? `<p class="note">⚠️ ${escapeHtml(summary.note)}</p>` : "";
  return `<header>
  <h1>${escapeHtml(TITLE)}</h1>
  <div class="meta">${tagLine} &nbsp;·&nbsp; ${summary.filesChanged} files changed &nbsp;·&nbsp; <span class="add">+${summary.additions}</span> / <span class="del">-${summary.deletions}</span></div>
</header>${noteHtml}`;
}

/** Wraps body content in a full HTML document linking the shared stylesheet. */
function pageShell(
  title: string,
  headerAndNav: string,
  body: string,
  cssBase: string,
  footerNav = "",
): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<link rel="stylesheet" href="${cssBase}/diff2html.css" />
</head>
<body>
${headerAndNav}
<div class="content">
${body}
</div>
${footerNav}
</body>
</html>
`;
}

/** Site chrome shared across all pages (appended to the diff2html stylesheet). */
const SITE_CSS = `
body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #1f2328; }
header { padding: 16px 20px; background: #24292f; color: #fff; }
header h1 { margin: 0 0 6px; font-size: 18px; word-break: break-all; }
header .meta { font-size: 13px; opacity: 0.9; }
header code { background: rgba(255,255,255,0.15); padding: 1px 5px; border-radius: 4px; }
.add { color: #3fb950; }
.del { color: #f85149; }
.note { color: #9a6700; background: #fff8c5; margin: 12px 20px; padding: 10px 14px; border-radius: 6px; }
.no-changes { margin: 40px 20px; font-size: 16px; color: #1a7f37; }
.content { padding: 12px 16px; }
.hint { color: #57606a; font-size: 13px; margin: 8px 0 16px; }
#filter { width: 100%; box-sizing: border-box; padding: 8px 12px; font-size: 14px; border: 1px solid #d0d7de; border-radius: 6px; margin-top: 12px; }
table.file-list { width: 100%; border-collapse: collapse; font-size: 13px; }
table.file-list th { text-align: left; color: #57606a; font-weight: 600; border-bottom: 1px solid #d0d7de; padding: 6px 8px; }
table.file-list td { padding: 5px 8px; border-bottom: 1px solid #eaeef2; }
table.file-list td.path-cell { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
table.file-list td.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
table.file-list a { color: #0969da; text-decoration: none; }
table.file-list a:hover { text-decoration: underline; }
.st { font-size: 11px; padding: 1px 6px; border-radius: 999px; text-transform: uppercase; letter-spacing: .03em; }
.st.added { background: #dafbe1; color: #1a7f37; }
.st.removed { background: #ffebe9; color: #cf222e; }
.st.modified { background: #ddf4ff; color: #0969da; }
nav.filenav { display: flex; align-items: center; gap: 14px; padding: 8px 16px; background: #f6f8fa; border-bottom: 1px solid #d0d7de; font-size: 13px; }
nav.filenav .spacer { flex: 1; }
nav.filenav a { color: #0969da; text-decoration: none; }
nav.filenav .muted { color: #8c959f; }
nav.filenav .counter { color: #57606a; }
pre.raw { white-space: pre-wrap; word-break: break-all; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; background: #f6f8fa; padding: 12px; border-radius: 6px; }
`;

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
