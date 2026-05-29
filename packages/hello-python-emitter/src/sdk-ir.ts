import {
  getNamespaceFullName,
  listOperationsIn,
  navigateProgram,
  type Model,
  type Operation,
  type Program,
  type Type,
} from "@typespec/compiler";

/**
 * Renderer-agnostic IR describing the Python SDK we want to produce.
 *
 * All four renderers in `src/renderers/` consume the same `SdkShape` so that
 * the output layouts are byte-for-byte comparable.
 */
export interface SdkShape {
  /** Python class name for the synthetic client (e.g. `WidgetServiceClient`). */
  clientName: string;
  /** Python module / package name (snake_case, no extension). */
  moduleName: string;
  /** Source-stamped version string used in `_version.py`. */
  version: string;
  /** Operations rendered as stub functions in `operations/_operations.py`. */
  operations: SdkOperation[];
  /** User-defined TypeSpec models rendered as dataclasses in `models/_models.py`. */
  models: SdkModel[];
}

export interface SdkOperation {
  name: string;
  pyName: string;
  docstring?: string;
  parameters: SdkParameter[];
  returnType: string;
  /** Direct reference to the TypeSpec Operation. Only used by the ef-mix renderer. */
  tspOperation: Operation;
}

export interface SdkParameter {
  name: string;
  pyName: string;
  pyType: string;
  optional: boolean;
}

export interface SdkModel {
  name: string;
  pyName: string;
  docstring?: string;
  properties: SdkProperty[];
  /** Direct reference to the TypeSpec Model. Only used by the ef-mix renderer. */
  tspModel: Model;
}

export interface SdkProperty {
  name: string;
  pyName: string;
  pyType: string;
  optional: boolean;
}

const BUILTIN_NAMESPACES = ["TypeSpec", "Http", "Rest", "OpenAPI"];

function isUserNamespace(ns: string): boolean {
  if (!ns) return false;
  return !BUILTIN_NAMESPACES.some((b) => ns === b || ns.startsWith(`${b}.`));
}

/** Walk the TypeSpec program and produce an `SdkShape`. */
export function extractSdkShape(program: Program, moduleName: string): SdkShape {
  const operations: SdkOperation[] = [];
  const models: SdkModel[] = [];
  const seenModels = new Set<Model>();

  const allOps = listOperationsIn(program.getGlobalNamespaceType(), { recursive: true });
  for (const op of allOps) {
    operations.push(buildOperation(op));
  }

  navigateProgram(program, {
    model(model) {
      if (!model.namespace) return;
      const ns = getNamespaceFullName(model.namespace);
      if (!isUserNamespace(ns)) return;
      if (!model.name) return;
      if (seenModels.has(model)) return;
      seenModels.add(model);
      models.push(buildModel(model));
    },
  });

  let clientName = "HelloClient";
  let svcName = moduleName;
  for (const op of allOps) {
    let cur = op.interface?.namespace ?? op.namespace;
    while (cur?.namespace && cur.namespace.name) cur = cur.namespace;
    if (cur?.name) {
      svcName = cur.name;
      clientName = `${pascalCase(cur.name)}Client`;
      break;
    }
  }
  void svcName;

  return {
    clientName,
    moduleName,
    version: "1.0.0",
    operations,
    models,
  };
}

function buildOperation(op: Operation): SdkOperation {
  const parameters: SdkParameter[] = [];
  for (const param of op.parameters.properties.values()) {
    parameters.push({
      name: param.name,
      pyName: snakeCase(param.name),
      pyType: pythonTypeOf(param.type),
      optional: param.optional,
    });
  }
  return {
    name: op.name,
    pyName: snakeCase(op.name),
    parameters,
    returnType: pythonTypeOf(op.returnType),
    tspOperation: op,
  };
}

function buildModel(model: Model): SdkModel {
  const properties: SdkProperty[] = [];
  for (const prop of model.properties.values()) {
    properties.push({
      name: prop.name,
      pyName: snakeCase(prop.name),
      pyType: pythonTypeOf(prop.type),
      optional: prop.optional,
    });
  }
  return {
    name: model.name,
    pyName: pascalCase(model.name),
    properties,
    tspModel: model,
  };
}

/**
 * Tiny TypeSpec-Type → Python-type-string mapper used by the renderers that
 * don't go through emitter-framework. Covers the subset the sample exercises.
 */
export function pythonTypeOf(type: Type): string {
  switch (type.kind) {
    case "Intrinsic":
      switch (type.name) {
        case "void":
        case "null":
          return "None";
        case "never":
          return "None";
        default:
          return "Any";
      }
    case "Scalar":
      return scalarToPython(type.name);
    case "String":
      return "str";
    case "Number":
      return "int";
    case "Boolean":
      return "bool";
    case "Model":
      if (type.name === "Array") {
        const inner = type.indexer?.value;
        return `list[${inner ? pythonTypeOf(inner) : "Any"}]`;
      }
      if (type.name === "Record") {
        const inner = type.indexer?.value;
        return `dict[str, ${inner ? pythonTypeOf(inner) : "Any"}]`;
      }
      return type.name || "Any";
    case "Union": {
      const variants = [...type.variants.values()].map((v) => pythonTypeOf(v.type));
      const unique = Array.from(new Set(variants));
      return unique.length === 1 ? unique[0] : unique.join(" | ");
    }
    case "Enum":
      return type.name;
    case "Tuple":
      return `tuple[${type.values.map(pythonTypeOf).join(", ")}]`;
    default:
      return "Any";
  }
}

function scalarToPython(name: string): string {
  switch (name) {
    case "string":
    case "url":
      return "str";
    case "boolean":
      return "bool";
    case "bytes":
      return "bytes";
    case "int8":
    case "int16":
    case "int32":
    case "int64":
    case "integer":
    case "uint8":
    case "uint16":
    case "uint32":
    case "uint64":
    case "safeint":
      return "int";
    case "float":
    case "float32":
    case "float64":
    case "decimal":
    case "decimal128":
    case "numeric":
      return "float";
    case "plainDate":
      return "datetime.date";
    case "plainTime":
      return "datetime.time";
    case "utcDateTime":
    case "offsetDateTime":
      return "datetime.datetime";
    case "duration":
      return "datetime.timedelta";
    default:
      return "Any";
  }
}

export function snakeCase(s: string): string {
  return s
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .replace(/[-\s]+/g, "_")
    .toLowerCase();
}

export function pascalCase(s: string): string {
  return s
    .replace(/[_-]+/g, " ")
    .replace(/\s+(.)/g, (_, c) => c.toUpperCase())
    .replace(/^(.)/, (_, c) => c.toUpperCase());
}
