import type { EmitContext } from "@typespec/compiler";
import type { HelloPythonEmitterOptions } from "../lib.js";
import type { SdkShape } from "../sdk-ir.js";

export type RendererId = "alloy" | "string" | "template" | "ef-mix";

export interface Renderer {
  id: RendererId;
  /** One-line description for the README / diagnostics. */
  description: string;
  /**
   * Emit the SDK shape into `outputDir`. Implementations may either write
   * files directly (string / template renderers) or hand off to an Alloy
   * `writeOutput` call (alloy / ef-mix renderers).
   */
  emit(context: EmitContext<HelloPythonEmitterOptions>, shape: SdkShape, outputDir: string): Promise<void>;
}

export interface OutputFile {
  /** Path relative to the renderer's output directory. */
  path: string;
  content: string;
}
