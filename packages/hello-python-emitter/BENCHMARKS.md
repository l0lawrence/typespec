# Renderer benchmarks

Per-renderer timing for the four rendering strategies in this sandbox
(`string`, `template`, `alloy`, `ef-mix`). All four produce the same 10-file
Python SDK shape from the same `SdkShape` IR — the only thing that varies is
the rendering technique.

## How the numbers were collected

- Hardware/OS: developer workstation, Windows.
- Build: `npx tsc -p .` (warm).
- Driver: `./run-all.ps1 -SkipBuild` (one `tsp compile` per renderer so each
  run includes program load + checker + emitter, not just rendering).
- Measurement: `performance.now()` around each `renderer.emit(...)` call in
  `src/emitter.tsx`. Reported as `[hello-python-emitter] renderer timings`
  after each compile.
- Samples: 5 iterations per renderer per sample, median reported.
- Inputs:
  - **Small**: `test/sample.tsp` — 2 models, 5 ops.
  - **Large**: `test/sample-large.tsp` — ~12 models, ~30 ops.

> Numbers will move around a bit between runs (±5 ms for string/template,
> ±20 ms for alloy/ef-mix). Treat the table below as orders of magnitude,
> not exact values.

## Results

### Small sample (2 models, 5 ops)

| renderer   | median  | range       | vs `string` |
| ---------- | ------: | ----------: | ----------: |
| `string`   |  ~21 ms |  17 – 22 ms |        1.0× |
| `template` |  ~22 ms |  18 – 27 ms |        1.0× |
| `ef-mix`   |  ~70 ms |  67 – 81 ms |        3.3× |
| `alloy`    |  ~80 ms |  78 – 86 ms |        3.8× |

### Large sample (~12 models, ~30 ops)

| renderer   |  median  | range         | vs `string` |
| ---------- | -------: | ------------: | ----------: |
| `string`   |   ~23 ms |   20 –  25 ms |        1.0× |
| `template` |   ~24 ms |   20 –  42 ms |        1.0× |
| `ef-mix`   |  ~200 ms |  161 – 216 ms |        8.7× |
| `alloy`    |  ~204 ms |  181 – 225 ms |        8.9× |

## Takeaways

- **`string` and `template` are essentially tied.** Both finish in ~20–25 ms
  regardless of input size. Their cost is dominated by `emitFile` I/O (10
  files), not by string building or regex passes. They scale roughly **flat**
  with model/op count.
- **`alloy` and `ef-mix` cost ~10× more on the large sample**, and the gap
  grows roughly **linearly** with the number of declarations. That overhead
  buys you:
  - a reactive component graph,
  - refkey-driven auto-imports,
  - Prettier-style line-wrapping and formatting,
  - cross-file type references and TypeSpec-aware type conversion (ef-mix only).
- **`ef-mix` vs `alloy` is a wash.** On small inputs ef-mix is slightly faster;
  on large inputs alloy edges ahead. Both are within noise of each other — pick
  based on features, not perf.

## Mental model

| renderer   | what it actually does per call                                                                                                  |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `string`   | Concatenates template literals → 10 × `emitFile`. Almost zero overhead on top of file I/O.                                       |
| `template` | Same as `string`, plus a ~25 LOC `{{…}}` / `{{#each}}` regex pass per file. The regex cost is negligible at SDK size.            |
| `alloy`    | Builds a full reactive `<Output>` tree, resolves refkeys across files, runs a Prettier-style printer. Per-symbol cost.           |
| `ef-mix`   | Same as `alloy`, plus `@typespec/emitter-framework/python` does TypeSpec-aware type → Python conversion and auto-imports.        |

## When to pick which

- **Need raw speed / tiny emitter / one-off codegen?** → `string` or `template`.
- **Want auto-imports + Python formatting + refkey resolution?** → `alloy`.
- **Want all of the above plus TypeSpec-aware type conversion and EF helpers?**
  → `ef-mix`.

At SDK sizes (tens to hundreds of ops), the ~200 ms overhead of `alloy` /
`ef-mix` is dwarfed by the rest of a real build pipeline (TypeScript compile,
spec download, lint, format). It's not a real perf concern — it's a complexity
trade-off.

## Reproducing

```powershell
cd packages/hello-python-emitter
./run-all.ps1                       # build + 4 compiles, prints timings
./run-all.ps1 -Sample test/sample-large.tsp -SkipBuild
```

Or for a single renderer:

```powershell
node ../compiler/cmd/tsp.js compile test/sample.tsp `
  --emit @typespec/hello-python-emitter `
  --option "@typespec/hello-python-emitter.renderer=alloy" `
  --output-dir test/tsp-output-alloy
```

Each compile prints a block like:

```
[hello-python-emitter] renderer timings:
  string      20.46 ms
  template    21.00 ms
  alloy      181.04 ms
  ef-mix     200.32 ms
```
