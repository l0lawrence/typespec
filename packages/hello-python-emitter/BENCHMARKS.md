# Renderer benchmarks

Per-renderer timing for the four rendering strategies in this sandbox
(`string`, `template`, `alloy`, `ef-mix`). All four consume the same
renderer-agnostic `SdkShape` IR (built once by `extractSdkShape`) and emit a
12-file Azure-style Python SDK. The only thing that varies between runs is the
rendering technique:

| renderer   | technique                                                                                                                                               |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `string`   | Plain TypeScript template literals, dispatched through the shared `python-builders` snippet library.                                                    |
| `template` | A ~25 LOC mustache-lite engine over the same `python-builders` snippets (file scaffolding from templates, bodies pre-rendered).                         |
| `alloy`    | `@alloy-js/python` `ClassDeclaration`, `MethodDeclaration`, `FunctionDeclaration` etc. for all structural constructs; method bodies as string children. |
| `ef-mix`   | Alloy file scaffolding + `@typespec/emitter-framework/python` `<ClassDeclaration>` / `<EnumDeclaration>` for TypeSpec-aware decls.                      |

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

| renderer   | median |      range | vs `string` |
| ---------- | -----: | ---------: | ----------: |
| `template` | ~20 ms | 19 – 23 ms |        1.0× |
| `string`   | ~21 ms | 19 – 25 ms |        1.0× |
| `ef-mix`   | ~29 ms | 27 – 36 ms |        1.4× |
| `alloy`    | ~73 ms | 72 – 81 ms |        3.5× |

### Large sample (`test/sample-large.tsp`, 28 ops / 12 models)

| renderer   | median |      range | vs `string` |
| ---------- | -----: | ---------: | ----------: |
| `template` | ~19 ms | 18 – 21 ms |        1.0× |
| `string`   | ~20 ms | 18 – 22 ms |        1.0× |
| `ef-mix`   | ~30 ms | 27 – 34 ms |        1.5× |
| `alloy`    | ~83 ms | 75 – 88 ms |        4.2× |

### Widget-analytics (`test/widget-analytics/`, 11 methods / 7 models, LRO + paged + AAD)

| renderer   |  median |        range | vs `string` |
| ---------- | ------: | -----------: | ----------: |
| `template` |  ~23 ms |   19 – 30 ms |        1.0× |
| `string`   |  ~23 ms |   22 – 24 ms |        1.0× |
| `ef-mix`   |  ~31 ms |   28 – 41 ms |        1.4× |
| `alloy`    | ~142 ms | 117 – 147 ms |        6.2× |

## Takeaways

- **`string` and `template` are essentially tied** (~20 ms) across all three
  specs. Dispatching through the shared `python-builders` is the same cost
  for both; the mustache-lite regex pass in the template renderer is
  negligible. Both scale roughly **flat** with model/op count once you cross
  the "tsp compile" baseline.
- **`alloy` adds ~50–120 ms of overhead** on top of `string`. Every class,
  method, function, and enum is a real Alloy component (`ClassDeclaration`,
  `MethodDeclaration`, `FunctionDeclaration`, etc.); only the imperative
  method bodies (LRO polling, paging closures, dict serialisation) remain as
  string children. The cost comes from the reactive component graph, per-file
  `Scope` setup, symbol creation per declaration, and the Prettier-style
  printer. It scales with op/model count on the widget-analytics spec because
  each operation and model instantiates multiple Alloy components.
- **`ef-mix` slots in between `string` and `alloy`** (~10 ms more than
  `string`, ~40–110 ms less than `alloy`). EF reuses Alloy's file scaffolding
  but only creates components for model/enum declarations, keeping the
  component count low.
- **All four are well under 200 ms** even on the largest spec. The Alloy
  overhead is invisible inside a real build pipeline (TS compile, spec
  download, lint, format) — pick the renderer based on **features**, not
  perf:
  - Need raw speed and zero deps? → `string` or `template`.
  - Want auto-managed imports + cross-file refkey resolution? → `alloy`.
  - Want TypeSpec-aware type conversion (`Optional[X]`, `datetime`, enum
    detection) on top? → `ef-mix`.

## What each renderer actually does per call

| renderer   | per-call work                                                                                                                                                                                  |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `string`   | Calls `python-builders` for each file → `writeFiles` writes 12 files. No framework overhead.                                                                                                   |
| `template` | Same as `string`, plus a ~25 LOC `{{var}}` / `{{#if}}` regex pass on the file-scaffold templates. Bodies still come from snippets.                                                             |
| `alloy`    | Builds a `<Output>` reactive tree with `ClassDeclaration`, `MethodDeclaration`, `FunctionDeclaration` per construct; method bodies are string children. Prettier-style printer, `writeOutput`. |
| `ef-mix`   | Same as `alloy`, plus `<ef.ClassDeclaration>` / `<ef.EnumDeclaration>` traverse TypeSpec types and call EF's `<TypeExpression>` engine.                                                        |

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

| emitter                                            | widget median |       range |  files |    .py |      bytes | vs `string` |
| -------------------------------------------------- | ------------: | ----------: | -----: | -----: | ---------: | ----------: |
| `hello-python-emitter` — `string`                  |        ~21 ms |  19 – 22 ms |     12 |     11 |      21 KB |        1.0× |
| `hello-python-emitter` — `template`                |        ~21 ms |  20 – 24 ms |     12 |     11 |      21 KB |        1.0× |
| `hello-python-emitter` — `ef-mix`                  |        ~31 ms |  29 – 33 ms |     12 |     11 |      21 KB |        1.5× |
| `hello-python-emitter` — `alloy`                   |        ~55 ms |  53 – 69 ms |     12 |     11 |      21 KB |        2.6× |
| **`@typespec/http-client-python` — pygen only**    |    **~1.3 s** | 1.2 – 1.3 s | **31** | **22** | **245 KB** |    **~60×** |
| **`@typespec/http-client-python` — full pipeline** |    **~4.9 s** | 4.8 – 5.7 s | **31** | **22** | **245 KB** |   **~230×** |

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

