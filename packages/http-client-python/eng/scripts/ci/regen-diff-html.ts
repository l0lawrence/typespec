/* eslint-disable no-console */
/**
 * Regen-diff HTML reporter.
 *
 * Compares two directories of generated code (a pinned baseline vs the PR head)
 * and produces:
 *   - <out>/regen-diff.patch       raw unified diff (git diff --no-index)
 *   - <out>/regen-diff.html        colorized, per-file HTML view of the diff
 *   - <out>/comment-body.md        markdown body for the PR comment
 *   - <out>/result.json            { hasDiff, filesChanged, insertions, deletions }
 *
 * Exit code is always 0; the workflow decides whether to fail based on result.json.
 *
 * Usage:
 *   tsx regen-diff-html.ts --base <dir> --head <dir> --out <dir> [--baseline-sha <sha>]
 */

import { spawnSync } from "child_process";
import { mkdirSync, writeFileSync } from "fs";
import { join, resolve } from "path";
import { parseArgs } from "util";

const { values } = parseArgs({
  options: {
    base: { type: "string" },
    head: { type: "string" },
    out: { type: "string" },
    "baseline-sha": { type: "string" },
  },
});

if (!values.base || !values.head || !values.out) {
  console.error("Usage: tsx regen-diff-html.ts --base <dir> --head <dir> --out <dir>");
  process.exit(2);
}

const baseDir = resolve(values.base);
const headDir = resolve(values.head);
const outDir = resolve(values.out);
const baselineSha = values["baseline-sha"] ?? "";

mkdirSync(outDir, { recursive: true });

// git diff --no-index exits 1 when there are differences; that is not an error for us.
const diff = spawnSync(
  "git",
  [
    "--no-pager",
    "diff",
    "--no-index",
    "--no-color",
    "--src-prefix=baseline/",
    "--dst-prefix=head/",
    "--",
    baseDir,
    headDir,
  ],
  { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 },
);

if (diff.status !== 0 && diff.status !== 1) {
  console.error(`git diff failed (status ${diff.status}): ${diff.stderr}`);
  process.exit(2);
}

const patch = diff.stdout ?? "";
writeFileSync(join(outDir, "regen-diff.patch"), patch);

interface FileDiff {
  path: string;
  status: "modified" | "added" | "removed";
  lines: string[];
  insertions: number;
  deletions: number;
  oldPath?: string;
  newPath?: string;
}

// Git C-quotes paths containing special characters (e.g. backslashes on Windows):
//   "head/C:\\Users\\..." -> head/C:\Users\...
function unquote(p: string): string {
  if (p.length >= 2 && p.startsWith('"') && p.endsWith('"')) {
    return p.slice(1, -1).replace(/\\t/g, "\t").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  }
  return p;
}

// Reduce a diff header path to a package-relative path:
//   strip git's baseline/ | head/ prefix, then the absolute baseDir/headDir prefix.
function normalizePath(raw: string): string {
  let p = unquote(raw.trim()).replace(/^(baseline|head)[/\\]/, "");
  for (const root of [headDir, baseDir]) {
    for (const v of [root, root.replace(/\\/g, "/")]) {
      if (p.startsWith(v)) {
        p = p.slice(v.length);
        break;
      }
    }
  }
  return p.replace(/^[/\\]+/, "").replace(/\\/g, "/");
}

function parseDiff(raw: string): FileDiff[] {
  const files: FileDiff[] = [];
  const lines = raw.split("\n");
  let current: FileDiff | null = null;

  for (const line of lines) {
    if (line.startsWith("diff --git ")) {
      if (current) files.push(current);
      current = { path: "", status: "modified", lines: [], insertions: 0, deletions: 0 };
      continue;
    }
    if (!current) continue;

    if (line.startsWith("--- ")) {
      const p = line.slice(4);
      if (p === "/dev/null") current.status = "added";
      else current.oldPath = p;
      continue;
    }
    if (line.startsWith("+++ ")) {
      const p = line.slice(4);
      if (p === "/dev/null") current.status = "removed";
      else current.newPath = p;
      continue;
    }
    if (line.startsWith("rename from ") || line.startsWith("rename to ")) {
      current.path = normalizePath(line.replace(/^rename (from|to) /, ""));
      continue;
    }
    if (
      line.startsWith("index ") ||
      line.startsWith("new file") ||
      line.startsWith("deleted file")
    ) {
      continue;
    }
    // Body lines (hunks).
    current.lines.push(line);
    if (line.startsWith("+") && !line.startsWith("+++")) current.insertions++;
    else if (line.startsWith("-") && !line.startsWith("---")) current.deletions++;
  }
  if (current) files.push(current);

  for (const f of files) {
    if (!f.path) {
      const src = f.newPath ?? f.oldPath;
      if (src) f.path = normalizePath(src);
    }
  }
  return files.filter((f) => f.path);
}

