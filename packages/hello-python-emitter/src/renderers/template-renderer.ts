import type { EmitContext } from "@typespec/compiler";
import type { HelloPythonEmitterOptions } from "../lib.js";
import type { SdkShape } from "../sdk-ir.js";
import { writeFiles } from "./files.js";
import * as py from "./python-builders.js";
import type { OutputFile, Renderer } from "./types.js";

/* ──────────────────────────────────────────────────────────────────
 * Template renderer — fills mustache-lite Python file templates
 * with pre-rendered Python snippets from the shared `python-builders`
 * module. The interesting bit here is the engine (~25 LOC below);
 * file-level layout lives in the templates, and per-class /
 * per-method blocks are pre-joined in `prepareCtx` so the templates
 * stay flat (mustache-lite has no nested loops).
 *
 * Template syntax:
 *   {{var}}                  context lookup (supports dotted paths)
 *   {{#if flag}}...{{/if}}   conditional block
 *
 * (No {{#each}} blocks needed: lists are pre-joined into ready-
 * to-paste blocks in `prepareCtx`.)
 * ────────────────────────────────────────────────────────────── */

type Ctx = Record<string, unknown>;

const RID = "template";

export function renderTemplate(tpl: string, ctx: Ctx): string {
  tpl = tpl.replace(/\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_m, key, body) => {
    return ctx[key] ? body : "";
  });
  tpl = tpl.replace(/\{\{([\w.]+)\}\}/g, (_m, path) => String(resolve(path, ctx) ?? ""));
  return tpl;
}

function resolve(path: string, ctx: Ctx): unknown {
  const parts = path.split(".");
  let cur: unknown = ctx;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

/* ─────────────────────  Per-file templates  ─────────────────────── */

const TOP_INIT_TPL = `{{header}}
from ._client import {{clientName}}
from ._version import VERSION as __version__

__all__ = ["{{clientName}}", "__version__"]
`;

const VERSION_TPL = `{{header}}
VERSION = "{{version}}"
`;

const OPERATIONS_INIT_TPL = `{{header}}
from ._operations import {{opsClass}}

__all__ = ["{{opsClass}}"]
`;

const MODELS_INIT_TPL = `{{header}}
{{#if hasModels}}from ._models import {{modelImports}}
{{/if}}{{#if hasEnums}}from ._enums import {{enumImports}}
{{/if}}
{{#if hasAny}}__all__ = [{{allList}}]
{{/if}}{{#if hasNothing}}__all__: list[str] = []
{{/if}}`;

const MODELS_TPL = `{{header}}
from __future__ import annotations

import datetime
import decimal
from typing import Any, ClassVar, Dict, List, Mapping, Optional

from .._vendor import _from_dict, _parse_datetime, _to_dict
{{#if hasEnums}}from ._enums import {{enumImports}}
{{/if}}

{{modelsBlock}}`;

const ENUMS_TPL = `{{header}}
from enum import Enum


{{enumsBlock}}`;

const OPERATIONS_TPL = `{{header}}
from typing import Any, Optional

from azure.core.exceptions import HttpResponseError
{{#if hasPaged}}from azure.core.paging import ItemPaged
{{/if}}{{#if hasLro}}from azure.core.polling import LROPoller
from azure.core.polling.base_polling import LROBasePolling
{{/if}}from azure.core.rest import HttpRequest

from .._vendor import _api_version_query, _from_dict, _to_dict
{{#if hasModels}}from ..models._models import {{modelImports}}
{{/if}}{{#if hasEnums}}from ..models._enums import {{enumImports}}
{{/if}}

class {{opsClass}}:
    """{{opsDocstring}}"""

    def __init__(self, client, config) -> None:
        self._client = client
        self._config = config

{{operationsBlock}}`;

const PATCH_TPL = `# Customize generated code here.
#
# Anything added or modified here is preserved across regenerations.

def patch_sdk() -> None:
    pass
`;

/* ─────────────────────  Context construction  ────────────────────── */

/** Join per-construct line arrays with one blank line between, plus a trailing newline. */
function joinBlocks(blocks: string[][]): string {
  if (blocks.length === 0) return "";
  return blocks.map((b) => b.join("\n")).join("\n\n") + "\n";
}

function prepareCtx(shape: SdkShape): Ctx {
  const opsClass = `${shape.serviceName}Operations`;
  const modelNames = shape.models.map((m) => m.pyName);
  const enumNames = shape.enums.map((e) => e.pyName);
  return {
    // `header()` already ends in `\n`; the template adds the blank line
    // after it via a literal newline so we match the string renderer's
    // `[header, ...].join("\n")` output exactly.
    header: py.header(RID),
    clientName: shape.clientName,
    version: shape.version,
    opsClass,
    opsDocstring: py.docstring(`${shape.serviceName} operations`),
    hasModels: modelNames.length > 0,
    hasEnums: enumNames.length > 0,
    hasAny: modelNames.length + enumNames.length > 0,
    hasNothing: modelNames.length + enumNames.length === 0,
    modelImports: modelNames.join(", "),
    enumImports: enumNames.join(", "),
    allList: [...modelNames, ...enumNames].map((n) => `"${n}"`).join(", "),
    hasPaged: shape.operations.some((o) => o.paged),
    hasLro: shape.operations.some((o) => o.lro),
    operationsBlock: joinBlocks(shape.operations.map((op) => py.renderOperation(op, "    "))),
    modelsBlock: shape.models.length
      ? joinBlocks(shape.models.map((m) => py.renderModel(m)))
      : "# (no user-defined models found)\n",
    enumsBlock: shape.enums.length
      ? joinBlocks(shape.enums.map((e) => py.renderEnum(e)))
      : "# (no enums found)\n",
  };
}

/* ──────────────────────────  Renderer  ──────────────────────────── */

export const templateRenderer: Renderer = {
  id: RID,
  description: "Mustache-lite template engine (~20 LOC) filling Python file templates with shared snippets.",
  async emit(context: EmitContext<HelloPythonEmitterOptions>, shape: SdkShape, outputDir) {
    const ctx = prepareCtx(shape);
    // _configuration.py and _client.py have enough auth-mode branching that
    // templating them adds more pain than gain — delegate to shared builders.
    const opsClass = `${shape.serviceName}Operations`;
    const files: OutputFile[] = [
      { path: "__init__.py", content: renderTemplate(TOP_INIT_TPL, ctx) },
      { path: "_version.py", content: renderTemplate(VERSION_TPL, ctx) },
      { path: "_configuration.py", content: py.buildConfiguration(RID, shape) },
      { path: "_client.py", content: py.buildClient(RID, shape, opsClass) },
      { path: "_vendor.py", content: py.buildVendor(RID) },
      { path: "py.typed", content: "" },
      { path: "operations/__init__.py", content: renderTemplate(OPERATIONS_INIT_TPL, ctx) },
      { path: "operations/_operations.py", content: renderTemplate(OPERATIONS_TPL, ctx) },
      { path: "models/__init__.py", content: renderTemplate(MODELS_INIT_TPL, ctx) },
      { path: "models/_models.py", content: renderTemplate(MODELS_TPL, ctx) },
      { path: "models/_enums.py", content: renderTemplate(ENUMS_TPL, ctx) },
      { path: "models/_patch.py", content: PATCH_TPL },
    ];
    await writeFiles(context.program, outputDir, files);
  },
};
