# Renderer benchmarks

Per-renderer timing for the four rendering strategies in this sandbox
(`string`, `template`, `alloy`, `ef-mix`). All four consume the same
renderer-agnostic `SdkShape` IR (built once by `extractSdkShape`) and emit a
12-file Azure-style Python SDK. The only thing that varies between runs is the
rendering technique:

| renderer   | technique                                                                                                                          |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `string`   | Plain TypeScript template literals, dispatched through the shared `python-builders` snippet library.                               |
| `template` | A ~25 LOC mustache-lite engine over the same `python-builders` snippets (file scaffolding from templates, bodies pre-rendered).    |
| `alloy`    | `@alloy-js/python` `<py.SourceFile>` + `<SourceDirectory>` components for file scope, header comments, and auto-managed imports.   |
| `ef-mix`   | Alloy file scaffolding + `@typespec/emitter-framework/python` `<ClassDeclaration>` / `<EnumDeclaration>` for TypeSpec-aware decls. |

All four go through the same `python-builders` snippet library for the
procedural bits (LRO/paged closures, the azure-core PipelineClient wiring, the
explicit-`__init__` / `as_dict` / `from_dict` model shape). So the comparison
isolates the **rendering paradigm cost**, not "how much logic each renderer
re-implements".

## How the numbers were collected

- Hardware/OS: developer workstation, Windows.
- Build: `npx tsc -p .` (warm), `node` `v22.21.0`.
- Driver: a one-liner that runs `tsp compile … --output-dir test/tsp-output-…`
  for each spec, grabs the `[hello-python-emitter] renderer timings` block, and
  aggregates 5 iterations.
- Measurement: `performance.now()` around each `renderer.emit(...)` call in
  `src/emitter.tsx` (i.e. excludes program load + checker, includes
  `writeOutput` / `writeFiles` file I/O).
