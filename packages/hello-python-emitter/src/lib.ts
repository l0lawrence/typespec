import { createTypeSpecLibrary, type JSONSchemaType } from "@typespec/compiler";

export type RendererId = "alloy" | "string" | "template" | "ef-mix" | "all";

export interface HelloPythonEmitterOptions {
  /**
   * Which renderer to use.
   *
   * - `"alloy"`    – pure `@alloy-js/python` components, manual type mapping.
   * - `"string"`   – raw template-literal strings written via `emitFile`.
   * - `"template"` – tiny mustache-lite engine filling Python templates.
   * - `"ef-mix"`   – Alloy + emitter-framework Python helpers for TypeSpec→Python conversions.
   * - `"all"`      – run every renderer; each writes into its own subdirectory
   *                  (`alloy/`, `string/`, `template/`, `ef-mix/`).
   *
   * Default: `"all"` (so you can immediately diff the outputs).
   */
  renderer?: RendererId;
}

const EmitterOptionsSchema: JSONSchemaType<HelloPythonEmitterOptions> = {
  type: "object",
  additionalProperties: false,
  properties: {
    renderer: {
      type: "string",
      enum: ["alloy", "string", "template", "ef-mix", "all"],
      nullable: true,
      default: "all",
      description:
        'Which renderer to use. "all" (default) emits one subdirectory per renderer so the outputs can be diffed side-by-side.',
    },
  },
  required: [],
};

export const $lib = createTypeSpecLibrary({
  name: "@typespec/hello-python-emitter",
  diagnostics: {
    "no-operations": {
      severity: "warning",
      messages: {
        default:
          "No operations found in the TypeSpec program. The generated SDK will have an empty operations file.",
      },
    },
  },
  emitter: {
    options: EmitterOptionsSchema,
  },
} as const);

export const { reportDiagnostic, createDiagnostic } = $lib;