const files = parseDiff(patch);
const insertions = files.reduce((s, f) => s + f.insertions, 0);
const deletions = files.reduce((s, f) => s + f.deletions, 0);
const hasDiff = files.length > 0;

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderFile(f: FileDiff): string {
  const rows = f.lines
    .map((l) => {
      let cls = "ctx";
      if (l.startsWith("@@")) cls = "hunk";
      else if (l.startsWith("+")) cls = "add";
      else if (l.startsWith("-")) cls = "del";
      return `<div class="line ${cls}">${escapeHtml(l) || "&nbsp;"}</div>`;
    })
    .join("\n");
  const badge = f.status === "added" ? "added" : f.status === "removed" ? "removed" : "modified";
  return `
  <details class="file" open>
    <summary>
      <span class="badge ${badge}">${badge}</span>
      <span class="fname">${escapeHtml(f.path)}</span>
      <span class="stat"><span class="ins">+${f.insertions}</span> <span class="dels">-${f.deletions}</span></span>
    </summary>
    <div class="code">${rows}</div>
  </details>`;
}

const generatedAt = new Date().toISOString();
const summaryRows = files
  .map(
    (f) =>
      `<tr><td><code>${escapeHtml(f.path)}</code></td><td>${f.status}</td><td class="ins">+${f.insertions}</td><td class="dels">-${f.deletions}</td></tr>`,
  )
  .join("\n");

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Python emitter regen diff</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; margin: 0; padding: 1.5rem; background: #0d1117; color: #c9d1d9; }
  h1 { font-size: 1.4rem; }
  .meta { color: #8b949e; font-size: .85rem; margin-bottom: 1rem; }
  .meta code { color: #c9d1d9; }
  table { border-collapse: collapse; margin: 1rem 0; font-size: .85rem; }
  th, td { border: 1px solid #30363d; padding: .25rem .6rem; text-align: left; }
  th { background: #161b22; }
  .ins { color: #3fb950; }
  .dels { color: #f85149; }
  .file { border: 1px solid #30363d; border-radius: 6px; margin: 1rem 0; overflow: hidden; }
  .file > summary { cursor: pointer; padding: .5rem .75rem; background: #161b22; font-size: .85rem; user-select: none; }
  .file .fname { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  .badge { display: inline-block; border-radius: 4px; padding: 0 .4rem; font-size: .7rem; text-transform: uppercase; margin-right: .5rem; }
  .badge.modified { background: #1f6feb33; color: #58a6ff; }
  .badge.added { background: #23863633; color: #3fb950; }
  .badge.removed { background: #da363333; color: #f85149; }
  .stat { float: right; font-family: ui-monospace, monospace; }
  .code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .8rem; overflow-x: auto; }
  .line { white-space: pre; padding: 0 .75rem; }
  .line.add { background: #033a1633; color: #3fb950; }
  .line.del { background: #67060c33; color: #f85149; }
  .line.hunk { background: #161b22; color: #8b949e; }
  .empty { padding: 2rem; text-align: center; color: #3fb950; font-size: 1.1rem; }
</style>
</head>
<body>
<h1>Python emitter regen diff</h1>
<div class="meta">
  Baseline: <code>${escapeHtml(baselineSha || "(see regen-diff-baseline.txt)")}</code><br />
  Generated: <code>${generatedAt}</code><br />
  Files changed: <strong>${files.length}</strong>,
  <span class="ins">+${insertions}</span> <span class="dels">-${deletions}</span>
</div>
${
  hasDiff
    ? `<table>
<thead><tr><th>File</th><th>Status</th><th>+</th><th>-</th></tr></thead>
<tbody>
${summaryRows}
</tbody>
</table>
${files.map(renderFile).join("\n")}`
    : `<div class="empty">No differences. The PR's emitter produces identical generated code to the baseline. ✅</div>`
}
</body>
</html>`;

writeFileSync(join(outDir, "regen-diff.html"), html);

const commentBody = hasDiff
  ? [
      `### 🐍 Python emitter regen diff`,
      ``,
      `This PR changes the Python emitter. Regenerating against baseline \`${baselineSha.slice(0, 12) || "baseline"}\` produced **${files.length} changed file(s)** (+${insertions} / -${deletions}).`,
      ``,
      `| File | Status | + | - |`,
      `| --- | --- | --- | --- |`,
      ...files
        .slice(0, 50)
        .map((f) => `| \`${f.path}\` | ${f.status} | +${f.insertions} | -${f.deletions} |`),
      files.length > 50 ? `| … and ${files.length - 50} more | | | |` : ``,
      ``,
      `📄 **[Open the full HTML diff](__ARTIFACT_URL__)** (download the \`python-regen-diff-html\` artifact).`,
      ``,
      `If these changes are expected, update the baseline SHA in \`packages/http-client-python/eng/regen-diff-baseline.txt\`.`,
    ]
      .filter((l) => l !== ``)
      .join("\n")
  : [
      `### 🐍 Python emitter regen diff`,
      ``,
      `No generated-code differences against baseline \`${baselineSha.slice(0, 12) || "baseline"}\`. ✅`,
    ].join("\n");

writeFileSync(join(outDir, "comment-body.md"), commentBody + "\n");

writeFileSync(
  join(outDir, "result.json"),
  JSON.stringify(
    { hasDiff, filesChanged: files.length, insertions, deletions, baselineSha },
    null,
    2,
  ) + "\n",
);

console.log(
  hasDiff
    ? `Regen diff: ${files.length} file(s) changed (+${insertions}/-${deletions}). Report at ${join(outDir, "regen-diff.html")}`
    : `Regen diff: no differences.`,
);
