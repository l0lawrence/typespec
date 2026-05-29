import type { EmitContext } from "@typespec/compiler";
import type { HelloPythonEmitterOptions } from "../lib.js";
import type { SdkShape } from "../sdk-ir.js";
import { writeFiles } from "./files.js";
import * as py from "./python-builders.js";
import type { OutputFile, Renderer } from "./types.js";

/* ───────────────────────────────────────────────────────────
 * String renderer — assembles files via pure template-literal
 * strings, with no rendering framework. The per-construct
 * Python snippets come from the shared `python-builders` module
 * so all four renderers produce byte-identical output and the
 * comparison surfaces only the file-assembly differences.
 * ───────────────────────────────────────────────────────── */

const RID = "string";

export const stringRenderer: Renderer = {
  id: RID,
  description: "Pure template-literal strings written via compiler.emitFile. Zero rendering framework.",
  async emit(context: EmitContext<HelloPythonEmitterOptions>, shape: SdkShape, outputDir) {
    const opsClass = `${shape.serviceName}Operations`;
    const files: OutputFile[] = [
      { path: "__init__.py", content: py.buildTopInit(RID, shape) },
      { path: "_version.py", content: py.buildVersion(RID, shape) },
      { path: "_configuration.py", content: py.buildConfiguration(RID, shape) },
      { path: "_client.py", content: py.buildClient(RID, shape, opsClass) },
      { path: "_vendor.py", content: py.buildVendor(RID) },
      { path: "py.typed", content: "" },
      { path: "operations/__init__.py", content: py.buildOperationsInit(RID, opsClass) },
      { path: "operations/_operations.py", content: py.buildOperations(RID, shape, opsClass) },
      { path: "models/__init__.py", content: py.buildModelsInit(RID, shape) },
      { path: "models/_models.py", content: py.buildModels(RID, shape) },
      { path: "models/_enums.py", content: py.buildEnums(RID, shape) },
      { path: "models/_patch.py", content: py.buildPatch() },
    ];
    await writeFiles(context.program, outputDir, files);
  },
};
