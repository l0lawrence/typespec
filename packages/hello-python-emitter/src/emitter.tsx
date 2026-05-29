import { type EmitContext, joinPaths, NoTarget } from "@typespec/compiler";
import { type HelloPythonEmitterOptions, type RendererId, reportDiagnostic } from "./lib.js";
import { extractSdkShape } from "./sdk-ir.js";
import { alloyRenderer } from "./renderers/alloy-renderer.js";
import { efMixRenderer } from "./renderers/ef-mix-renderer.js";
import { stringRenderer } from "./renderers/string-renderer.js";
import { templateRenderer } from "./renderers/template-renderer.js";
import type { Renderer } from "./renderers/types.js";

const RENDERERS: Record<Exclude<RendererId, "all">, Renderer> = {
  alloy: alloyRenderer,
  string: stringRenderer,
  template: templateRenderer,
  "ef-mix": efMixRenderer,
};

/**
 * Entry point. Builds a renderer-agnostic `SdkShape` from the TypeSpec program
 * and dispatches it to one or all renderers. With `renderer: "all"` (the
 * default), each renderer writes into its own subdirectory of the emitter
 * output directory so the four approaches can be diffed side-by-side.
 */
export async function $onEmit(context: EmitContext<HelloPythonEmitterOptions>) {
  if (context.program.compilerOptions.noEmit) {
    return;
  }

  const choice: RendererId = context.options.renderer ?? "all";

  const shape = extractSdkShape(context.program);
  if (shape.operations.length === 0) {
    reportDiagnostic(context.program, { code: "no-operations", target: NoTarget });
  }

  if (choice === "all") {
    const timings: Array<{ id: string; ms: number }> = [];
    for (const r of Object.values(RENDERERS)) {
      const start = performance.now();
      await r.emit(context, shape, joinPaths(context.emitterOutputDir, r.id));
      timings.push({ id: r.id, ms: performance.now() - start });
    }
    const widest = Math.max(...timings.map((t) => t.id.length));
    // eslint-disable-next-line no-console
    console.log("\n[hello-python-emitter] renderer timings:");
    for (const t of timings.sort((a, b) => a.ms - b.ms)) {
      // eslint-disable-next-line no-console
      console.log(`  ${t.id.padEnd(widest)}  ${t.ms.toFixed(2).padStart(7)} ms`);
    }
    return;
  }

  const renderer = RENDERERS[choice];
  const start = performance.now();
  await renderer.emit(context, shape, context.emitterOutputDir);
  // eslint-disable-next-line no-console
  console.log(`\n[hello-python-emitter] ${choice} renderer: ${(performance.now() - start).toFixed(2)} ms`);
}