### Where the 4.9 s actually goes

We instrumented the three sub-steps of `http-client-python`'s native-Python
path (around `emitter/src/emitter.ts:325`) and ran the widget spec 3 times. The
breakdown is striking — most of the wall time is **`black`**, not codegen:

| phase                                                    | median (3 runs) |    share |
| -------------------------------------------------------- | --------------: | -------: |
| `pygen` (TS code-model + Python subprocess)              |      **~1.3 s** |     ~26% |
| `black --line-length=120 --quiet --fast`                 |      **~3.3 s** | **~69%** |
| `checkForPylintIssues` (custom JS pass, NOT real pylint) |          ~15 ms |      <1% |
| TS emitter overhead (YAML dump, fs, option marshalling)  |         ~230 ms |      ~5% |
| **full emitter wall time**                               |      **~4.9 s** |     100% |

A couple of things worth flagging:

- **`black` dominates.** Roughly **70 % of the wall time is autoformatting
  the 22 generated files**, not generating them. `black` has slow
  startup on Windows + has to parse + reformat every `.py` file even with
  `--fast`. If you're benchmarking "Python codegen", you mostly aren't.
- **`checkForPylintIssues` is misnamed.** It's a ~15 ms JS pass that prepends
  `# pylint: disable=...` comments to lines that would trip pylint — it
  doesn't invoke pylint at all. So the "lint" cost is essentially zero.
- **Codegen itself is ~1.3 s** — that's the TS emitter building the YAML
  code-model + `execSync`-ing `pygen` (the Jinja2-based Python generator) +
  pygen writing 22 files. ~60× the `string` renderer, but that includes a
  Python subprocess boot, a YAML round-trip, and ~12× more output bytes.
- **Cold vs warm matters.** First-run `pygen` was ~2.85 s total, subsequent
  runs ~1.44 s. Most of the difference is OS file cache + Python interpreter
  startup. We report warm numbers.

To reproduce the per-phase breakdown:

```powershell
# Patch emitter/src/emitter.ts around the pygen / black / pylint execSyncs
# with performance.now() pairs and an HCP_SKIP_FORMAT env-var gate, then:
cd packages/http-client-python
npx tsc -p ./emitter/tsconfig.build.json

cd ../hello-python-emitter
$env:HCP_SKIP_FORMAT = '1'   # skip black + pylint
node ../compiler/cmd/tsp.js compile test/widget-analytics `
  --emit C:/.../packages/http-client-python `
  --output-dir test/tsp-output-widget-real `
  --option "@typespec/http-client-python.flavor=azure"
```

### What you're actually comparing

`@typespec/http-client-python` does **a lot** more per call than this sandbox.
Apples-to-apples it isn't, but it tells you what the "production-shaped"
ceiling looks like:

| dimension                         | `hello-python-emitter`                                   | `@typespec/http-client-python`                                                                                                                               |
| --------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Output package                    | 11 `.py` files in a flat client/operations/models layout | 22 `.py` files: sync **and** `aio/` async variants, `_utils/model_base.py`, `_utils/serialization.py`, `_patch.py` hooks, `_version.py`, `_configuration.py` |
| Packaging                         | None                                                     | `pyproject.toml`, `MANIFEST.in`, `LICENSE`, `README.md`, `CHANGELOG.md`, `dev_requirements.txt`, `apiview-properties.json`, `_metadata.json`                 |
| Architecture                      | Pure TypeScript end-to-end                               | TS emitter → YAML code-model → `execSync("python … pygen")` subprocess → `black` autoformat → `pylint` check                                                 |
| Code generator backend            | `python-builders` snippet library (~640 LOC)             | `pygen` (Jinja2 templates, ~thousands of LOC of Python codegen logic)                                                                                        |
| Format / lint pass                | None (we emit final text directly)                       | `black --line-length=120` + `pylint` over the whole output tree                                                                                              |
| TCGC features used                | A handful: clients, methods, params, models, enums       | Multiapi, visibility-aware serialization, model versioning, polymorphism, paging variants, LRO polling strategies, credentials, retry/auth policies, …       |
| Generated lines per call (widget) | ~600 LOC                                                 | ~7 500 LOC                                                                                                                                                   |
| Time per call (widget)            | 21 – 55 ms                                               | ~5 000 ms (incl. ~3 s `pygen` + ~1.5 s `black` + `pylint`)                                                                                                   |

### Takeaways

- **The pure-TS renderers are 60–230× faster** than the real emitter on the
  same spec, depending on whether you count `black` autoformat in the
  comparison or not. Without `black`, the gap is "60× because of a Python
  subprocess + 12× more output bytes". With `black`, the gap is "230×
  because formatting Python is slow."
- **Most of `http-client-python`'s wall time (~70 %) is `black`** — not
  pygen, not the TS side, not "lint". A pure-TS rewrite of pygen could
  plausibly close the codegen gap (1.3 s → low hundreds of ms), but as
  long as the output goes through `black` afterwards, the floor is
  ~3 seconds for a widget-sized spec.
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