- Samples: 5 iterations per renderer per spec, **median** reported.
- Inputs:
  - **Small** — `test/sample.tsp` (5 ops, 2 models).
  - **Large** — `test/sample-large.tsp` (28 ops, 12 models).
  - **Widget** — `test/widget-analytics/` (the real Azure REST API
    [WidgetAnalytics](https://github.com/Azure/azure-rest-api-specs/tree/main/specification/widget/data-plane/WidgetAnalytics)
    spec: 5 user-facing ops that expand via Azure.Core templates to **11
    methods**, **7 models**, AAD auth, LRO + paged + sync, `2022-12-01`
    api-version).

> Numbers move ±5 ms between runs. Treat the table as orders of magnitude.

## Results

### Small sample (`test/sample.tsp`, 5 ops / 2 models)

| renderer   | median  |       range | vs `string` |
| ---------- | ------: | ----------: | ----------: |
| `string`   | ~20 ms  |  18 – 26 ms |        1.0× |
| `template` | ~21 ms  |  20 – 22 ms |        1.0× |
| `ef-mix`   | ~32 ms  |  27 – 35 ms |        1.6× |
| `alloy`    | ~52 ms  |  51 – 58 ms |        2.6× |

### Large sample (`test/sample-large.tsp`, 28 ops / 12 models)

| renderer   | median  |       range | vs `string` |
| ---------- | ------: | ----------: | ----------: |
| `string`   | ~22 ms  |  19 – 24 ms |        1.0× |
| `template` | ~20 ms  |  20 – 23 ms |        0.9× |
| `ef-mix`   | ~29 ms  |  28 – 38 ms |        1.3× |
| `alloy`    | ~52 ms  |  50 – 80 ms |        2.4× |

### Widget-analytics (`test/widget-analytics/`, 11 methods / 7 models, LRO + paged + AAD)

| renderer   | median  |       range | vs `string` |
| ---------- | ------: | ----------: | ----------: |
| `string`   | ~21 ms  |  19 – 22 ms |        1.0× |
| `template` | ~21 ms  |  20 – 24 ms |        1.0× |
| `ef-mix`   | ~31 ms  |  29 – 33 ms |        1.5× |
| `alloy`    | ~55 ms  |  53 – 69 ms |        2.6× |

## Takeaways

- **`string` and `template` are essentially tied** (~20 ms) across all three
  specs. Dispatching through the shared `python-builders` is the same cost
  for both; the mustache-lite regex pass in the template renderer is
  negligible. Both scale roughly **flat** with model/op count once you cross
  the "tsp compile" baseline.
- **`alloy` adds ~30 ms of fixed overhead** on top of `string`. That's the
  reactive component graph, the per-file `Scope` setup, refkey resolution,
  and the Prettier-style printer. It does **not** grow much with op count in
  our setup because most of the work is still done by `python-builders`
  snippets passed as string children.
- **`ef-mix` slots in between `string` and `alloy`** (~10 ms more than
  `string`, ~20 ms less than `alloy`). The TypeSpec→Python type expression
  passes EF runs for model/enum declarations are cheap; the EF Output
  context + Alloy file scaffolding is what costs.
- **All four are well below 100 ms** even on the largest spec. The 30–50 ms
  Alloy/EF tax is invisible inside a real build pipeline (TS compile, spec
  download, lint, format) — pick the renderer based on **features**, not
  perf:
  - Need raw speed and zero deps? → `string` or `template`.
  - Want auto-managed imports + cross-file refkey resolution? → `alloy`.
  - Want TypeSpec-aware type conversion (`Optional[X]`, `datetime`, enum
    detection) on top? → `ef-mix`.

## What each renderer actually does per call

| renderer   | per-call work                                                                                                                            |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `string`   | Calls `python-builders` for each file → `writeFiles` writes 12 files. No framework overhead.                                              |
| `template` | Same as `string`, plus a ~25 LOC `{{var}}` / `{{#if}}` regex pass on the file-scaffold templates. Bodies still come from snippets.       |
| `alloy`    | Builds a `<Output>` reactive tree, opens a `Scope` per file, runs `ImportStatements` + a Prettier-style printer, calls `writeOutput`.    |
| `ef-mix`   | Same as `alloy`, plus `<ef.ClassDeclaration>` / `<ef.EnumDeclaration>` traverse TypeSpec types and call EF's `<TypeExpression>` engine. |

## Reproducing

Build once, then run any of the per-spec compiles:

```powershell
cd packages/hello-python-emitter
npx tsc -p .

# All 4 renderers in one compile (default; prints the timings block):
node ../compiler/cmd/tsp.js compile test/widget-analytics `
  --emit @typespec/hello-python-emitter `
  --output-dir test/tsp-output-widget-all

# One specific renderer:
node ../compiler/cmd/tsp.js compile test/widget-analytics `
  --emit @typespec/hello-python-emitter `
  --option "@typespec/hello-python-emitter.renderer=alloy" `
  --output-dir test/tsp-output-widget-alloy
```

Each compile prints a timings block:

```
[hello-python-emitter] renderer timings:
  string      21.39 ms
  template    20.63 ms
  ef-mix      31.04 ms
  alloy       54.92 ms
```

To collect a stable sample like the tables above, loop 5×:

```powershell
$samples = @()
for ($i = 0; $i -lt 5; $i++) {
  $out = node ../compiler/cmd/tsp.js compile test/widget-analytics `
    --emit @typespec/hello-python-emitter `
    --output-dir test/tsp-output-widget-all 2>&1 | Out-String
  [regex]::Matches($out, '(\w+(?:-\w+)?)\s+([\d.]+) ms') | ForEach-Object {
    $samples += [pscustomobject]@{ renderer=$_.Groups[1].Value; ms=[double]$_.Groups[2].Value }
  }
}
$samples | Group-Object renderer | ForEach-Object {
  $vals = $_.Group.ms | Sort-Object
  "$($_.Name) : median=$($vals[[math]::Floor($vals.Count/2)]) ms"
}
```

## vs `@typespec/http-client-python` (the production Azure Python emitter)

To put the sandbox numbers in perspective, we ran the same widget spec through
the real `@typespec/http-client-python` emitter — the one Azure SDKs ship from.
It's a fundamentally different beast (TS code-model → YAML → Python
[`pygen`](../http-client-python/generator/pygen) subprocess → `black` → `pylint`),
so the comparison is more "two emitters, different design points" than
"four flavors of the same idea". The headline:

| emitter                                              | widget median |       range |   files |   .py |  bytes | vs `string` |
| ---------------------------------------------------- | ------------: | ----------: | ------: | ----: | -----: | ----------: |
| `hello-python-emitter` — `string`                    |        ~21 ms |  19 – 22 ms |   12    |  11   |  21 KB |        1.0× |
| `hello-python-emitter` — `template`                  |        ~21 ms |  20 – 24 ms |   12    |  11   |  21 KB |        1.0× |
| `hello-python-emitter` — `ef-mix`                    |        ~31 ms |  29 – 33 ms |   12    |  11   |  21 KB |        1.5× |
| `hello-python-emitter` — `alloy`                     |        ~55 ms |  53 – 69 ms |   12    |  11   |  21 KB |        2.6× |
| **`@typespec/http-client-python` — `flavor=azure`**  |    **~5.0 s** | 4.7 – 5.5 s | **31**  | **22**| **245 KB** | **~240×** |

Run with:

```powershell
node ../compiler/cmd/tsp.js compile test/widget-analytics `
  --emit C:/path/to/typespec/packages/http-client-python `
  --output-dir test/tsp-output-widget-real `
  --option "@typespec/http-client-python.flavor=azure"
```

(`http-client-python` is excluded from the monorepo's pnpm workspace, so it has
to be referenced by absolute path; `flavor=azure` is required because the spec
uses LROs and `pygen` rejects those for the `unbranded` flavor.)

### What you're actually comparing

`@typespec/http-client-python` does **a lot** more per call than this sandbox.
Apples-to-apples it isn't, but it tells you what the "production-shaped"
ceiling looks like:

| dimension                       | `hello-python-emitter`                                      | `@typespec/http-client-python`                                              |
| ------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------- |
| Output package                  | 11 `.py` files in a flat client/operations/models layout    | 22 `.py` files: sync **and** `aio/` async variants, `_utils/model_base.py`, `_utils/serialization.py`, `_patch.py` hooks, `_version.py`, `_configuration.py` |
| Packaging                       | None                                                         | `pyproject.toml`, `MANIFEST.in`, `LICENSE`, `README.md`, `CHANGELOG.md`, `dev_requirements.txt`, `apiview-properties.json`, `_metadata.json` |
| Architecture                    | Pure TypeScript end-to-end                                  | TS emitter → YAML code-model → `execSync("python … pygen")` subprocess → `black` autoformat → `pylint` check |
| Code generator backend          | `python-builders` snippet library (~640 LOC)                | `pygen` (Jinja2 templates, ~thousands of LOC of Python codegen logic)       |
| Format / lint pass              | None (we emit final text directly)                          | `black --line-length=120` + `pylint` over the whole output tree              |
| TCGC features used              | A handful: clients, methods, params, models, enums          | Multiapi, visibility-aware serialization, model versioning, polymorphism, paging variants, LRO polling strategies, credentials, retry/auth policies, … |
| Generated lines per call (widget) | ~600 LOC                                                  | ~7 500 LOC                                                                   |
| Time per call (widget)          | 21 – 55 ms                                                  | ~5 000 ms (incl. ~3 s `pygen` + ~1.5 s `black` + `pylint`)                  |

### Takeaways

- **The pure-TS renderers are 100–240× faster** than the real emitter on the
  same spec. That's expected — they don't fork a Python interpreter, don't
  shell out to `black`, don't lint the output, and don't generate 4× as many
  files.
- **Most of `http-client-python`'s wall time is the Python subprocess + format
  + lint passes**, not "TypeScript codegen is slow". A pure-TS rewrite of the
  same emitter would likely land somewhere between `alloy` (55 ms) and a few
  hundred milliseconds for the widget spec.
- **For local dev loops** (single spec, you want to inspect output), the 5 s
  cost is the dominant cost — invisible if your test suite already pays it,
  noticeable if you're iterating on the emitter itself.
- **For batch generation** (e.g. regenerating dozens of azure-sdk packages in
  CI), the 5 s scales linearly: 100 specs ≈ 8 min of pygen+black+pylint time.
  That's where moving format/lint out of band, or batching specs into one
  Python invocation (the `emit-yaml-only` mode does exactly this), pays off.
- **`hello-python-emitter` is not a replacement** — it doesn't generate `aio/`,
  doesn't generate packaging, doesn't generate `_patch.py` hooks, doesn't
  handle multiapi, doesn't validate versioning. It's a sandbox to compare
  rendering paradigms on a fixed Azure-shaped output. The "240× faster"
  number means "240× faster at doing 1/10th of the work".

### Why `sample.tsp` / `sample-large.tsp` aren't in this table

`http-client-python` requires the spec to define at least one `@service` /
client; both `sample.tsp` and `sample-large.tsp` are bare operations without
one, so the emitter exits in ~7 ms with the
`@azure-tools/typespec-python/no-sdk-clients` error before doing any real work.
Our four renderers don't enforce that constraint and emit happily either way,
so we only have a head-to-head number on the widget spec.
