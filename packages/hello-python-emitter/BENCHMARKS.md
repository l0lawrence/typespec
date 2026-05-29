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
