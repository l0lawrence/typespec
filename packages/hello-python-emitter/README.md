# @typespec/hello-python-emitter

A **rendering-strategy sandbox** for Python TypeSpec emitters. The package
takes a single TypeSpec program and generates the **same canonical Python SDK
shape four different ways**, so you can put the outputs side-by-side and see
exactly what each rendering approach gets you.

```
<output>/
  __init__.py
  _version.py
  _client.py
  py.typed
  operations/
    __init__.py
    _operations.py     # stub function per TypeSpec op
  models/
    __init__.py
    _models.py         # dataclass per TypeSpec model
  utils/
    __init__.py
    _utils.py          # placeholder helper
```

## The four renderers

| id         | what it uses                                                                                       | who fills in TypeSpec types                       |
| ---------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `alloy`    | Pure `@alloy-js/core` + `@alloy-js/python` components (`SourceDirectory`, `py.SourceFile`, `py.DataclassDeclaration`, …) | You — small manual `Type → "str"` mapper in `sdk-ir.ts` |
| `ef-mix`   | Alloy components **plus** emitter-framework Python helpers (`<FunctionDeclaration type={op}>`, `<ClassDeclaration type={model}>`) | Emitter-framework (`<TypeExpression>` + auto-imports) |
| `string`   | Raw template-literal strings written via `compiler.emitFile`. No framework.                        | You                                               |
| `template` | A ~25-line mustache-lite engine filling Python templates.                                          | You                                               |

All four consume a single renderer-agnostic IR (`SdkShape`) extracted once by
`extractSdkShape(program)`, so the differences you see between outputs are
**purely** differences in rendering strategy.

## Try it

```bash
# from this package directory
npx tsc -p .
node ../compiler/cmd/tsp.js compile test/sample.tsp \
  --emit @typespec/hello-python-emitter \
  --output-dir test/tsp-output
```

By default (`renderer: "all"`) you get one subdirectory per renderer under the
output dir, perfect for diffing:

```
test/tsp-output/@typespec/hello-python-emitter/
  alloy/      ┐
  ef-mix/     │ same 10 files in each
  string/     │
  template/   ┘
```

```bash
# diff just the models file across renderers
diff alloy/models/_models.py string/models/_models.py
```

## Emitter options

| Option     | Type                                                  | Default | Description                                                                                |
| ---------- | ----------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------ |
| `renderer` | `"alloy" \| "string" \| "template" \| "ef-mix" \| "all"` | `"all"` | Which renderer to use. `"all"` writes each into its own subdirectory.                       |

```yaml
# tspconfig.yaml — pick one
emit:
  - "@typespec/hello-python-emitter"
options:
  "@typespec/hello-python-emitter":
    renderer: "alloy"
```

## What each renderer is good at

- **`alloy`** — Maximum control with structured components. Auto-handles
  Python formatting and import management for Alloy's known builtins (e.g.
  `from dataclasses import dataclass` shows up automatically when you use
  `<py.DataclassDeclaration>`). Verbose for one-off boilerplate text.

- **`ef-mix`** — Cheapest path to *correct TypeSpec-aware* Python. EF does
  `Type → Python` conversion for you and resolves cross-file references
  (e.g. `from ..models._models import Widget` shows up in the operations
  file). Pay for it with one more dependency and EF's opinions about layout.

- **`string`** — Zero framework, zero magic. You see exactly what gets
  written. Best for tiny emitters or for files where the only "logic" is
  shape (config files, version stamps). Doesn't scale — you reimplement
  imports / formatting / refs yourself.

- **`template`** — Middle ground. Static skeletons read like the output;
  loops and conditionals live in `{{#each}}` blocks. The included engine is
  intentionally tiny (≈25 LOC, one level of nesting). Reach for Handlebars /
  EJS / Nunjucks if you need more.

## Project layout

```
src/
  index.ts                       # re-exports $onEmit and $lib
  lib.ts                         # emitter options + diagnostics
  emitter.tsx                    # extracts SdkShape, dispatches to renderer(s)
  sdk-ir.ts                      # SdkShape + Program → SdkShape walker
  renderers/
    types.ts                     # Renderer interface + OutputFile
    files.ts                     # writeFiles helper (compiler.emitFile loop)
    alloy-renderer.tsx           # pure @alloy-js/python
    ef-mix-renderer.tsx          # Alloy + emitter-framework Python helpers
    string-renderer.ts           # raw template literals
    template-renderer.ts         # mustache-lite engine + templates
test/
  sample.tsp                     # toy service used to exercise all renderers
```

## Caveats

This is a learning/sandbox emitter, not a product. It only knows about a
small subset of TypeSpec (scalars, models, arrays, simple ops) and the
generated SDK is intentionally trivial (sync stubs, no HTTP). For a real
production-grade Python emitter, see
[`@typespec/http-client-py`](../http-client-py/README.md).
